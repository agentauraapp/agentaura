<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { supabase } from '@/lib/supabase'

type Submission = {
  id: string
  platform: 'google' | 'facebook' | 'zillow' | 'realtor' | 'internal'
  clicked_at: string | null
  posted_claimed_at: string | null
  verification_status: 'unknown' | 'suspected' | 'verified' | 'failed'
  external_url?: string | null
}

type Item = {
  id: number | string
  channel: 'email' | 'sms' | 'link'
  status: 'pending' | 'opened' | 'submitted' | 'posted' // tolerate extra statuses
  created_at: string
  opened_at: string | null
  submitted_at: string | null
  platform?: 'google' | 'facebook' | 'zillow' | 'realtor' | 'internal' // optional if your API sends it
  clients?: { name?: string | null; email?: string | null; phone?: string | null }
  review_submissions?: Submission[] // optional; shown as badges if present
}

const router = useRouter()
const items = ref<Item[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const lastLoaded = ref<Date | null>(null)
let timer: number | null = null

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8788'

const pendingCount   = computed(() => items.value.filter(r => r.status === 'pending' && !r.opened_at && !r.submitted_at).length)
const deliveredCount = computed(() => items.value.filter(r => !!r.opened_at).length)
const completedCount = computed(() => items.value.filter(r => !!r.submitted_at || r.status === 'submitted' || r.status === 'posted').length)
const conversionPct  = computed(() => {
  const sent = items.value.length || 0
  const done = completedCount.value
  return sent ? Math.round((done / sent) * 100) : 0
})

function fmtDate(s?: string | null) {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return String(s)
  return d.toLocaleString()
}

function statusLabel(row: Item) {
  if (row.submitted_at || row.status === 'submitted' || row.status === 'posted') return 'completed'
  if (row.opened_at) return 'delivered'
  return row.status
}

function pillClass(kind: 'completed' | 'delivered' | 'pending' | 'failed' | 'default') {
  return {
    'inline-block text-xs px-2 py-1 rounded border':
      true,
    // colors
    'bg-green-50 border-green-300 text-green-800': kind === 'completed',
    'bg-amber-50 border-amber-300 text-amber-800': kind === 'delivered',
    'bg-slate-50 border-slate-300 text-slate-700': kind === 'pending' || kind === 'default',
    'bg-rose-50 border-rose-300 text-rose-800': kind === 'failed'
  }
}

function subBadgeKind(s: Submission) {
  if (s.verification_status === 'failed') return 'failed' as const
  if (s.verification_status === 'verified') return 'completed' as const
  if (s.posted_claimed_at) return 'delivered' as const
  if (s.clicked_at) return 'default' as const
  return 'pending' as const
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Not authenticated')

    const res = await fetch(`${API_BASE}/api/review-requests`, {
      headers: { Authorization: `Bearer ${session.access_token}` }
    })
    if (!res.ok) {
      let msg = `Request failed (${res.status})`
      try {
        const body = await res.json()
        msg = body?.error || msg
      } catch {}
      throw new Error(msg)
    }
    const body = await res.json() as { items?: Item[] }
    items.value = Array.isArray(body.items) ? body.items : []
    lastLoaded.value = new Date()
  } catch (e: any) {
    error.value = e.message || String(e)
  } finally {
    loading.value = false
  }
}

function startAutoRefresh() {
  stopAutoRefresh()
  // light polling every 30s
  timer = window.setInterval(load, 30000) as any
}
function stopAutoRefresh() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

onMounted(() => {
  load()
  startAutoRefresh()
})
onBeforeUnmount(stopAutoRefresh)
</script>

<template>
  <main class="p-6 max-w-6xl mx-auto">
    <div class="flex items-center gap-3 text-sm mb-6">
      <RouterLink to="/">Dashboard</RouterLink>
      <span>•</span>
      <RouterLink :to="{ name: 'request-new' }">New Request</RouterLink>
      <span class="ml-auto text-xs text-gray-500">
        <button class="px-2 py-1 border rounded mr-2" @click="load" :disabled="loading">
          {{ loading ? 'Refreshing…' : 'Refresh' }}
        </button>
        <span v-if="lastLoaded">Last updated: {{ lastLoaded.toLocaleTimeString() }}</span>
      </span>
    </div>

    <!-- KPIs -->
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <div class="p-4 border rounded bg-white/80">
        <div class="text-sm text-gray-600">Pending</div>
        <div class="text-2xl font-semibold">{{ pendingCount }}</div>
      </div>
      <div class="p-4 border rounded bg-white/80">
        <div class="text-sm text-gray-600">Delivered</div>
        <div class="text-2xl font-semibold">{{ deliveredCount }}</div>
      </div>
      <div class="p-4 border rounded bg-white/80">
        <div class="text-sm text-gray-600">Completed</div>
        <div class="text-2xl font-semibold">{{ completedCount }}</div>
      </div>
      <div class="p-4 border rounded bg-white/80">
        <div class="text-sm text-gray-600">Conversion</div>
        <div class="text-2xl font-semibold">{{ conversionPct }}%</div>
      </div>
    </div>

    <h2 class="text-lg font-semibold mb-3">Recent Activity</h2>

    <div v-if="loading">Loading…</div>
    <p v-if="error" class="text-red-600 mb-3">{{ error }}</p>

    <div v-if="!loading" class="overflow-x-auto">
      <table class="w-full text-sm border-collapse bg-white/80 rounded">
        <thead>
          <tr class="text-left border-b">
            <th class="p-2">Client</th>
            <th class="p-2">Email</th>
            <th class="p-2">Channel</th>
            <th class="p-2">Status</th>
            <th class="p-2">Signals</th>
            <th class="p-2">Created</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in items" :key="r.id" class="border-b align-top">
            <td class="p-2">{{ r.clients?.name || '—' }}</td>
            <td class="p-2">{{ r.clients?.email || '—' }}</td>
            <td class="p-2 capitalize">{{ r.channel }}</td>
            <td class="p-2">
              <span :class="pillClass(statusLabel(r) === 'completed' ? 'completed' : statusLabel(r) === 'delivered' ? 'delivered' : 'pending')">
                {{ statusLabel(r) }}
              </span>
            </td>

            <!-- Signals: if API returns review_submissions, show per-platform badges; otherwise fall back to opened/submitted -->
            <td class="p-2">
              <template v-if="r.review_submissions && r.review_submissions.length">
                <span
                  v-for="s in r.review_submissions"
                  :key="s.id"
                  :class="pillClass(subBadgeKind(s))"
                  class="mr-1 mb-1"
                  title="Platform status"
                >
                  {{ s.platform }} •
                  <template v-if="s.verification_status==='verified'">Verified</template>
                  <template v-else-if="s.posted_claimed_at">Claimed</template>
                  <template v-else-if="s.clicked_at">Opened</template>
                  <template v-else>Pending</template>
                </span>
              </template>
              <template v-else>
                <span :class="pillClass(r.submitted_at ? 'completed' : r.opened_at ? 'delivered' : 'pending')">
                  {{ r.submitted_at ? 'Completed' : r.opened_at ? 'Opened' : 'No signals' }}
                </span>
              </template>
            </td>

            <td class="p-2 whitespace-nowrap">{{ fmtDate(r.created_at) }}</td>
          </tr>

          <tr v-if="items.length === 0">
            <td colspan="6" class="p-4 text-center text-gray-500">No activity yet.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </main>
</template>

<style scoped>
/* just in case Tailwind isn’t present; the pills still look okay */
</style>
