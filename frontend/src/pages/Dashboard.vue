<!-- src/pages/Dashboard.vue -->
<script setup lang="ts">
import { onMounted } from 'vue'
import { useDashboard } from '@/composables/useDashboard'
import { useRouter } from 'vue-router'
const { loading, error, kpis, recent, load } = useDashboard()
const router = useRouter()
onMounted(load)
</script>

<template>
  <main class="p-6 space-y-6">
    <section class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="p-4 rounded border bg-white/80">
        <div class="text-sm text-gray-500">Pending</div>
        <div class="text-3xl font-semibold">{{ kpis.pending }}</div>
      </div>
      <div class="p-4 rounded border bg-white/80">
        <div class="text-sm text-gray-500">Delivered</div>
        <div class="text-3xl font-semibold">{{ kpis.delivered }}</div>
      </div>
      <div class="p-4 rounded border bg-white/80">
        <div class="text-sm text-gray-500">Completed</div>
        <div class="text-3xl font-semibold">{{ kpis.completed }}</div>
      </div>
      <div class="p-4 rounded border bg-white/80">
        <div class="text-sm text-gray-500">Conversion</div>
        <div class="text-3xl font-semibold">{{ (kpis.conversion*100).toFixed(0) }}%</div>
      </div>
    </section>

    <div class="flex justify-between items-center">
      <h2 class="text-xl font-semibold">Recent Activity</h2>
      <button class="px-4 py-2 rounded bg-black text-white" @click="router.push({ name: 'request-new' })">
        Send Review Request
      </button>
    </div>

    <section class="overflow-x-auto rounded border bg-white/80">
      <table class="min-w-full text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="text-left p-2">Client</th>
            <th class="text-left p-2">Email</th>
            <th class="text-left p-2">Platform</th>
            <th class="text-left p-2">Status</th>
            <th class="text-left p-2">Created</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in recent" :key="r.id" class="border-t">
            <td class="p-2">{{ r.client_name }}</td>
            <td class="p-2">{{ r.client_email }}</td>
            <td class="p-2">{{ r.platform }}</td>
            <td class="p-2">{{ r.status }}</td>
            <td class="p-2">{{ new Date(r.created_at).toLocaleString() }}</td>
          </tr>
          <tr v-if="!loading && recent.length === 0">
            <td colspan="5" class="p-4 text-gray-500">No activity yet.</td>
          </tr>
        </tbody>
      </table>
    </section>

    <p v-if="error" class="text-red-600">{{ error }}</p>
  </main>
</template>
