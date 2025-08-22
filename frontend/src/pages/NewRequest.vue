<!-- src/pages/NewRequest.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'vue-router'

const router = useRouter()

const form = ref({
  client_name: '',
  client_email: '',
  platform: 'google'
})
const platforms = ['google', 'facebook', 'zillow', 'realtor', 'internal']
const loading = ref(false)
const error = ref<string | null>(null)
const message = ref<string | null>(null)

async function submit() {
  error.value = null
  message.value = null
  loading.value = true
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error: insErr } = await supabase.from('review_requests').insert({
      agent_id: user.id,
      client_name: form.value.client_name,
      client_email: form.value.client_email,
      platform: form.value.platform,
      status: 'sent'
    })
    if (insErr) throw insErr

    message.value = 'Request created. Redirecting to dashboard…'
    setTimeout(() => router.push({ name: 'dashboard' }), 800)
  } catch (e: any) {
    error.value = e.message ?? 'Failed to create request'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="max-w-xl mx-auto p-6">
    <h1 class="text-2xl font-semibold mb-4">Send Review Request</h1>

    <form class="space-y-4" @submit.prevent="submit">
      <div class="flex flex-col">
        <label class="mb-1 font-medium" for="name">Client name</label>
        <input id="name" v-model="form.client_name" type="text" class="border rounded p-2" required />
      </div>

      <div class="flex flex-col">
        <label class="mb-1 font-medium" for="email">Client email</label>
        <input id="email" v-model="form.client_email" type="email" class="border rounded p-2" required />
      </div>

      <div class="flex flex-col">
        <label class="mb-1 font-medium" for="platform">Platform</label>
        <select id="platform" v-model="form.platform" class="border rounded p-2">
          <option v-for="p in platforms" :key="p" :value="p">{{ p }}</option>
        </select>
      </div>

      <button :disabled="loading" class="bg-black text-white px-4 py-2 rounded">
        {{ loading ? 'Sending…' : 'Send Request' }}
      </button>

      <p v-if="error" class="text-red-600">{{ error }}</p>
      <p v-if="message" class="text-green-700">{{ message }}</p>
    </form>
  </main>
</template>
