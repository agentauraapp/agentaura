// backend/server.js
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { createClient } from '@supabase/supabase-js'

const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE)

/**
 * CORS: allow one or more origins (comma-separated, no spaces)
 * Example:
 *   CORS_ORIGIN=https://your-frontend.onrender.com,https://app.agentaura.app
 */
const allowedOrigins = process.env.CORS_ORIGIN?.split(',') ?? ['*']

const app = express()
app.use(cors({ origin: allowedOrigins }))
app.use(express.json({ limit: '1mb' }))
app.use(morgan('dev'))

/**
 * Supabase JWT verification via JWKS
 * Set SUPABASE_JWKS_URL to: https://<your-supabase-project>.supabase.co/auth/v1/keys
 */
if (!process.env.SUPABASE_JWKS_URL) {
  console.warn('⚠️  SUPABASE_JWKS_URL is not set. Protected routes will fail.')
}
const JWKS = process.env.SUPABASE_JWKS_URL
  ? createRemoteJWKSet(new URL(process.env.SUPABASE_JWKS_URL))
  : null

async function requireAuth(req, res, next) {
  try {
    if (!JWKS) return res.status(500).json({ error: 'Auth not configured' })
    const auth = req.headers.authorization || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return res.status(401).json({ error: 'Missing token' })

    const { payload } = await jwtVerify(token, JWKS, { algorithms: ['RS256'] })
    // Attach minimal user info for handlers
    req.user = { id: payload.sub, email: payload.email }
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

/** -----------------------
 * Routes
 * ----------------------*/

// Health/root
app.get('/', (_req, res) => res.json({ ok: true }))

// Public sanity route
app.get('/api/hello', (_req, res) => {
  res.json({ message: 'Hello from Agent Aura API 🎉' })
})

// Protected: returns the verified user
app.get('/api/me', requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user })
})

// Public: “Magic Submit” placeholder (echo back success)
app.post('/api/reviews/submit', (req, res) => {
  const { rating, text, name, email } = req.body || {}
  if (!rating || !text) {
    return res.status(400).json({ error: 'rating & text required' })
  }
  // TODO: persist to DB (Supabase) in a future step
  res.json({
    ok: true,
    id: Math.floor(Math.random() * 1e9),
    received: { rating, text, name, email },
  })
})

// 404 fallthrough
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }))

// Start server (Render sets PORT)
const PORT = process.env.PORT || 8788
app.listen(PORT, () => console.log(`API listening on :${PORT}`))
