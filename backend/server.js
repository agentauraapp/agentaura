// backend/server.js
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import { createClient } from '@supabase/supabase-js'
import { createRemoteJWKSet, jwtVerify, decodeProtectedHeader } from 'jose'

/* ---------------------------------
   App & Middleware
---------------------------------- */
const app = express()

// CORS: CORS_ORIGIN can be a comma-separated list (no spaces)
const allowedOrigins = process.env.CORS_ORIGIN?.split(',') ?? ['*']
app.use(cors({ origin: allowedOrigins }))
app.use(express.json({ limit: '1mb' }))
app.use(morgan('dev'))

/* ---------------------------------
   Supabase Clients & Config
---------------------------------- */
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
  console.warn('⚠️ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE')
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

/* ---------------------------------
   Auth: Dual-mode verifier
---------------------------------- */
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

/* ---------------------------------
   Routes
---------------------------------- */

// Health
app.get('/', (_req, res) => res.json({ ok: true }))

// Debug (optional; safe to keep during dev)
app.get('/api/hello', (_req, res) => {
  res.json({ message: 'Hello from Agent Aura API 🎉' })
})

// Who am I? (protected)
app.get('/api/me', requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user })
})

/* ---------- Agent profile & handle ---------- */

// Upsert minimal agent profile (id = auth.user.id)
app.post('/api/agents/profile', requireAuth, async (req, res) => {
  try {
    const { id } = req.user
    const { display_name = null, brokerage = null, theme_color = null, logo_url = null } = req.body || {}

    const { data, error } = await supa
      .from('agents')
      .upsert(
        { id, display_name, brokerage, theme_color, logo_url },
        { onConflict: 'id' }
      )
      .select('id, display_name, brokerage, theme_color, logo_url, created_at')
      .single()

    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true, agent: data })
  } catch (e) {
    res.status(500).json({ error: 'server_error' })
  }
})

// Get current handle for this agent
app.get('/api/agents/handle', requireAuth, async (req, res) => {
  try {
    const { id } = req.user
    const { data, error } = await supa
      .from('agent_handles')
      .select('handle')
      .eq('agent_id', id)
      .maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    res.json({ handle: data?.handle || null })
  } catch (e) {
    res.status(500).json({ error: 'server_error' })
  }
})

// Reserve/update handle (validate + unique)
app.post('/api/agents/handle', requireAuth, async (req, res) => {
  try {
    const { id } = req.user
    const { handle } = req.body || {}
    if (!handle) return res.status(400).json({ error: 'handle required' })
    const clean = String(handle).toLowerCase().trim()

    // 3–32 chars, letters/numbers/hyphen only, must start with letter
    if (!/^[a-z][a-z0-9-]{2,31}$/.test(clean)) {
      return res.status(400).json({ error: 'Invalid handle format' })
    }

    // Is this handle taken by another agent?
    const { data: existing, error: checkErr } = await supa
      .from('agent_handles')
      .select('agent_id')
      .eq('handle', clean)
      .maybeSingle()
    if (checkErr) return res.status(500).json({ error: checkErr.message })
    if (existing && existing.agent_id !== id) {
      return res.status(409).json({ error: 'Handle already taken' })
    }

    const { data, error } = await supa
      .from('agent_handles')
      .upsert({ handle: clean, agent_id: id }, { onConflict: 'handle' })
      .select('handle')
      .single()
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true, handle: data.handle })
  } catch (e) {
    res.status(500).json({ error: 'server_error' })
  }
})

/* ---------- Review links (Google/Facebook/Zillow/Realtor) ---------- */

// Get review links for current agent
app.get('/api/review-links', requireAuth, async (req, res) => {
  try {
    const { id } = req.user
    const { data, error } = await supa
      .from('review_links')
      .select('platform, url, verified')
      .eq('agent_id', id)
      .order('platform', { ascending: true })
    if (error) return res.status(500).json({ error: error.message })
    res.json({ links: data || [] })
  } catch (e) {
    res.status(500).json({ error: 'server_error' })
  }
})

// Upsert review links list
app.post('/api/review-links', requireAuth, async (req, res) => {
  try {
    const { id } = req.user
    const rows = Array.isArray(req.body?.links) ? req.body.links : []
    const allowed = new Set(['google', 'facebook', 'zillow', 'realtor'])
    const clean = rows
      .map(r => ({
        platform: String(r.platform || '').toLowerCase(),
        url: String(r.url || '').trim()
      }))
      .filter(r => allowed.has(r.platform) && r.url)

    // Upsert one-by-one to respect unique(agent_id, platform)
    for (const row of clean) {
      const { error } = await supa
        .from('review_links')
        .upsert(
          { agent_id: id, platform: row.platform, url: row.url },
          { onConflict: 'agent_id,platform' }
        )
      if (error) throw error
    }

    res.json({ ok: true })
  } catch (e) {
    res.status(400).json({ error: e.message || 'bad_request' })
  }
})

/* ---------- Public profile by handle ---------- */
app.get('/api/public/agent/:handle', async (req, res) => {
  try {
    const handle = String(req.params.handle || '').toLowerCase().trim()
    if (!handle) return res.status(400).json({ error: 'missing handle' })

    // 1) resolve handle -> agent_id
    const { data: h, error: hErr } = await supa
      .from('agent_handles')
      .select('agent_id')
      .eq('handle', handle)
      .maybeSingle()
    if (hErr) return res.status(500).json({ error: hErr.message })
    if (!h) return res.status(404).json({ error: 'not_found' })
    const agentId = h.agent_id

    // 2) basic agent info
    const { data: agent, error: aErr } = await supa
      .from('agents')
      .select('display_name, theme_color, logo_url, brokerage')
      .eq('id', agentId)
      .maybeSingle()
    if (aErr) return res.status(500).json({ error: aErr.message })

    // 3) recent reviews
    const { data: reviews, error: rErr } = await supa
      .from('reviews')
      .select('id, rating, text, client_name, created_at')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(20)
    if (rErr) return res.status(500).json({ error: rErr.message })

    const count = reviews?.length || 0
    const avg = count ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / count) : 0

    res.json({
      handle,
      agent: {
        id: agentId,
        display_name: agent?.display_name || null,
        brokerage: agent?.brokerage || null,
        theme_color: agent?.theme_color || null,
        logo_url: agent?.logo_url || null
      },
      stats: { count, avg: Number(avg.toFixed(2)) },
      reviews: reviews || []
    })
  } catch (e) {
    res.status(500).json({ error: 'server_error' })
  }
})

/* ---------- Public Magic Submit (no auth) ---------- */
// POST /api/reviews/submit?a=<handle|uuid>
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
        .eq('handle', a.toLowerCase())
        .maybeSingle()
      if (handleErr || !handleRow) return res.status(404).json({ error: 'unknown agent' })
      agentId = handleRow.agent_id
    }

    // Basic input constraints
    const clean = {
      rating: Math.max(1, Math.min(5, Number(rating))),
      text: String(text).slice(0, 5000),
      client_name: name ? String(name).slice(0, 200) : null,
      client_email: email ? String(email).slice(0, 320) : null,
      platform: 'internal'
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

/* ---------- Agent’s recent reviews (protected) ---------- */
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

/* ---------- 404 ---------- */
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }))

/* ---------------------------------
   Start
---------------------------------- */
const PORT = process.env.PORT || 8788
app.listen(PORT, () => {
  console.log(`API listening on :${PORT}`)
  console.log('Allowed origins:', allowedOrigins.join(', '))
  console.log('JWKS URL:', process.env.SUPABASE_JWKS_URL || '(missing)')
})
