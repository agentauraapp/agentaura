// composables/useAuth.ts
import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'

const userRef = ref<any>(null)
const loadingRef = ref(true)
const errorRef = ref<string | null>(null)

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

    // First just check if we even have a session
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

    // Then fetch the user; handle the “sub claim” error by clearing the stale token
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

  async function signUp(email: string, password: string) {
    error.value = null
    // You can include a redirect URL if you use email confirmations
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/login` }
    })
    if (err) { error.value = err.message; throw err }
  }

  async function signIn(email: string, password: string) {
    error.value = null
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) { error.value = err.message; throw err }
  }

  async function resetPassword(email: string) {
    error.value = null
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset`
    })
    if (err) { error.value = err.message; throw err }
  }

  async function updatePassword(newPassword: string) {
    error.value = null
    const { error: err } = await supabase.auth.updateUser({ password: newPassword })
    if (err) { error.value = err.message; throw err }
  }

  async function signOut() {
    await hardSignOut()
  }

  onMounted(() => {
    refresh()
    supabase.auth.onAuthStateChange((_event) => {
      // Covers SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED
      refresh()
    })
  })

  return { user, loading, error, refresh, signUp, signIn, signOut, resetPassword, updatePassword }
}
