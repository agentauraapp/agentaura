import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'

type MaybeUser = Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user']

const userRef = ref<MaybeUser>(null)
const loadingRef = ref(true)
const errorRef = ref<string | null>(null)

export function useAuth() {
  const user = userRef
  const loading = loadingRef
  const error = errorRef

  async function refresh() {
    loading.value = true
    const { data, error: err } = await supabase.auth.getUser()
    if (err) {
      error.value = err.message
      user.value = null
    } else {
      user.value = data.user
    }
    loading.value = false
  }

  function asCleanString(v: unknown): string {
    // Avoid passing refs/objects down to GoTrue by accident
    return String(v ?? '').trim()
  }

  async function signUp(email: unknown, password: unknown) {
    error.value = null
    const e = asCleanString(email).toLowerCase()
    const p = asCleanString(password)

    if (!e || !p) {
      const msg = 'Email and password are required.'
      error.value = msg
      throw new Error(msg)
    }

    // Sanity log (remove if noisy)
    // console.debug('signUp payload', { emailType: typeof e, passwordType: typeof p })

    const { error: err } = await supabase.auth.signUp({
      email: e,
      password: p,
      options: {
        // send the email confirmation link back to your app
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (err) {
      error.value = err.message
      throw err
    }
  }

  async function signIn(email: unknown, password: unknown) {
    error.value = null
    const e = asCleanString(email).toLowerCase()
    const p = asCleanString(password)

    const { error: err } = await supabase.auth.signInWithPassword({ email: e, password: p })
    if (err) { error.value = err.message; throw err }
  }

  async function resetPassword(email: unknown) {
    error.value = null
    const e = asCleanString(email).toLowerCase()
    const { error: err } = await supabase.auth.resetPasswordForEmail(e, {
      redirectTo: `${window.location.origin}/reset`
    })
    if (err) { error.value = err.message; throw err }
  }

  async function updatePassword(newPassword: unknown) {
    error.value = null
    const p = asCleanString(newPassword)
    const { error: err } = await supabase.auth.updateUser({ password: p })
    if (err) { error.value = err.message; throw err }
  }

  async function signOut() {
    await supabase.auth.signOut()
    await refresh()
  }

  onMounted(() => {
    refresh()
    supabase.auth.onAuthStateChange((_e, _s) => refresh())
  })

  return { user, loading, error, refresh, signUp, signIn, signOut, resetPassword, updatePassword }
}
