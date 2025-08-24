<script setup lang="ts">
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'vue-router'

const router = useRouter()

// If you have VITE_BACKEND_URL in your frontend env, it will be used.
// Otherwise we fall back to your Render backend URL.
const API_BASE =
  (import.meta as any).env?.VITE_BACKEND_URL ||
  'https://agentaura-backend.onrender.com'

// Simple form model
const form = ref({
  client_name: '',
  client_email: '',
  platform: 'internal',   // not used by backend email flow, but keep if you want later
  subject: '',
  body_template: '',
  draft_text: ''
})

const loading = ref(false)
const error = ref<string | null>(null)
const okMsg = ref<string | null>(null)

function sanitize() {
  form.value.client_name = form.value.client_name.trim()
  form.value.client_email = form.value.client_email.trim().toLowerCase()
  form.value.subject = form.value.subject.trim()
  form.value.body_template = form.value.body_template.trim()
  form.value.draft_text = form.value.draft_text.trim()
}

async function submit() {
  loading.value = true
  error.value = null
  okMsg.value = null
  try {
    sanitize()

    // Get a fresh session & token
    const { data: { session }, error: sErr } = await supabase.auth.getSession()
    if (sErr) throw new Error(sErr.message)
    if (!session?.access_token) throw new Error('Not authenticated')

    // Build payload the backend expects
    const payload = {
      client: {
        name: form.value.client_name,
        email: form.value.client_email
      },
      channel: 'email',
      subject: form.value.subject || undefined,
      body_template: form.value.body_template || undefined,
      draft_text: form.value.draft_text || undefined
    }

    const resp = await fetch(`${API_BASE}/api/review-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(payload)
    })

    const json = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      // Bubble up server-provided error if any
      throw new Error(json?.error || `Request failed (${resp.status})`)
    }

    // Optional: show quick confirmation including email send result
    if (json?.email?.ok) {
      okMsg.value = 'Request created and email queued ✅'
    } else if (json?.email && json?.email?.error) {
      okMsg.value = 'Request created, but email did not send. Check backend logs.'
    } else {
      okMsg.value = 'Request created.'
    }

    // Redirect after a short moment
    setTimeout(() => router.push({ name: 'dashboard' }), 500)
  } catch (e: any) {
    error.value = e?.message || 'Failed to create request'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="p-6 max-w-xl mx-auto space-y-4">
    <h1 class="text-2xl font-semibold">Send Review Request</h1>

    <form class="space-y-3" @submit.prevent="submit">
      <div>
        <label class="block text-sm font-medium mb-1" for="name">Client name</label>
        <input id="name" v-model="form.client_name" class="border rounded p-2 w-full" required />
      </div>

      <div>
        <label class="block text-sm font-medium mb-1" for="email">Client email</label>
        <input id="email" v-model="form.client_email" type="email" class="border rounded p-2 w-full" required />
      </div>

      <div>
        <label class="block text-sm font-medium mb-1" for="subject">Email subject (optional)</label>
        <input id="subject" v-model="form.subject" class="border rounded p-2 w-full" placeholder="Quick review request" />
      </div>

      <div>
        <label class="block text-sm font-medium mb-1" for="body">Email body (HTML allowed, optional)</label>
        <textarea id="body" v-model="form.body_template" class="border rounded p-2 w-full" rows="4"
          placeholder='Hi {{name}}, please leave a quick review: {{link}}'></textarea>
      </div>

      <div>
        <label class="block text-sm font-medium mb-1" for="draft">Internal note (optional)</label>
        <textarea id="draft" v-model="form.draft_text" class="border rounded p-2 w-full" rows="2"
          placeholder="Internal note..."></textarea>
      </div>

      <button :disabled="loading" class="px-4 py-2 rounded bg-black text-white w-full">
        {{ loading ? 'Sending…' : 'Send Request' }}
      </button>
    </form>

    <p v-if="error" class="text-red-600">{{ error }}</p>
    <p v-if="okMsg" class="text-green-700">{{ okMsg }}</p>
  </main>
</template>
