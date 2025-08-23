<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useRouter } from 'vue-router'

const router = useRouter()
const { signUp, loading, error } = useAuth() // assuming composable exposes these
const email = ref('')
const password = ref('')
const confirm = ref('')
const creating = ref(false)
const localError = ref<string | null>(null)

async function submit() {
  localError.value = null
  if (!email.value || !password.value || password.value !== confirm.value) {
    localError.value = 'Please provide matching passwords.'
    return
  }
  creating.value = true
  try {
    // IMPORTANT: make sure the signature matches your composable:
    // Many implementations expect an object, not (email, password)
    await signUp({ email: email.value.trim().toLowerCase(), password: password.value })
    alert('Account created. Please sign in.')
    router.replace({ name: 'login' })
  } catch (e: any) {
    // surface the failure
    localError.value = e?.message ?? String(e)
    console.error('signUp failed:', e)
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <main class="max-w-md mx-auto p-6 space-y-6">
    <h1 class="text-2xl font-semibold">Create account</h1>

    <form class="space-y-3" @submit.prevent="submit">
      <div>
        <label class="block text-sm mb-1" for="email">Email</label>
        <input id="email" v-model="email" type="email" required class="border rounded p-2 w-full" />
      </div>

      <div>
        <label class="block text-sm mb-1" for="password">Password</label>
        <input id="password" v-model="password" type="password" minlength="6" required class="border rounded p-2 w-full" />
      </div>

      <div>
        <label class="block text-sm mb-1" for="confirm">Confirm password</label>
        <input id="confirm" v-model="confirm" type="password" minlength="6" required class="border rounded p-2 w-full" />
      </div>

      <button type="submit" class="w-full px-4 py-2 bg-black text-white rounded"
        :disabled="creating || loading">
  {{ creating ? 'Creating…' : 'Sign up' }}
</button>

      <!-- show either the composable error or localError -->
      <p v-if="localError" class="text-red-600">{{ localError }}</p>
      <p v-else-if="error" class="text-red-600">{{ error }}</p>

      <RouterLink class="text-sm underline" :to="{ name: 'login' }">
        Already have an account? Log in
      </RouterLink>
    </form>
  </main>
</template>
