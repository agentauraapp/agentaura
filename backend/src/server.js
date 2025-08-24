// backend/server.js
import 'dotenv/config'
import reviewRequests from './routes/reviewRequests.js'
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import { createClient } from '@supabase/supabase-js'
import { createRemoteJWKSet, jwtVerify, decodeProtectedHeader } from 'jose'

const app = express()

/* ---------- CORS ---------- */
const allowedOrigins = process.env.CORS_ORIGIN?.split(',') ?? ['*']
const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}
app.use(cors(corsOptions))
app.options('*', cors(corsOptions))

app.use(express.json({ limit: '1mb' }))
app.use(morgan('dev'))

/* ---------- Supabase + JWT verify helpers ---------- */
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
  console.warn('⚠️ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE')
}
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE)

const jwks = process.env.SUPABASE_JWKS_URL
  ? createRemoteJWKSet(new URL(process.env.SUPABASE_JWKS_URL))
  : null

const hsSecret = process.env.SUPABASE_JWT_SECRET
  ? new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET)
  : null

async function verifySupabaseToken(token) {
  const { alg } = decodeProtectedHeader(token) || {}
  if (alg === 'RS256') {
    if (!jwks) throw new Error('JWKS not configured for RS256 tokens')
    const { payload } = await jwtVerify(token, jwks, { algorithms: ['RS256'], clockTolerance: 5 })
    return payload
  }
  if (alg === 'HS256') {
    if (!hsSecret) throw new Error('HS256 secret not configured (SUPABASE_JWT_SECRET)')
    const { payload } = await jwtVerify(token, hsSecret, { algorithms: ['HS256'], clockTolerance: 5 })
    return payload
  }
  throw new Error(`Unsupported alg: ${alg}`)
}

/* ---------- Auth middlewares ---------- */
// Strict guard for endpoints you explicitly protect in this file
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

// Soft attach: populate req.user if a valid token is present, otherwise continue.
// This is important because routes in routes/reviewRequests.js call their own
// `requireAuth` that *checks* req.user — so we must attach it here.
app.use(async (req, _res, next) => {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return next()
  try {
    const payload = await verifySupabaseToken(token)
    req.user = { id: payload.sub, email: payload.email }
  } catch (e) {
    // Don’t block the request here; the route-level guard will 401 if needed.
    console.warn('attachUserIfPresent: bad token:', e?.message)
  }
  next()
})

/* ---------- Routes ---------- */
app.get('/', (_req, res) => res.json({ ok: true }))

app.get('/api/hello', (_req, res) => {
  res.json({ message: 'Hello from Agent Aura API 🎉' })
})

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user })
})

// … your agents/review-links/public/reviews routes remain unchanged …

// Mount the reviewRequests router AFTER the attachUserIfPresent middleware.
// Do NOT wrap with `requireAuth` here because that router contains some public
// endpoints (like the token “opened/submitted” pings).
app.use(reviewRequests)

/* ---------- 404 ---------- */
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }))

/* ---------- Start ---------- */
const PORT = process.env.PORT || 8788
app.listen(PORT, () => {
  console.log(`API listening on :${PORT}`)
  console.log('Allowed origins:', allowedOrigins.join(', '))
  console.log('JWKS URL:', process.env.SUPABASE_JWKS_URL || '(missing)')
})
