import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'
import { createRemoteJWKSet, jwtVerify, decodeProtectedHeader } from 'jose'

/* ------------------- Supabase clients ------------------- */
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { persistSession: false } }
)

/** Build a user-scoped client that forwards the incoming JWT (RLS-friendly) */
function supabaseFromRequest(req) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    throw new Error('Backend missing SUPABASE_URL or SUPABASE_ANON_KEY; set env vars on the backend service.')
  }
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: req.headers.authorization || '' } },
    auth: { persistSession: false }
  })
}

/* ------------------- JWT verification ------------------- */
const jwks = process.env.SUPABASE_JWKS_URL
  ? createRemoteJWKSet(new URL(process.env.SUPABASE_JWKS_URL))
  : null

const hsSecret = process.env.SUPABASE_JWT_SECRET
  ? new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET)
  : null

async function verifySupabaseToken(token) {
  const { alg } = decodeProtectedHeader(token) || {}
  if (alg === 'RS256') {
    if (!jwks) throw new Error('JWKS not configured')
    const { payload } = await jwtVerify(token, jwks, { algorithms: ['RS256'], clockTolerance: 5 })
    return payload
  }
  if (alg === 'HS256') {
    if (!hsSecret) throw new Error('HS256 secret not configured')
    const { payload } = await jwtVerify(token, hsSecret, { algorithms: ['HS256'], clockTolerance: 5 })
    return payload
  }
  throw new Error(`Unsupported alg: ${alg}`)
}

/* ------------------- Router & guards ------------------- */
const router = Router()

// Attach req.user (strict) + req.supabase (always)
async function attachUser(req, res, next) {
  try {
    req.supabase = supabaseFromRequest(req)
    const auth = req.headers.authorization || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return res.status(401).json({ error: 'Missing token' })
    const payload = await verifySupabaseToken(token)
    req.user = { id: payload.sub, email: payload.email }
    next()
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token', reason: e?.message })
  }
}

// For anonymous token pings, we still want a Supabase client attached (no user required)
function attachSupabaseOnly(req, _res, next) {
  req.supabase = supabaseFromRequest(req)
  next()
}

// Call inside handlers that must have a user
function requireAuth(req) {
  if (!req.user || !req.user.id) {
    const err = new Error('Unauthorized')
    err.status = 401
    throw err
  }
}

/* ------------------- Helpers ------------------- */

// If you map agents 1:1 with auth.users, you may not need this.
// Here we just return the auth user id as agent id; adjust if you truly have an `agents` table
async function getAgentByUserId(userId) {
  return { id: userId, display_name: null }
}

// If you use custom handles, resolve them. Otherwise fallback to agentId.
async function getHandleForAgent(agentId) {
  const { data, error } = await supabaseAdmin
    .from('agent_handles')
    .select('handle')
    .eq('agent_id', agentId)
    .maybeSingle()
  if (error) throw error
  return data?.handle || agentId
}

async function upsertClient(agent_id, client) {
  if (!client || (!client.email && !client.phone)) {
    const err = new Error('Client email or phone required')
    err.status = 400
    throw err
  }
  const matchCol = client.email ? 'email' : 'phone'
  const matchVal = client[matchCol]

  const { data: existing, error: e1 } = await supabaseAdmin
    .from('clients')
    .select('id')
    .eq('agent_id', agent_id)
    .eq(matchCol, matchVal)
    .maybeSingle()
  if (e1) throw e1
  if (existing?.id) return existing.id

  const { data, error } = await supabaseAdmin
    .from('clients')
    .insert({
      agent_id,
      name: client.name || null,
      email: client.email || null,
      phone: client.phone || null
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

/* ------------------- Routes ------------------- */

/**
 * Create a review request (authenticated)
 * Uses user-scoped client so RLS sees auth.uid(). We DO NOT send agent_id; DB sets it via default auth.uid().
 */
router.post('/api/review-requests', attachUser, async (req, res, next) => {
  try {
    requireAuth(req)
    const userId = req.user.id
    const agent = await getAgentByUserId(userId)
    const sb = req.supabase

    const {
      client,
      draft_text,
      channel = 'email',
      subject,
      body_template,
      platform = 'google', // if your table keeps platform on the request
      status = 'pending'
    } = req.body || {}

    const allowedChannels  = ['email', 'sms', 'link']
    const allowedPlatforms = ['google','facebook','zillow','realtor','internal']
    const allowedStatuses  = ['pending','sent','opened','posted','failed','submitted']

    if (!client) {
      const err = new Error('client is required')
      err.status = 400
      throw err
    }
    if (!allowedChannels.includes(channel)) {
      const err = new Error(`invalid channel (allowed: ${allowedChannels.join(', ')})`)
      err.status = 400
      throw err
    }
    if (platform && !allowedPlatforms.includes(platform)) {
      const err = new Error(`invalid platform (allowed: ${allowedPlatforms.join(', ')})`)
      err.status = 400
      throw err
    }
    if (status && !allowedStatuses.includes(status)) {
      const err = new Error(`invalid status (allowed: ${allowedStatuses.join(', ')})`)
      err.status = 400
      throw err
    }

    // upsert client with admin (no RLS headaches here)
    const client_id = await upsertClient(agent.id, client)

    // insert review request with USER client (RLS, auth.uid() = agent)
    const { data, error } = await sb
      .from('review_requests')
      .insert({
        // agent_id: default auth.uid() (do NOT send)
        client_id,
        channel,
        subject: subject || null,
        body_template: body_template || null,
        draft_text: draft_text || null,
        platform, // if your schema has platform in this table
        status     // must match your CHECK constraint
      })
      .select('id, magic_link_token')
      .single()

    if (error) {
      const code = /violates|constraint|null value|check constraint|rls/i.test(error.message) ? 400 : 500
      return res.status(code).json({
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      })
    }

    const agentHandle = await getHandleForAgent(agent.id)
    const base = process.env.FRONTEND_URL || 'http://localhost:5173'
    const magic_link_url =
      `${base}/magic-submit?rid=${data.id}&a=${encodeURIComponent(agentHandle)}&t=${data.magic_link_token}`

    // email send (best-effort)
    let emailResult = null
    let emailError = null
    if (channel === 'email' && client.email) {
      try {
        const { sendReviewRequestEmail } = await import('../services/email.js')
        emailResult = await sendReviewRequestEmail({
          to: client.email,
          agentDisplayName: agent.display_name || 'your agent',
          clientName: client.name,
          magicLinkUrl: magic_link_url,
          subject,
          bodyTemplate: body_template
        })
        console.log('[email] sent', { to: client.email, id: emailResult?.data?.id || emailResult?.id || null })
      } catch (e) {
        emailError = e?.message ? String(e.message) : String(e)
        console.error('[email] failed', { to: client.email, error: emailError })
      }
    }

    return res.status(201).json({
      id: data.id,
      magic_link_url,
      email: {
        ok: !emailError,
        id: (emailResult && (emailResult.data?.id || emailResult.id)) || null,
        error: emailError
      }
    })
  } catch (err) {
    next(err)
  }
})

/**
 * List review requests (authenticated)
 * Uses user client + optional status filter. Also selects nested review_submissions for dashboard badges.
 */
router.get('/api/review-requests', attachUser, async (req, res, next) => {
  try {
    requireAuth(req)
    const sb = req.supabase
    const { status, limit = 50 } = req.query || {}

    let query = sb
      .from('review_requests')
      .select(`
        id,
        channel,
        status,
        created_at,
        opened_at,
        submitted_at,
        platform,
        clients:client_id ( name, email, phone ),
        review_submissions ( id, platform, clicked_at, posted_claimed_at, verification_status, external_url )
      `)
      .order('created_at', { ascending: false })
      .limit(Math.min(Number(limit) || 50, 100))

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) {
      const code = /rls|permission|policy/i.test(error.message) ? 401 : 400
      return res.status(code).json({ error: error.message })
    }

    return res.json({ items: data || [] })
  } catch (err) {
    next(err)
  }
})

/**
 * Anonymous token ping: opened
 * Uses admin client; validates magic_link_token and stamps opened_at/status.
 */
router.post('/api/review-requests/:id/opened', attachSupabaseOnly, async (req, res, next) => {
  try {
    const { id } = req.params
    const { token } = req.body || {}
    if (!token) {
      const err = new Error('token required')
      err.status = 400
      throw err
    }

    const { data: rr, error: e1 } = await supabaseAdmin
      .from('review_requests')
      .select('id, status, magic_link_token, opened_at')
      .eq('id', id)
      .single()
    if (e1) throw e1

    if (rr.magic_link_token !== token) {
      const err = new Error('forbidden')
      err.status = 403
      throw err
    }

    if (!rr.opened_at) {
      const { error: e2 } = await supabaseAdmin
        .from('review_requests')
        .update({ status: 'opened', opened_at: new Date().toISOString() })
        .eq('id', id)
      if (e2) throw e2
    }

    return res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

/**
 * Anonymous token ping: submitted
 */
router.post('/api/review-requests/:id/submitted', attachSupabaseOnly, async (req, res, next) => {
  try {
    const { id } = req.params
    const { token } = req.body || {}
    if (!token) {
      const err = new Error('token required')
      err.status = 400
      throw err
    }

    const { data: rr, error: e1 } = await supabaseAdmin
      .from('review_requests')
      .select('id, status, magic_link_token, submitted_at')
      .eq('id', id)
      .single()
    if (e1) throw e1

    if (rr.magic_link_token !== token) {
      const err = new Error('forbidden')
      err.status = 403
      throw err
    }

    if (!rr.submitted_at) {
      const { error: e2 } = await supabaseAdmin
        .from('review_requests')
        .update({ status: 'submitted', submitted_at: new Date().toISOString() })
        .eq('id', id)
      if (e2) throw e2
    }

    return res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

/* ------------------- Router-level error handler ------------------- */
router.use((err, _req, res, _next) => {
  const code = err.status || (/violates|constraint|null value|check constraint|rls/i.test(err.message) ? 400 : 500)
  console.error('[reviewRequests]', { code, message: err.message, stack: err.stack })
  return res.status(code).json({
    error: err.message || 'Internal error',
    code
  })
})

console.log('✔ routes/reviewRequests loaded')
export default router
