// /src/composables/useAuth.ts
import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'

type MaybeUser = Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user']

const userRef = ref<MaybeUser>(null)
const loadingRef = ref(true)
const errorRef = ref<string | null>(null)

function unwrapToString(v: any): string {
  // Accept raw strings, numbers, Vue refs, null/undefined
  if (v && typeof v === 'object' && 'value' in v) return String((v as any).value ?? '').trim()
  return String(v ?? '').trim()
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

    // Check if we even have a session
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

    // Fetch the user; handle stale tokens
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
    }
    loading.value = false
  }

  // Accepts either (email, password) or ({ email, password })
  async function signUp(a: any, b?: any) {
    error.value = null

    let email = ''
    let password = ''

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

    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/login` },
    })
    if (err) { error.value = err.message; throw err }
  }

  async function signIn(a: any, b?: any) {
    error.value = null

    let email = ''
    let password = ''

    if (typeof a === 'object' && b === undefined) {
      email = unwrapToString(a?.email).toLowerCase()
      password = unwrapToString(a?.password)
    } else {
      email = unwrapToString(a).toLowerCase()
      password = unwrapToString(b)
    }

    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) { error.value = err.message; throw err }
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
