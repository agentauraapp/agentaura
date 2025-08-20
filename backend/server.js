// backend/server.js
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import { createClient } from '@supabase/supabase-js'
import { createRemoteJWKSet, jwtVerify, decodeProtectedHeader } from 'jose'

/* ---------------------------
   App & Middleware
---------------------------- */
const app = express()

// CORS: set CORS_ORIGIN as comma-separated list (no spaces)
const allowedOrigins = process.env.CORS_ORIGIN?.split(',') ?? ['*']
app.use(cors({ origin: allowedOrigins }))
app.use(express.json({ limit: '1mb' }))
app.use(morgan('dev'))

/* ---------------------------
   Supabase Clients & Config
---------------------------- */
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
  console.warn('⚠️  Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE')
}
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE)

// RS256 verification (JWKS)
const jwks = process.env.SUPABASE_JWKS_URL
  ? createRemoteJWKSet(new URL(process.env.SUPABASE_JWKS_URL))
  : null

// HS256 verification (shared secret)
const hsSecret = process.env.SUPABASE_JWT_SECRET
  ? new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET)
  : null

/* ---------------------------
   Auth: Dual-mode verifier
   - Accepts RS256 (JWKS) or HS256 (JWT secret)
---------------------------- */
async function verifySupabaseToken(token) {
  const { alg } = decodeProtectedHeader(token) || {}

  if (alg === 'RS256') {
    if (!jwks) throw new Error('JWKS not configured for RS256 tokens')
    const { payload } = await jwtVerify(token, jwks, {
      algorithms: ['RS256'],
      clockTolerance: 5
    })
    return payload
  }

  if (alg === 'HS256') {
    if (!hsSecret) throw new Error('HS256 secret not configured (SUPABASE_JWT_SECRET)')
    const { payload } = await jwtVerify(token, hsSecret, {
      algorithms: ['HS256'],
      clockTolerance: 5
    })
    return payload
  }

  throw new Error(`Unsupported alg: ${alg}`)
}

async function requireAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return res.status(401).json({ error: 'Missing token' })

    const payload = await verifySupabaseToken(token)
    req.user = { id: payload.sub, email: payload.email }
    next()
  } catch (err) {
    console.error('JWT verify failed:', err?.message)
    return res.status(401).json({ error: 'Invalid token', reason: err?.message })
  }
}

/* ---------------------------
   Routes
---------------------------- */
// Health
app.get('/', (_req, res) => res.json({ ok: true }))

// Public sanity route
app.get('/api/hello', (_req, res) => {
  res.json({ message: 'Hello from Agent Aura API 🎉' })
})

// Who am I? (protected)
app.get('/api/me', requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user })
})

// List my reviews (protected)  GET /api/reviews?limit=20
app.get('/api/reviews', requireAuth, async (req, res) => {
  try {
    const agentId = req.user.id
    const limit = Math.min(Number(req.query.limit || 20), 100)

    const { data, error } = await supa
      .from('reviews')
      .select('id, rating, text, client_name, created_at')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) return res.status(500).json({ error: error.message })
    res.json({ reviews: data || [] })
  } catch (e) {
    res.status(500).json({ error: 'server_error' })
  }
})

// Public Magic Submit — POST /api/reviews/submit?a=<handle or agent_id>
// body: { rating, text, name?, email? }
app.post('/api/reviews/submit', async (req, res) => {
  try {
    const { rating, text, name, email } = req.body || {}
    const a = (req.query.a || '').toString().trim()
    if (!a || !rating || !text) {
      return res.status(400).json({ error: 'rating, text, and agent handle required' })
    }

    // Resolve ?a= to agent UUID: accept raw UUID or look up handle
    let agentId = null
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(a)
    if (isUuid) {
      agentId = a
    } else {
      const { data: handleRow, error: handleErr } = await supa
        .from('agent_handles')
        .select('agent_id')
        .eq('handle', a)
        .maybeSingle()
      if (handleErr || !handleRow) return res.status(404).json({ error: 'unknown agent' })
      agentId = handleRow.agent_id
    }

    // Basic input constraints
    const clean = {
      rating: Math.max(1, Math.min(5, Number(rating))),
      text: String(text).slice(0, 5000),
      client_name: name ? String(name).slice(0, 200) : null,
      client_email: email ? String(email).slice(0, 320) : null
    }

    const { data, error } = await supa
      .from('reviews')
      .insert({ agent_id: agentId, ...clean })
      .select('id, created_at')
      .single()

    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true, id: data.id, created_at: data.created_at })
  } catch (e) {
    console.error('submit error:', e)
    res.status(500).json({ error: 'server_error' })
  }
})

// 404
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }))

/* ---------------------------
   Start
---------------------------- */
const PORT = process.env.PORT || 8788
app.listen(PORT, () => {
  console.log(`API listening on :${PORT}`)
  console.log('Allowed origins:', allowedOrigins.join(', '))
  console.log('JWKS URL:', process.env.SUPABASE_JWKS_URL || '(missing)')
})
