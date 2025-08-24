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

/* ---------- Supabase clients (admin + per-request) ---------- */
if (!process.env.SUPABASE_URL) {
  console.warn('⚠️ Missing SUPABASE_URL')
}
if (!process.env.SUPABASE_SERVICE_ROLE) {
  console.warn('⚠️ Missing SUPABASE_SERVICE_ROLE (used for privileged admin ops)')
}
if (!process.env.SUPABASE_ANON_KEY) {
  console.warn('⚠️ Missing SUPABASE_ANON_KEY (used to forward user JWT to PostgREST)')
}

/** Admin client (service role) — use ONLY for privileged, server-side tasks */
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
)

/** Build a user-scoped client from the incoming request (for RLS-protected queries) */
function supabaseFromRequest(req) {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: {
      headers: {
        // Forward the user's JWT so PostgREST/RLS sees auth.uid()
        Authorization: req.headers.authorization || ''
      }
    }
  })
}

/* ---------- JWT verification (Supabase) ---------- */
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
// Strict guard for endpoints you explicitly protect here
export async function requireAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return res.status(401).json({ error: 'Missing token' })

    const payload = await verifySupabaseToken(token)
    req.user = { id: payload.sub, email: payload.email }
    return next()
  } catch (err) {
    console.error('JWT verify failed:', err?.message)
    return res.status(401).json({ error: 'Invalid token', reason: err?.message })
  }
}

/** Soft attach: if a valid token exists, populate req.user. Always attach a user-scoped supabase client. */
app.use(async (req, _res, next) => {
  // Always attach a per-request Supabase client that forwards whatever Authorization header came in
  req.supabase = supabaseFromRequest(req)

  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return next()
  try {
    const payload = await verifySupabaseToken(token)
    req.user = { id: payload.sub, email: payload.email }
  } catch (e) {
    // Do not block here; route-level guards can enforce auth
    console.warn('attachUserIfPresent: bad token:', e?.message)
  }
  return next()
})

/* ---------- Routes ---------- */
app.get('/', (_req, res) => res.json({ ok: true }))

app.get('/api/hello', (_req, res) => {
  res.json({ message: 'Hello from Agent Aura API 🎉' })
})

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user })
})

/**
 * IMPORTANT:
 * The reviewRequests router should use `req.supabase` for all user-scoped DB calls,
 * not a global/service client. That guarantees RLS sees the user's JWT.
 *
 * Example inside routes/reviewRequests.js:
 *   router.post('/api/review-requests', requireAuth, async (req, res) => {
 *     const sb = req.supabase;            // <-- user-scoped client
 *     const { data, error } = await sb.from('review_requests').insert({...}).select('id').single()
 *     ...
 *   })
 */
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
