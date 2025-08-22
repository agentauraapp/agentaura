// src/composables/useDashboard.ts
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

export function useDashboard() {
  const loading = ref(false)
  const error = ref<string|null>(null)
  const kpis = ref<any>({ pending:0, delivered:0, completed:0, conversion:0, timeseries:[] })
  const recent = ref<any[]>([])

  const load = async () => {
    try {
      loading.value = true
      error.value = null

      const { data: k, error: e1 } = await supabase.rpc('get_dashboard')
      if (e1) throw e1
      kpis.value = k

      const { data: user } = await supabase.auth.getUser()
      const { data: r, error: e2 } = await supabase
        .from('review_requests')
        .select('id, client_name, client_email, platform, status, created_at')
        .eq('agent_id', user.user?.id)
        .order('created_at', { ascending: false })
        .limit(25)
      if (e2) throw e2
      recent.value = r ?? []
    } catch (err: any) {
      error.value = err.message ?? 'Failed to load'
    } finally {
      loading.value = false
    }
  }

  return { loading, error, kpis, recent, load }
}
