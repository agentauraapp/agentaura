<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useAuthStore } from '../stores/auth'
import { supabase } from '../supabase'

const toast = useToast()
const auth = useAuthStore()
const API = import.meta.env.VITE_API_BASE

async function authedFetch(path: string, init: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json'
    }
  })
}

/* -------- state -------- */
const displayName = ref('')
const brokerage = ref('')
const themeColor = ref('#0ea5e9') // default
const logoUrl = ref('')
const savingProfile = ref(false)

const handle = ref('')
const newHandle = ref('')
const savingHandle = ref(false)

type LinkRow = { platform: 'google'|'facebook'|'zillow'|'realtor'; url: string; verified: boolean }
const links = ref<LinkRow[]>([
  { platform: 'google',   url: '', verified: false },
  { platform: 'facebook', url: '', verified: false },
  { platform: 'zillow',   url: '', verified: false },
  { platform: 'realtor',  url: '', verified: false },
])
const savingLinks = ref(false)

const publicProfileUrl = computed(() =>
  handle.value ? `${location.origin}/@${encodeURIComponent(handle.value)}` : ''
)
const magicSubmitUrl = computed(() =>
  handle.value ? `${location.origin}/magic-submit?a=${encodeURIComponent(handle.value)}` : ''
)

/* -------- actions -------- */
async function loadAll() {
  // profile (lightweight upsert/read pattern)
  try {
    // you may have a GET /api/agents/me later; for now use the upsert as no-op
    await authedFetch('/api/agents/profile', { method: 'POST', body: JSON.stringify({ display_name: displayName.value || null, brokerage: brokerage.value || null, theme_color: themeColor.value || null, logo_url: logoUrl.value || null }) })
  } catch {}

  // handle
  try {
    const r = await authedFetch('/api/agents/handle')
    if (r.ok) {
      const j = await r.json()
      handle.value = j.handle || ''
      newHandle.value = handle.value
    }
  } catch {}

  // links
  try {
    const r = await authedFetch('/api/review-links')
    if (r.ok) {
      const j = await r.json()
      const map = new Map<string, LinkRow>()
      j.links?.forEach((x: LinkRow) => map.set(x.platform, x))
      links.value = links.value.map((row) => map.get(row.platform) || row)
    }
  } catch {}
}

async function saveProfile() {
  savingProfile.value = true
  try {
    const r = await authedFetch('/api/agents/profile', {
      method: 'POST',
      body: JSON.stringify({
        display_name: displayName.value || null,
        brokerage: brokerage.value || null,
        theme_color: themeColor.value || null,
        logo_url: logoUrl.value || null
      })
    })
    if (!r.ok) throw new Error((await r.json()).error || 'Failed')
    toast.add({ severity:'success', summary:'Branding saved' })
  } catch (e:any) {
    toast.add({ severity:'error', summary:'Could not save', detail:e.message })
  } finally {
    savingProfile.value = false
  }
}

async function saveHandle() {
  if (!newHandle.value) {
    toast.add({ severity: 'warn', summary: 'Enter a handle' }); return
  }
  savingHandle.value = true
  try {
    const r = await authedFetch('/api/agents/handle', {
      method: 'POST',
      body: JSON.stringify({ handle: newHandle.value })
    })
    const j = await r.json()
    if (!r.ok) throw new Error(j.error || 'Failed to save handle')
    handle.value = j.handle
    toast.add({ severity:'success', summary:'Handle saved' })
  } catch (e:any) {
    toast.add({ severity:'error', summary:'Could not save handle', detail:e.message })
  } finally {
    savingHandle.value = false
  }
}

async function saveLinks() {
  savingLinks.value = true
  try {
    const r = await authedFetch('/api/review-links', {
      method: 'POST',
      body: JSON.stringify({ links: links.value })
    })
    const j = await r.json()
    if (!r.ok) throw new Error(j.error || 'Failed to save links')
    toast.add({ severity:'success', summary:'Links saved' })
  } catch (e:any) {
    toast.add({ severity:'error', summary:'Could not save links', detail:e.message })
  } finally {
    savingLinks.value = false
  }
}

function copy(text: string, label = 'Copied!') {
  navigator.clipboard.writeText(text).then(
    () => toast.add({ severity: 'success', summary: label, life: 1200 }),
    () => toast.add({ severity: 'warn', summary: 'Copy failed', detail: text })
  )
}

onMounted(async () => {
  if (auth.loading) await auth.init()
  await loadAll()
})
</script>

<template>
  <div class="grid gap-3 md:gap-4">
    <!-- Header -->
    <h2 class="m-0">Settings</h2>

    <!-- Branding -->
    <PCard>
      <template #title>Branding</template>
      <div class="grid formgrid p-fluid">
        <div class="col-12 md:col-6">
          <label class="mb-2 block">Display name</label>
          <PInputText v-model="displayName" placeholder="e.g., Scott Sandie" />
        </div>
        <div class="col-12 md:col-6">
          <label class="mb-2 block">Brokerage</label>
          <PInputText v-model="brokerage" placeholder="e.g., Sandie Realty" />
        </div>
        <div class="col-12 md:col-6">
          <label class="mb-2 block">Theme color</label>
          <input type="color" v-model="themeColor" style="height:40px;width:64px;border:none;background:transparent;cursor:pointer;" />
        </div>
        <div class="col-12 md:col-6">
          <label class="mb-2 block">Logo URL (placeholder for upload)</label>
          <PInputText v-model="logoUrl" placeholder="https://..." />
        </div>
        <div class="col-12">
          <PButton :loading="savingProfile" label="Save branding" icon="pi pi-check" @click="saveProfile" />
        </div>
      </div>
    </PCard>

    <!-- Handle -->
    <PCard>
      <template #title>Public handle</template>
      <div class="grid formgrid p-fluid">
        <div class="col-12 md:col-6">
          <label class="mb-2 block">Handle</label>
          <PInputText v-model="newHandle" placeholder="e.g., scottsmith or sandieteam" />
          <small class="text-600">Lowercase letters, numbers, hyphens; start with a letter; 3–32 chars.</small>
        </div>
        <div class="col-12 md:col-6">
          <label class="mb-2 block">Your links</label>
          <div class="flex gap-2 align-items-center">
            <code class="overflow-hidden text-overflow-ellipsis white-space-nowrap">{{ publicProfileUrl || '—' }}</code>
            <PButton v-if="publicProfileUrl" icon="pi pi-copy" text @click="copy(publicProfileUrl, 'Profile copied')" />
          </div>
          <div class="flex gap-2 align-items-center mt-2">
            <code class="overflow-hidden text-overflow-ellipsis white-space-nowrap">{{ magicSubmitUrl || '—' }}</code>
            <PButton v-if="magicSubmitUrl" icon="pi pi-copy" text @click="copy(magicSubmitUrl, 'Magic link copied')" />
          </div>
        </div>
        <div class="col-12">
          <PButton :loading="savingHandle" label="Save handle" icon="pi pi-hashtag" @click="saveHandle" />
        </div>
      </div>
    </PCard>

    <!-- Review Links -->
    <PCard>
      <template #title>Review links</template>
      <div class="grid formgrid p-fluid">
        <div v-for="row in links" :key="row.platform" class="col-12 md:col-6">
          <label class="mb-2 block text-capitalize">{{ row.platform }} URL</label>
          <PInputText v-model="row.url" placeholder="https://..." />
          <small class="text-600">Paste your direct review page link.</small>
        </div>
        <div class="col-12">
          <PButton :loading="savingLinks" label="Save links" icon="pi pi-link" @click="saveLinks" />
        </div>
      </div>
    </PCard>
  </div>
</template>
