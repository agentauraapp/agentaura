<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8788'

const rid = Number(route.query.rid) // review_request_id
const token = String(route.query.t || '')
const platform = ref<'google'|'facebook'|'zillow'|'realtor'|'internal'>('google')
const postedUrl = ref('')

async function pingOpened() {
  if (!rid || !token) return
  await fetch(`${API_BASE}/api/review-requests/${rid}/opened`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  }).catch(()=>{})
}

function platformUrl(p: typeof platform.value) {
  // TODO: store per-agent platform URLs; for now return a placeholder
  return 'https://www.google.com/search?q=write+a+review'
}

async function openPlatform() {
  // optional: fire-and-forget to your Supabase `review_submissions` upsert
  // await trackClick(rid, platform.value)
  window.location.href = platformUrl(platform.value)
}

async function iPosted() {
  await fetch(`${API_BASE}/api/review-requests/${rid}/submitted`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  })
  alert('Thanks! We recorded your review.')
}

onMounted(pingOpened)
</script>

<template>
  <main class="p-6 max-w-lg mx-auto space-y-4">
    <h1 class="text-2xl font-semibold">Leave a quick review</h1>

    <label class="block text-sm">Choose platform</label>
    <select v-model="platform" class="border rounded p-2 w-full">
      <option value="google">Google</option>
      <option value="facebook">Facebook</option>
      <option value="zillow">Zillow</option>
      <option value="realtor">Realtor</option>
      <option value="internal">Internal</option>
    </select>

    <button class="px-4 py-2 bg-black text-white rounded" @click="openPlatform">
      Open {{ platform }}
    </button>

    <div class="space-y-2">
      <label class="block text-sm">Paste your review URL (optional)</label>
      <input v-model="postedUrl" class="border rounded p-2 w-full" placeholder="https://..." />
      <button class="px-4 py-2 border rounded" @click="iPosted">I posted my review</button>
    </div>
  </main>
</template>
