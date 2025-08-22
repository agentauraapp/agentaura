import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'

const userRef = ref<any>(null)
const loadingRef = ref(true)
const errorRef = ref<string | null>(null)

export function useAuth() {
  const user = userRef
  const loading = loadingRef
  const error = errorRef

  async function refresh() {
    loading.value = true
    const { data: { user: u } } = await supabase.auth.getUser()
    user.value = u
    loading.value = false
  }

  async function signUp(email: string, password: string) {
    error.value = null
    const { error: err } = await supabase.auth.signUp({ email, password })
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
      redirectTo: window.location.origin + '/reset'
    })
    if (err) { error.value = err.message; throw err }
  }

  async function updatePassword(newPassword: string) {
    error.value = null
    const { error: err } = await supabase.auth.updateUser({ password: newPassword })
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
