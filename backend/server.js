// backend/server.js
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import { createClient } from '@supabase/supabase-js'
import { createRemoteJWKSet, jwtVerify } from 'jose'

/* ---------------------------
   Config & Clients
---------------------------- */
const app = express()

// CORS: comma-separated list of allowed origins (no spaces)
const allowedOrigins = process.env.CORS_ORIGIN?.split(',') ?? ['*']
app.use(cors({ origin: allowedOrigins }))
app.use(express.json({ limit: '1mb' }))
app.use(morgan('dev'))

// Supabase (server-side)
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
  console.warn('⚠️  Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE')
}
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE)

// JWKS for verifying Supabase user JWTs
if (!process.env.SUPABASE_JWKS_URL) {
  console.warn('⚠️  SUPABASE_JWKS_URL not set; protected routes will fail.')
}
const JWKS = process.env.SUPABASE_JWKS_URL
  ? createRemoteJWKSet(new URL(process.env.SUPABASE_JWKS_URL))
  : null

/* ---------------------------
   Auth Middleware
---------------------------- */
async function requireAuth(req, res, next) {
  try {
    if (!JWKS) return res.status(500).json({ error: 'Auth not configured' })
    const auth = req.headers.authorization || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return res.status(401).json({ error: 'Missing token' })

    const { payload } = await jwtVerify(token, JWKS, {
      algorithms: ['RS256'],
      clockTolerance: 5 // seconds
      // (Optional) add issuer/aud checks later if desired
    })
    req.user = { id: payload.sub, email: payload.email }
    next()
  } catch (err) {
    console.error('JWT verify failed:', err?.message)
    return res.status(401).json({ error: 'Invalid token' })
  }
}

/* ---------------------------
   Routes
---------------------------- */

// Health/root
app.get('/', (_req, res) => res.json({ ok: true }))

// Public sanity route
app.get('/api/hello', (_req, res) => {
  res.json({ message: 'Hello from Agent Aura API 🎉' })
})

// Protected: who am I?
app.get('/api/me', requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user })
})

// Protected: list my reviews (most recent first)
// GET /api/reviews?limit=20
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

// Public: Magic Submit — persist a review for an agent by handle or UUID
// POST /api/reviews/submit?a=<handle or agent_id>
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

// 404 fallback
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }))

// Start
const PORT = process.env.PORT || 8788
app.listen(PORT, () => {
  console.log(`API listening on :${PORT}`)
  console.log('Allowed origins:', allowedOrigins.join(', '))
  console.log('JWKS URL:', process.env.SUPABASE_JWKS_URL || '(missing)')
})
