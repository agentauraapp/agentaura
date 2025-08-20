<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useAuthStore } from '../stores/auth'
import { supabase } from '../supabase'

const toast = useToast()
const auth = useAuthStore()

const API = import.meta.env.VITE_API_BASE

/* ---------------------------
   Helper to call backend with JWT
---------------------------- */
async function authedFetch(path: string, init: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  })
}

/* ---------------------------
   Reactive state
---------------------------- */
const loading = ref(true)
const profile = ref<{ display_name?: string | null } | null>(null)
const handle = ref<string>('')                 // @handle
const reviewLinks = ref<{ platform: string; url: string; verified: boolean }[]>([])
const reviews = ref<any[]>([])                 // latest 10
const savingHandle = ref(false)
const newHandle = ref('')

/* ---------------------------
   Derived
---------------------------- */
const userEmail = computed(() => auth.user?.email || '')
const welcomeName = computed(() => profile.value?.display_name || userEmail.value || 'Agent')
const publicProfileUrl = computed(() =>
  handle.value ? `${location.origin}/@${encodeURIComponent(handle.value)}` : ''
)
const magicSubmitUrl = computed(() =>
  handle.value ? `${location.origin}/magic-submit?a=${encodeURIComponent(handle.value)}` : ''
)

const checklist = computed(() => {
  return [
    { key: 'handle',    label: 'Claim your public handle', done: !!handle.value, action: () => showHandleEditor() },
    { key: 'branding',  label: 'Add your branding (name/logo/theme)', done: !!profile.value?.display_name, action: () => goSettings() },
    { key: 'links',     label: 'Connect your review links', done: reviewLinks.value.length > 0, action: () => goSettings() },
    { key: 'request',   label: 'Send your first review request', done: false, action: () => goNewRequest() }
  ]
})

/* ---------------------------
   Actions
---------------------------- */
function goSettings(){ window.location.href = '/app/settings' }
function goNewRequest(){ window.location.href = '/app/requests/new' }

async function copy(text: string, label = 'Copied!') {
  try {
    await navigator.clipboard.writeText(text)
    toast.add({ severity: 'success', summary: label, life: 1500 })
  } catch {
    toast.add({ severity: 'warn', summary: 'Copy failed', detail: text, life: 2500 })
  }
}

function showHandleEditor() {
  newHandle.value = handle.value || ''
  handleDialog.value = true
}

const handleDialog = ref(false)
async function saveHandle() {
  if (!newHandle.value) {
    toast.add({ severity: 'warn', summary: 'Please enter a handle' })
    return
  }
  savingHandle.value = true
  try {
    const r = await authedFetch('/api/agents/handle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle: newHandle.value })
    })
    const j = await r.json()
    if (!r.ok) throw new Error(j.error || 'Failed to save handle')
    handle.value = j.handle
    toast.add({ severity: 'success', summary: 'Handle saved' })
    handleDialog.value = false
  } catch (e:any) {
    toast.add({ severity: 'error', summary: 'Could not save handle', detail: e.message })
  } finally {
    savingHandle.value = false
  }
}

/* ---------------------------
   Loaders
---------------------------- */
async function loadProfile() {
  // upsert a minimal profile for this agent if needed
  await authedFetch('/api/agents/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ display_name: profile.value?.display_name || null })
  }).catch(()=>{}) // ignore for now

  // handle
  const h = await authedFetch('/api/agents/handle')
  const hj = await h.json()
  handle.value = hj.handle || ''
  // review links (optional endpoint; if you don't have it yet, leave empty)
  try {
    const rl = await authedFetch('/api/review-links') // optional; safe to ignore if 404
    if (rl.ok) {
      const rlj = await rl.json()
      reviewLinks.value = rlj.links || []
    }
  } catch {}
}

async function loadReviews() {
  const r = await authedFetch('/api/reviews?limit=10')
  const j = await r.json()
  reviews.value = Array.isArray(j.reviews) ? j.reviews : []
}

onMounted(async () => {
  if (auth.loading) await auth.init()
  profile.value = { display_name: null } // placeholder; you can fetch a real profile later
  await Promise.all([loadProfile(), loadReviews()])
  loading.value = false
})
</script>

<template>
  <div class="grid gap-3 md:gap-4">
    <!-- Header -->
    <PCard class="surface-card">
      <template #title>
        <div class="flex align-items-center justify-content-between">
          <div class="text-lg md:text-2xl">Welcome, {{ welcomeName }}</div>
          <div class="hidden md:flex gap-2">
            <PButton label="New Request" icon="pi pi-send" @click="goNewRequest" />
            <PButton label="Settings" icon="pi pi-cog" severity="secondary" text @click="goSettings" />
          </div>
        </div>
      </template>
      <template #content>
        <div class="text-700">Let’s get you set up and collecting reviews in minutes.</div>
      </template>
    </PCard>

    <!-- Public links -->
    <div class="grid">
      <div class="col-12 lg:col-6">
        <PCard>
          <template #title> Your public links </template>
          <div class="flex flex-column gap-3">
            <div class="flex flex-column">
              <span class="text-700 mb-1">Public profile</span>
              <div class="flex gap-2 align-items-center">
                <code class="overflow-hidden white-space-nowrap text-overflow-ellipsis">{{ publicProfileUrl || 'No handle yet' }}</code>
                <PButton v-if="publicProfileUrl" icon="pi pi-copy" text @click="copy(publicProfileUrl, 'Profile link copied')" />
                <PButton v-else label="Claim handle" size="small" @click="showHandleEditor" />
              </div>
            </div>
            <div class="flex flex-column">
              <span class="text-700 mb-1">Magic submit link</span>
              <div class="flex gap-2 align-items-center">
                <code class="overflow-hidden white-space-nowrap text-overflow-ellipsis">{{ magicSubmitUrl || 'No handle yet' }}</code>
                <PButton v-if="magicSubmitUrl" icon="pi pi-copy" text @click="copy(magicSubmitUrl, 'Magic link copied')" />
                <PButton v-else label="Claim handle" size="small" @click="showHandleEditor" />
              </div>
            </div>
          </div>
        </PCard>
      </div>

      <!-- Onboarding checklist -->
      <div class="col-12 lg:col-6">
        <PCard>
          <template #title> Get set up (2–3 mins) </template>
          <div class="flex flex-column gap-2">
            <div v-for="item in checklist" :key="item.key" class="flex align-items-center justify-content-between">
              <div class="flex align-items-center gap-2">
                <i :class="['pi', item.done ? 'pi-check-circle text-green-500' : 'pi-circle text-500']"></i>
                <span :class="item.done ? 'text-green-600' : ''">{{ item.label }}</span>
              </div>
              <PButton
                :label="item.done ? 'Done' : 'Do it'"
                size="small"
                :severity="item.done ? 'success' : 'primary'"
                :text="item.done"
                @click="item.action()"
              />
            </div>
          </div>
        </PCard>
      </div>
    </div>

    <!-- Quick actions -->
    <div class="grid">
      <div class="col-12 lg:col-4">
        <PCard>
          <template #title>Send a review request</template>
          <template #content>
            <div class="text-700 mb-3">Email or text a client with your pre-filled review flow.</div>
            <PButton label="New Request" icon="pi pi-send" class="w-full" @click="goNewRequest" />
          </template>
        </PCard>
      </div>
      <div class="col-12 lg:col-4">
        <PCard>
          <template #title>Customize branding</template>
          <template #content>
            <div class="text-700 mb-3">Add your logo, color, and display name.</div>
            <PButton label="Open Settings" icon="pi pi-image" class="w-full" severity="secondary" @click="goSettings" />
          </template>
        </PCard>
      </div>
      <div class="col-12 lg:col-4">
        <PCard>
          <template #title>Connect review links</template>
          <template #content>
            <div class="text-700 mb-3">
              Add Google, Facebook, Zillow, and Realtor.com so clients can post with one tap.
            </div>
            <PButton label="Add Links" icon="pi pi-link" class="w-full" severity="secondary" @click="goSettings" />
          </template>
        </PCard>
      </div>
    </div>

    <!-- Recent reviews -->
    <PCard>
      <template #title> Recent reviews </template>
      <template #content>
        <div v-if="loading" class="py-3">
          <PProgressBar mode="indeterminate" style="height: 6px" />
        </div>
        <div v-else-if="!reviews.length" class="text-700">No reviews yet. Send your first request!</div>
        <ul v-else class="list-none p-0 m-0 flex flex-column gap-2">
          <li v-for="r in reviews" :key="r.id" class="p-3 border-1 surface-border border-round">
            <div class="flex align-items-center gap-2">
              <span class="font-medium">{{ r.rating ?? '—' }}⭐</span>
              <small class="text-600">{{ new Date(r.created_at).toLocaleString() }}</small>
            </div>
            <div class="mt-2">{{ r.text }}</div>
            <small v-if="r.client_name" class="text-600 mt-1 block">— {{ r.client_name }}</small>
          </li>
        </ul>
      </template>
    </PCard>

    <!-- Handle Dialog -->
    <PDialog v-model:visible="handleDialog" modal header="Claim your handle" :style="{ width: '28rem' }">
      <div class="flex flex-column gap-2">
        <label for="handle">Pick something short and professional</label>
        <PInputText id="handle" v-model="newHandle" placeholder="e.g. scottsmith, sandieteam" />
        <small class="text-600">Lowercase letters, numbers, and hyphens. Starts with a letter. 3–32 chars.</small>
        <div class="flex justify-content-end gap-2 mt-2">
          <PButton label="Cancel" text @click="handleDialog=false" />
          <PButton label="Save" :loading="savingHandle" @click="saveHandle" />
        </div>
      </div>
    </PDialog>
  </div>
</template>
