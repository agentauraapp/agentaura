import { defineStore } from 'pinia'
import { supabase } from '../supabase'

export const useAuthStore = defineStore('auth', {
  state: () => ({ session: null as any, loading: true }),
  getters: {
    user: (s) => s.session?.user || null,
    token: (s) => s.session?.access_token || null
  },
  actions: {
    async init() {
      const { data } = await supabase.auth.getSession()
      this.session = data.session
      this.loading = false
      supabase.auth.onAuthStateChange((_e, s) => { this.session = s })
    },
    async logout(){ await supabase.auth.signOut() }
  }
})
