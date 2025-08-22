<!-- src/pages/NewRequest.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'vue-router'
import InputText from 'primevue/inputtext'
import Dropdown from 'primevue/dropdown'
import Button from 'primevue/button'
import Card from 'primevue/card'

const router = useRouter()
const form = ref({ client_name: '', client_email: '', platform: 'google' })
const platforms = ['google','facebook','zillow','realtor','internal']
const loading = ref(false)
const error = ref<string|null>(null)

async function submit() {
  error.value = null
  loading.value = true
  try {
    const user = (await supabase.auth.getUser()).data.user
    const { error: insErr } = await supabase.from('review_requests').insert({
      agent_id: user?.id,
      client_name: form.value.client_name,
      client_email: form.value.client_email,
      platform: form.value.platform,
      status: 'sent'
    })
    if (insErr) throw insErr
    router.push({ name: 'dashboard' })
  } catch (e: any) {
    error.value = e.message ?? 'Failed to create request'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="p-4 max-w-xl mx-auto">
    <Card>
      <template #title>Send Review Request</template>
      <div class="flex flex-col gap-3">
        <span class="p-float-label">
          <InputText id="name" v-model="form.client_name" />
          <label for="name">Client name</label>
        </span>
        <span class="p-float-label">
          <InputText id="email" v-model="form.client_email" />
          <label for="email">Client email</label>
        </span>
        <span class="p-float-label">
          <Dropdown id="platform" v-model="form.platform" :options="platforms" />
          <label for="platform">Platform</label>
        </span>
        <Button :loading="loading" label="Send" icon="pi pi-send" @click="submit" />
        <div v-if="error" class="text-red-600">{{ error }}</div>
      </div>
    </Card>
  </div>
</template>
