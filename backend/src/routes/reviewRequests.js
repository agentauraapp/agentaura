import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'

const router = Router()

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { persistSession: false } }
)

function requireAuth(req) {
  if (!req?.user?.id) {
    const err = new Error('Unauthorized')
    err.status = 401
    throw err
  }
}

async function getAgentByUserId(userId) {
  const { data, error } = await supabaseAdmin
    .from('agents')
    .select('id, display_name')
    .eq('id', userId) // or .eq('user_id', userId) if that's your schema
    .maybeSingle()

  if (error) throw error
  if (!data) {
    const err = new Error('Agent not found')
    err.status = 404
    throw err
  }
  return /** @type {{ id: string, display_name: string|null }} */ (data)
}

async function getHandleForAgent(agentId) {
  const { data, error } = await supabaseAdmin
    .from('agent_handles')
    .select('handle')
    .eq('agent_id', agentId)
    .maybeSingle()
  if (error) throw error
  return data?.handle ?? agentId
}

async function upsertClient(agent_id, client = {}) {
  if (!client.email && !client.phone) throw new Error('Client email or phone required')

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

// --- Routes ---

// Create a review request (+ email if channel=email and client has email)
router.post('/api/review-requests', async (req, res, next) => {
  try {
    requireAuth(req)
    const userId = req.user.id
    const agent = await getAgentByUserId(userId)

    const { client, draft_text, channel = 'email', subject, body_template } = req.body || {}

    if (!client) throw new Error('client is required')
    if (!['email', 'sms'].includes(channel)) {
      const err = new Error('invalid channel')
      err.status = 400
      throw err
    }

    const client_id = await upsertClient(agent.id, client)

    const { data, error } = await supabaseAdmin
      .from('review_requests')
      .insert({
        agent_id: agent.id,
        client_id,
        channel,
        subject: subject || null,
        body_template: body_template || null,
        draft_text: draft_text || null
      })
      .select('id, magic_link_token')
      .single()
    if (error) throw error

    const agentHandle = await getHandleForAgent(agent.id)
    const base = process.env.FRONTEND_BASE_URL || 'http://localhost:5173'
    const magic_link_url = `${base}/magic-submit?a=${encodeURIComponent(agentHandle)}&t=${data.magic_link_token}`

    if (channel === 'email' && client.email) {
      const { sendReviewRequestEmail } = await import('../services/email.js')
      await sendReviewRequestEmail({
        to: client.email,
        agentDisplayName: agent.display_name || 'your agent',
        clientName: client.name,
        magicLinkUrl: magic_link_url,
        subject,
        bodyTemplate: body_template
      })
    }

    res.status(201).json({ id: data.id, magic_link_url })
  } catch (err) {
    next(err)
  }
})

// List review requests (optional ?status, ?limit)
router.get('/api/review-requests', async (req, res, next) => {
  try {
    requireAuth(req)
    const userId = req.user.id
    const agent = await getAgentByUserId(userId)

    const status = req.query?.status
    const limit = Math.min(Number(req.query?.limit) || 50, 100)

    let query = supabaseAdmin
      .from('review_requests')
      .select(`
        id,
        channel,
        status,
        created_at,
        opened_at,
        submitted_at,
        clients:client_id ( name, email, phone )
      `)
      .eq('agent_id', agent.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw error
    res.json({ items: data ?? [] })
  } catch (err) {
    next(err)
  }
})

// Anonymous token ping: opened
router.post('/api/review-requests/:id/opened', async (req, res, next) => {
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

    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// Anonymous token ping: submitted
router.post('/api/review-requests/:id/submitted', async (req, res, next) => {
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

    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
