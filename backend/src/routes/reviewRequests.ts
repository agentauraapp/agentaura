// backend/src/routes/reviewRequests.ts
import { Router } from 'express'
import { createClient, type PostgrestSingleResponse } from '@supabase/supabase-js'

const router = Router()

console.log('[reviewRequests] router loaded')

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!,
  { auth: { persistSession: false } }
)

function requireAuth(req: any) {
  if (!req.user?.id) {
    console.warn('[reviewRequests] requireAuth: req.user missing. Did you apply auth middleware on these routes?')
    const err: any = new Error('Unauthorized')
    err.status = 401
    throw err
  }
}

async function getAgentByUserId(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('agents')
    .select('id, display_name')
    .eq('id', userId) // If your agents table uses user_id, change to .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  if (!data) {
    const err: any = new Error('Agent not found')
    err.status = 404
    throw err
  }
  return data as { id: string; display_name: string | null }
}

async function getHandleForAgent(agentId: string) {
  const { data, error } = await supabaseAdmin
    .from('agent_handles')
    .select('handle')
    .eq('agent_id', agentId)
    .maybeSingle()
  if (error) throw error
  return data?.handle ?? agentId // fallback to UUID
}

async function upsertClient(
  agent_id: string,
  client: { name?: string; email?: string; phone?: string }
) {
  if (!client?.email && !client?.phone) throw new Error('Client email or phone required')

  const matchCol: 'email' | 'phone' = client.email ? 'email' : 'phone'
  const matchVal = (client as any)[matchCol] as string

  const { data: existing, error: e1 } = await supabaseAdmin
    .from('clients')
    .select('id')
    .eq('agent_id', agent_id)
    .eq(matchCol, matchVal)
    .maybeSingle()
  if (e1) throw e1
  if (existing?.id) return existing.id as string

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
  return data!.id as string
}

/* -------------------- Routes -------------------- */

// Create a review request + email (if channel=email and client has email)
router.post('/api/review-requests', async (req: any, res, next) => {
  try {
    console.log('[reviewRequests][POST] incoming body:', req.body)
    requireAuth(req)
    const userId = req.user.id as string
    const agent = await getAgentByUserId(userId)

    const {
      client,
      draft_text,
      channel = 'email',
      subject,
      body_template
    } = req.body || {}

    if (!client) throw new Error('client is required')
    if (!['email', 'sms'].includes(channel)) {
      const err: any = new Error('invalid channel')
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
    const magic_link_url =
      `${base}/magic-submit?a=${encodeURIComponent(agentHandle)}&t=${data!.magic_link_token}`

    console.log('[reviewRequests][POST] created review_request', {
      id: data!.id,
      to: client.email || client.phone,
      channel,
      magic_link_url
    })

    // Attempt to send email if requested
    let emailResult: any = null
    let emailError: string | null = null

    if (channel === 'email' && client.email) {
      try {
        console.log('[reviewRequests][POST] attempting email send via services/email.js',
          { hasApiKey: !!process.env.RESEND_API_KEY, to: client.email })

        const { sendReviewRequestEmail } = await import('../services/email.js') // keep .js for runtime ESM
        emailResult = await sendReviewRequestEmail({
          to: client.email,
          agentDisplayName: agent.display_name || 'your agent',
          clientName: client.name,
          magicLinkUrl: magic_link_url,
          subject,
          bodyTemplate: body_template
        })

        // Normalize a couple common shapes for easy viewing
        const normId =
          emailResult?.data?.id ??
          emailResult?.id ??
          emailResult?.result?.data?.id ??
          null

        console.log('[reviewRequests][POST] email send result', {
          to: client.email,
          id: normId,
          raw: emailResult
        })
      } catch (e: any) {
        emailError = e?.message ? String(e.message) : String(e)
        console.error('[reviewRequests][POST] email send failed', {
          to: client.email,
          error: emailError
        })
      }
    } else {
      if (channel === 'email') {
        console.warn('[reviewRequests][POST] channel=email but no client.email present')
      }
    }

    res.status(201).json({
      id: data!.id,
      magic_link_url,
      email: {
        ok: !emailError,
        // try to surface a consistent id if available
        id: emailResult?.data?.id ?? emailResult?.id ?? emailResult?.result?.data?.id ?? null,
        error: emailError,
        // include a tiny bit of the raw for debugging (safe fields)
        debug: emailResult ? {
          dataKeys: Object.keys(emailResult?.data || {}),
          topLevelKeys: Object.keys(emailResult || {})
        } : null
      }
    })
  } catch (err) {
    next(err)
  }
})

// List review requests (optionally filter by status)
router.get('/api/review-requests', async (req: any, res, next) => {
  try {
    requireAuth(req)
    const userId = req.user.id as string
    const agent = await getAgentByUserId(userId)

    const { status, limit = 50 } = req.query as any

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
      .limit(Math.min(Number(limit) || 50, 100))

    if (status) query = query.eq('status', status)

    const { data, error } = await query as PostgrestSingleResponse<any[]>
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
      const err: any = new Error('token required')
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
      const err: any = new Error('forbidden')
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
      const err: any = new Error('token required')
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
      const err: any = new Error('forbidden')
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
