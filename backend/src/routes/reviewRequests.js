// backend/src/routes/reviewRequests.js
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
    throw new Error('Backend missing SUPABASE_URL or SUPABASE_ANON_KEY.')
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

function attachSupabaseOnly(req, _res, next) {
  req.supabase = supabaseFromRequest(req)
  next()
}

function requireAuth(req) {
  if (!req.user?.id) {
    const err = new Error('Unauthorized')
    err.status = 401
    throw err
  }
}

/* ------------------- Helpers ------------------- */

/** If agents == auth.users 1:1, you can just return id; otherwise pull from agents table */
async function getAgentByUserId(userId) {
  // Try to read a profile row; fall back to minimal
  const { data, error } = await supabaseAdmin
    .from('agents')
    .select('id, display_name, brokerage, logo_url, theme_color')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  if (data) return data
  return { id: userId, display_name: null, brokerage: null, logo_url: null, theme_color: null }
}

async function getHandleForAgent(agentId) {
  const { data, error } = await supabaseAdmin
    .from('agent_handles')
    .select('handle')
    .eq('agent_id', agentId)
    .maybeSingle()
  if (error) throw error
  return data?.handle || agentId
}

/** optional review links (for {{google_url}} etc.) */
async function getReviewLinks(agentId) {
  const { data, error } = await supabaseAdmin
    .from('review_links')
    .select('platform, url')
    .eq('agent_id', agentId)
  if (error) throw error
  const map = Object.create(null)
  ;(data || []).forEach(r => { map[r.platform] = r.url })
  return map
}

/** find or create client; email is matched case-insensitively */
async function upsertClient(agent_id, client) {
  if (!client || (!client.email && !client.phone)) {
    const err = new Error('Client email or phone required')
    err.status = 400
    throw err
  }
  const email = client.email ? String(client.email).trim().toLowerCase() : null
  const phone = client.phone ? String(client.phone).trim() : null

  if (email) {
    const { data: existing, error: e1 } = await supabaseAdmin
      .from('clients').select('id')
      .eq('agent_id', agent_id).ilike('email', email).maybeSingle()
    if (e1) throw e1
    if (existing?.id) return existing.id
  } else if (phone) {
    const { data: existing, error: e1 } = await supabaseAdmin
      .from('clients').select('id')
      .eq('agent_id', agent_id).eq('phone', phone).maybeSingle()
    if (e1) throw e1
    if (existing?.id) return existing.id
  }

  const { data, error } = await supabaseAdmin
    .from('clients')
    .insert({ agent_id, name: client.name || null, email, phone })
    .select('id')
    .single()

  if (!error && data?.id) return data.id

  if (error?.code === '23505') {
    // race: reselect
    const col = email ? ['email', 'ilike', email] : ['phone', 'eq', phone]
    const { data: again, error: e2 } = await supabaseAdmin
      .from('clients').select('id')
      .eq('agent_id', agent_id)[col[1]](col[0], col[2]).maybeSingle()
    if (e2) throw e2
    if (again?.id) return again.id
  }
  throw error || new Error('Failed to upsert client')
}

/** very small mustache-style renderer for {{tokens}} */
function renderTemplate(tpl, vars) {
  return String(tpl || '').replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, k) => {
    const v = vars[k] ?? ''
    return v == null ? '' : String(v)
  })
}

/** build subject + html from defaults or custom inputs */
function buildEmailContent({ subject, body_template, vars }) {
  const defaultSubject = `Quick favor: 60-second review for {{agent_name}}?`
  const defaultBody = `
    <p>Hi {{client_name}},</p>
    <p>Thanks again for working with me! If you have a minute, could you share a quick review of your experience?</p>
    <p>You can pick your favorite site:</p>
    <ul>
      {{google_li}}{{facebook_li}}{{zillow_li}}{{realtor_li}}
    </ul>
    <p>Or use this quick link: <a href="{{magic_link_url}}">{{magic_link_url}}</a></p>
    <p>Thanks so much,<br/>{{agent_name}}<br/>{{agent_title_or_team}}</p>
  `

  const s = renderTemplate(subject || defaultSubject, vars)
  // Build <li> links if present
  const li = (label, url) => url ? `<li><a href="${url}">${label}</a></li>` : ''
  const htmlVars = {
    ...vars,
    google_li: li('Google', vars.google_url),
    facebook_li: li('Facebook', vars.facebook_url),
    zillow_li: li('Zillow', vars.zillow_url),
    realtor_li: li('Realtor', vars.realtor_url)
  }
  const h = renderTemplate(body_template || defaultBody, htmlVars)
  return { subject: s, html: h }
}

/* ------------------- Routes ------------------- */

/** Create a review request + send email (authenticated) */
router.post('/api/review-requests', attachUser, async (req, res, next) => {
  try {
    requireAuth(req)
    const sb = req.supabase
    const userId = req.user.id

    const {
      client,
      draft_text,
      channel = 'email',
      subject,
      body_template,
      platform = 'google',
      status = 'pending'
    } = req.body || {}

    const allowedChannels  = ['email', 'sms', 'link']
    const allowedPlatforms = ['google','facebook','zillow','realtor','internal']
    const allowedStatuses  = ['pending','sent','opened','posted','failed','submitted']

    if (!client) throw Object.assign(new Error('client is required'), { status: 400 })
    if (!allowedChannels.includes(channel)) throw Object.assign(new Error('invalid channel'), { status: 400 })
    if (platform && !allowedPlatforms.includes(platform)) throw Object.assign(new Error('invalid platform'), { status: 400 })
    if (status && !allowedStatuses.includes(status)) throw Object.assign(new Error('invalid status'), { status: 400 })

    // resolve agent + links
    const agent = await getAgentByUserId(userId)
    const links = await getReviewLinks(agent.id)

    const client_id = await upsertClient(agent.id, client)

    const { data, error } = await sb
      .from('review_requests')
      .insert({
        client_id,
        channel,
        subject: subject || null,
        body_template: body_template || null,
        draft_text: draft_text || null,
        platform,
        status
      })
      .select('id, magic_link_token')
      .single()

    if (error) {
      const code = /violates|constraint|null value|check constraint|rls/i.test(error.message) ? 400 : 500
      return res.status(code).json({ error: error.message, code: error.code, details: error.details, hint: error.hint })
    }

    const agentHandle = await getHandleForAgent(agent.id)
    const base = process.env.FRONTEND_URL || 'http://localhost:5173'
    const magic_link_url =
      `${base}/magic-submit?rid=${data.id}&a=${encodeURIComponent(agentHandle)}&t=${data.magic_link_token}`

    // Prepare interpolation vars
    const vars = {
      // agent
      agent_name: agent.display_name || 'your agent',
      agent_title_or_team: agent.brokerage || '',
      agent_handle: agentHandle,
      // client
      client_name: client.name || 'there',
      client_email: (client.email || '').toLowerCase(),
      // links
      magic_link_url,
      google_url: links.google || '',
      facebook_url: links.facebook || '',
      zillow_url: links.zillow || '',
      realtor_url: links.realtor || ''
    }

    // Render subject/body (use defaults if missing)
    const { subject: finalSubject, html } = buildEmailContent({ subject, body_template, vars })

    // Attempt email send
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
          subject: finalSubject,
          bodyTemplate: html
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

/** List review requests for dashboard */
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

/** Anonymous token ping: opened */
router.post('/api/review-requests/:id/opened', attachSupabaseOnly, async (req, res, next) => {
  try {
    const { id } = req.params
    const { token } = req.body || {}
    if (!token) return res.status(400).json({ error: 'token required' })

    const { data: rr, error: e1 } = await supabaseAdmin
      .from('review_requests').select('id, status, magic_link_token, opened_at')
      .eq('id', id).single()
    if (e1) throw e1

    if (rr.magic_link_token !== token) return res.status(403).json({ error: 'forbidden' })

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

/** Anonymous token ping: submitted */
router.post('/api/review-requests/:id/submitted', attachSupabaseOnly, async (req, res, next) => {
  try {
    const { id } = req.params
    const { token } = req.body || {}
    if (!token) return res.status(400).json({ error: 'token required' })

    const { data: rr, error: e1 } = await supabaseAdmin
      .from('review_requests').select('id, status, magic_link_token, submitted_at')
      .eq('id', id).single()
    if (e1) throw e1

    if (rr.magic_link_token !== token) return res.status(403).json({ error: 'forbidden' })

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
  return res.status(code).json({ error: err.message || 'Internal error', code })
})

console.log('✔ routes/reviewRequests loaded')
export default router
