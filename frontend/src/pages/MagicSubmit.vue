<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8788'

// Query params from the email link
const rid = Number(route.query.rid)           // review request id (required)
const token = String(route.query.t || '')     // magic_link_token (required)
const handle = String(route.query.a || '')    // agent handle (optional)

const loading = ref(false)
const error = ref<string | null>(null)
const submitted = ref(false)

const hasParams = computed(() => !!rid && !!token)

async function pingOpened() {
  if (!hasParams.value) return
  try {
    await fetch(`${API_BASE}/api/review-requests/${rid}/opened`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    })
  } catch {
    /* non-blocking */
  }
}

async function markSubmitted() {
  if (!hasParams.value) {
    error.value = 'Missing link parameters.'
    return
  }
  loading.value = true
  error.value = null
  try {
    const res = await fetch(`${API_BASE}/api/review-requests/${rid}/submitted`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body?.error || `Submit failed (${res.status})`)
    }
    submitted.value = true
  } catch (e:any) {
    error.value = e.message || String(e)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  // fire-and-forget “opened” ping as soon as the page loads
  pingOpened()
})
</script>

<template>
  <main class="p-6 max-w-lg mx-auto space-y-4">
    <h1 class="text-2xl font-semibold">Leave a quick review</h1>

    <p v-if="!hasParams" class="text-red-600">
      Your link is missing required parameters. Please open the original email again.
    </p>

    <div class="space-y-2 text-sm">
      <p><strong>Agent:</strong> {{ handle || 'Your agent' }}</p>
      <p><strong>Request ID:</strong> {{ rid || '—' }}</p>
    </div>

    <div class="space-y-3">
      <p>Select your platform, leave the review there, then tap the button below.</p>

      <!-- You can replace these with real agent-specific URLs later -->
      <div class="grid grid-cols-2 gap-2">
        <a class="border rounded px-3 py-2 text-center"
           href="https://www.google.com/search?q=write+a+review" target="_blank" rel="noopener">Open Google</a>
        <a class="border rounded px-3 py-2 text-center"
           href="https://www.facebook.com" target="_blank" rel="noopener">Open Facebook</a>
        <a class="border rounded px-3 py-2 text-center"
           href="https://www.zillow.com" target="_blank" rel="noopener">Open Zillow</a>
        <a class="border rounded px-3 py-2 text-center"
           href="https://www.realtor.com" target="_blank" rel="noopener">Open Realtor.com</a>
      </div>

      <button :disabled="loading || !hasParams"
              class="px-4 py-2 rounded bg-black text-white"
              @click="markSubmitted">
        {{ loading ? 'Saving…' : 'I posted my review' }}
      </button>

      <p v-if="error" class="text-red-600">{{ error }}</p>
      <p v-if="submitted" class="text-green-700">
        Thanks! We recorded your review. You can close this page.
      </p>
    </div>
  </main>
</template>
