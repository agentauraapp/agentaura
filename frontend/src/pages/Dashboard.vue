<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/lib/supabase'

type Item = {
  id: string
  channel: 'email' | 'sms'
  status: 'pending' | 'opened' | 'submitted'
  created_at: string
  opened_at: string | null
  submitted_at: string | null
  clients?: { name?: string | null; email?: string | null; phone?: string | null }
}

const items = ref<Item[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8788'

const pendingCount   = computed(() => items.value.filter(r => r.status === 'pending').length)
const deliveredCount = computed(() => items.value.filter(r => !!r.opened_at).length)
const completedCount = computed(() => items.value.filter(r => !!r.submitted_at).length)
const conversionPct  = computed(() => {
  const sent = items.value.length || 0
  const done = completedCount.value
  return sent ? Math.round((done / sent) * 100) : 0
})

async function load() {
  loading.value = true
  error.value = null
  try {
    // get access token from supabase session
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Not authenticated')

    const res = await fetch(`${API_BASE}/api/review-requests`, {
      headers: { Authorization: `Bearer ${session.access_token}` }
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body?.error || `Request failed (${res.status})`)
    }
    const body = await res.json() as { items: Item[] }
    items.value = Array.isArray(body.items) ? body.items : []
  } catch (e: any) {
    error.value = e.message || String(e)
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <main class="p-6 max-w-6xl mx-auto">
    <div class="flex items-center gap-3 text-sm mb-6">
      <RouterLink to="/">Dashboard</RouterLink>
      <span>|</span>
      <RouterLink :to="{ name: 'request-new' }">New Request</RouterLink>
    </div>

    <div class="grid grid-cols-4 gap-4 mb-8">
      <div class="p-4 border rounded">
        <div class="text-sm text-gray-600">Pending</div>
        <div class="text-2xl font-semibold">{{ pendingCount }}</div>
      </div>
      <div class="p-4 border rounded">
        <div class="text-sm text-gray-600">Delivered</div>
        <div class="text-2xl font-semibold">{{ deliveredCount }}</div>
      </div>
      <div class="p-4 border rounded">
        <div class="text-sm text-gray-600">Completed</div>
        <div class="text-2xl font-semibold">{{ completedCount }}</div>
      </div>
      <div class="p-4 border rounded">
        <div class="text-sm text-gray-600">Conversion</div>
        <div class="text-2xl font-semibold">{{ conversionPct }}%</div>
      </div>
    </div>

    <h2 class="text-lg font-semibold mb-3">Recent Activity</h2>

    <div v-if="loading">Loading…</div>
    <p v-if="error" class="text-red-600 mb-3">{{ error }}</p>

    <div v-if="!loading" class="overflow-x-auto">
      <table class="w-full text-sm border-collapse">
        <thead>
          <tr class="text-left border-b">
            <th class="p-2">Client</th>
            <th class="p-2">Email</th>
            <th class="p-2">Platform</th>
            <th class="p-2">Status</th>
            <th class="p-2">Created</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in items" :key="r.id" class="border-b">
            <td class="p-2">{{ r.clients?.name || '—' }}</td>
            <td class="p-2">{{ r.clients?.email || '—' }}</td>
            <td class="p-2">{{ r.channel }}</td>
            <td class="p-2">
              <span v-if="r.submitted_at">completed</span>
              <span v-else-if="r.opened_at">delivered</span>
              <span v-else>{{ r.status }}</span>
            </td>
            <td class="p-2">{{ new Date(r.created_at).toLocaleString() }}</td>
          </tr>
          <tr v-if="items.length === 0">
            <td colspan="5" class="p-4 text-center text-gray-500">No activity yet.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </main>
</template>
