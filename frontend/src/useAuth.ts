import { ref, onMounted } from 'vue'
import { supabase } from './supabase'

export const user = ref<any|null>(null)
export const loading = ref(true)
export const authError = ref<string|undefined>(undefined)

export function useAuth(){
  onMounted(async () => {
    const { data:{ session } } = await supabase.auth.getSession()
    user.value = session?.user ?? null
    loading.value = false
  })
  // keep user in sync
  supabase.auth.onAuthStateChange((_e, session) => {
    user.value = session?.user ?? null
  })

  async function signUp(email:string, password:string){
    authError.value = undefined
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) authError.value = error.message
    return { error }
  }
  async function signIn(email:string, password:string){
    authError.value = undefined
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) authError.value = error.message
    return { error }
  }
  async function resetPassword(email:string){
    authError.value = undefined
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/login' // where they’ll land after reset link
    })
    if (error) authError.value = error.message
    return { error }
  }
  function signOut(){ return supabase.auth.signOut() }

  return { user, loading, authError, signUp, signIn, resetPassword, signOut }
}
