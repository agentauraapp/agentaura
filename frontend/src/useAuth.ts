import { ref, onMounted } from 'vue'
import { supabase } from './supabase'

const user = ref<any|null>(null)

export function useAuth(){
  onMounted(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    user.value = session?.user ?? null
    supabase.auth.onAuthStateChange((_e, s) => user.value = s?.user ?? null)
  })
  return {
    user,
    signOut: () => supabase.auth.signOut(),
    // Magic link (passwordless)
    signInWithEmailLink: (email:string) =>
      supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin }
      }),
    // Optional password flow
    signUp: (email:string, password:string) => supabase.auth.signUp({ email, password }),
    signIn: (email:string, password:string) => supabase.auth.signInWithPassword({ email, password }),
  }
}
