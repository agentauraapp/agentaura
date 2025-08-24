<script setup lang="ts">
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'vue-router'

const router = useRouter()
const platforms = ['google','facebook','zillow','realtor','internal'] as const

const form = ref({
  client_name: '',
  client_email: '',
  platform: platforms[0],
  // optional extras if you want to customize the email:
  subject: '',
  body_template: ''
})

const loading = ref(false)
const error = ref<string|null>(null)

function sanitize() {
  form.value.client_name = form.value.client_name.trim()
  form.value.client_email = form.value.client_email.trim().toLowerCase()
  if (!platforms.includes(form.value.platform as any)) {
    form.value.platform = platforms[0]
  }
}

function apiBase() {
  // set this in your frontend env as VITE_API_BASE=https://agentaura-backend.onrender.com
  return import.meta.env.VITE_API_BASE || 'http://localhost:8788'
}

async function submit() {
  loading.value = true
  error.value = null
  try {
    sanitize()

    const { data: { session }, error: sErr } = await supabase.auth.getSession()
    if (sErr) throw sErr
    if (!session?.access_token) throw new Error('Not authenticated')

    const resp = await fetch(`${apiBase()}/api/review-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        client: {
          name: form.value.client_name,
          email: form.value.client_email,
        },
        channel: 'email',
        // these two are optional; your backend handles defaults
        subject: form.value.subject || undefined,
        body_template: form.value.body_template || undefined,
        // optional: draft_text/platform if you want to store them
        draft_text: null,
      }),
    })

    const json = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      throw new Error(json?.error || `Request failed (${resp.status})`)
    }

    // Optionally inspect email send result:
    // console.log('review-requests response:', json)

    router.push({ name: 'dashboard' })
  } catch (e: any) {
    error.value = e.message ?? 'Failed to send review request'
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

      <!-- Optional subject/body controls (can remove if you don’t want them in UI) -->
      <div>
        <label class="block text-sm font-medium mb-1" for="subject">Email subject (optional)</label>
        <input id="subject" v-model="form.subject" class="border rounded p-2 w-full" placeholder="Quick review request" />
      </div>

      <div>
        <label class="block text-sm font-medium mb-1" for="body">Email body (optional HTML)</label>
        <textarea id="body" v-model="form.body_template" class="border rounded p-2 w-full" rows="4"
          placeholder="Leave blank to use the default template"></textarea>
      </div>

      <button :disabled="loading" class="px-4 py-2 rounded bg-black text-white w-full">
        {{ loading ? 'Sending…' : 'Send Request' }}
      </button>
    </form>

    <p v-if="error" class="text-red-600">{{ error }}</p>
  </main>
</template>
