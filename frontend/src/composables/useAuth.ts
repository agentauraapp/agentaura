// /src/composables/useAuth.ts
import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'

type MaybeUser = Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user']

const userRef = ref<MaybeUser>(null)
const loadingRef = ref(true)
const errorRef = ref<string | null>(null)

function unwrapToString(v: any): string {
  if (v && typeof v === 'object' && 'value' in v) return String((v as any).value ?? '').trim()
  return String(v ?? '').trim()
}

/**
 * Ensure an 'agents' row exists for the current authenticated user.
 * Assumes schema: agents.id == auth.users.id (UUID PK).
 * If your schema uses agents.user_id instead, switch the payload accordingly.
 */
async function ensureAgentForCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // Try a lightweight existence check first
  const { data: existing, error: selErr } = await supabase
    .from('agents')
    .select('id')
    .eq('id', user.id) // change to .eq('user_id', user.id) if your schema uses user_id
    .maybeSingle()

  if (selErr) {
    // If RLS blocks select, we can still try an upsert; just log and continue.
    // console.warn('agents existence check failed:', selErr.message)
  }
  if (existing?.id) return

  // Upsert agent row; if your table defines a UNIQUE constraint on id, onConflict:'id' is fine.
  // If you use user_id, set payload to { user_id: user.id, display_name: user.email } and onConflict:'user_id'.
  const payload = { id: user.id, display_name: user.email ?? null }
  const { error: upErr } = await supabase
    .from('agents')
    .upsert(payload, { onConflict: 'id' })

  if (upErr) {
    // Surface but do not crash the app; backend FK will fail later if this doesn't exist.
    // You might add user guidance or telemetry here.
    // console.error('Failed to provision agent row:', upErr.message)
  }
}

export function useAuth() {
  const user = userRef
  const loading = loadingRef
  const error = errorRef

  async function hardSignOut() {
    try { await supabase.auth.signOut() } catch {}
    user.value = null
  }

  async function refresh() {
    loading.value = true
    error.value = null

    const { data: { session }, error: sErr } = await supabase.auth.getSession()
    if (sErr) {
      error.value = sErr.message
      loading.value = false
      return
    }
    if (!session) {
      user.value = null
      loading.value = false
      return
    }

    const { data, error: uErr } = await supabase.auth.getUser()
    if (uErr) {
      const msg = (uErr.message || '').toLowerCase()
      if (msg.includes('sub claim') || msg.includes('does not exist')) {
        await hardSignOut()
      } else {
        error.value = uErr.message
      }
    } else {
      user.value = data.user
      // Keep agents row in sync whenever we refresh with a valid user.
      ensureAgentForCurrentUser()
    }
    loading.value = false
  }

  // Accepts either (email, password) or ({ email, password })
  async function signUp(a: any, b?: any) {
    error.value = null
    let email = '', password = ''

    if (typeof a === 'object' && b === undefined) {
      email = unwrapToString(a?.email).toLowerCase()
      password = unwrapToString(a?.password)
    } else {
      email = unwrapToString(a).toLowerCase()
      password = unwrapToString(b)
    }

    if (!email || !password) {
      const msg = 'Email and password are required.'
      error.value = msg
      throw new Error(msg)
    }

    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/login` },
    })
    if (err) { error.value = err.message; throw err }

    // If email confirmations are disabled (or returns a session), provision now.
    // If confirmations are enabled, this will be a no-op (no session yet); we'll provision on first sign-in / refresh.
    if (data.session) await ensureAgentForCurrentUser()
  }

  async function signIn(a: any, b?: any) {
    error.value = null
    let email = '', password = ''

    if (typeof a === 'object' && b === undefined) {
      email = unwrapToString(a?.email).toLowerCase()
      password = unwrapToString(a?.password)
    } else {
      email = unwrapToString(a).toLowerCase()
      password = unwrapToString(b)
    }

    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) { error.value = err.message; throw err }

    // After a successful sign-in we definitely have a session; provision agent row now.
    await ensureAgentForCurrentUser()
  }

  async function resetPassword(v: any) {
    error.value = null
    const email = unwrapToString(v).toLowerCase()
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset`,
    })
    if (err) { error.value = err.message; throw err }
  }

  async function updatePassword(v: any) {
    error.value = null
    const newPassword = unwrapToString(v)
    const { error: err } = await supabase.auth.updateUser({ password: newPassword })
    if (err) { error.value = err.message; throw err }
  }

  async function signOut() {
    await hardSignOut()
  }

  onMounted(() => {
    refresh()
    supabase.auth.onAuthStateChange(() => refresh())
  })

  return { user, loading, error, refresh, signUp, signIn, signOut, resetPassword, updatePassword }
}
