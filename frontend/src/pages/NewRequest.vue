<script setup lang="ts">
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'vue-router'

const router = useRouter()
const platforms = ['google','facebook','zillow','realtor','internal'] as const

const form = ref({
  client_name: '',
  client_email: '',
  platform: platforms[0]
})

const loading = ref(false)
const error = ref<string|null>(null)

function sanitize() {
  form.value.client_name = form.value.client_name.trim()
  form.value.client_email = form.value.client_email.trim().toLowerCase()
  // ensure platform matches DB check constraint exactly
  if (!platforms.includes(form.value.platform as any)) {
    form.value.platform = platforms[0]
  }
}

async function submit() {
  loading.value = true
  error.value = null
  try {
    sanitize()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error: insErr } = await supabase.from('review_requests').insert({
      agent_id: user.id,
      client_name: form.value.client_name,
      client_email: form.value.client_email,
      platform: form.value.platform, // must match allowed platforms
      channel: 'email',               // keep or change to 'sms'/'link' as needed
      status: 'pending'               // ✅ aligns with current DB status check
    })
    if (insErr) throw insErr

    router.push({ name: 'dashboard' })
  } catch (e:any) {
    error.value = e.message ?? 'Failed to create request'
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
        <label class="block text-sm font-medium mb-1" for="platform">Platform</label>
        <select id="platform" v-model="form.platform" class="border rounded p-2 w-full">
          <option v-for="p in platforms" :key="p" :value="p">{{ p }}</option>
        </select>
      </div>

      <button :disabled="loading" class="px-4 py-2 rounded bg-black text-white">
        {{ loading ? 'Sending…' : 'Send Request' }}
      </button>
    </form>

    <p v-if="error" class="text-red-600">{{ error }}</p>
  </main>
</template>
