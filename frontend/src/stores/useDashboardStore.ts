// src/stores/useDashboardStore.ts
import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase' // your initialized client

type TSPoint = { day: string; count: number }

export const useDashboardStore = defineStore('dashboard', {
  state: () => ({
    loading: false as boolean,
    kpis: {
      pending: 0,
      delivered: 0,
      completed: 0,
      conversion: 0,
      timeseries: [] as TSPoint[],
    },
    recent: [] as any[],
    error: '' as string | null,
  }),
  actions: {
    async load() {
      try {
        this.loading = true
        this.error = null

        // 1) KPIs + series via RPC
        const { data: kpiData, error: rpcErr } = await supabase.rpc('get_dashboard')
        if (rpcErr) throw rpcErr
        this.kpis = kpiData

        // 2) recent review requests (last 25)
        const user = (await supabase.auth.getUser()).data.user
        const { data: recent, error: listErr } = await supabase
          .from('review_requests')
          .select('id, client_name, client_email, platform, status, created_at')
          .eq('agent_id', user?.id)
          .order('created_at', { ascending: false })
          .limit(25)

        if (listErr) throw listErr
        this.recent = recent ?? []

        // 3) live updates (optional)
        supabase.channel('review_requests:realtime')
          .on('postgres_changes',
            { event: '*', schema: 'public', table: 'review_requests' },
            () => this.load() // simple refetch
          )
          .subscribe()
      } catch (e: any) {
        this.error = e.message ?? 'Failed to load dashboard'
      } finally {
        this.loading = false
      }
    }
  }
})
