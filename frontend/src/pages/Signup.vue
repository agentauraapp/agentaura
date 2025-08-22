<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useRouter } from 'vue-router'

const router = useRouter()
const { signUp, loading, error } = useAuth()
const email = ref('')
thePassword: const password = ref('')
const confirm = ref('')
const creating = ref(false)

async function submit() {
  if (!email.value || !password.value || password.value !== confirm.value) {
    alert('Please provide matching passwords.')
    return
  }
  creating.value = true
  try {
    await signUp(email.value.trim().toLowerCase(), password.value)
    alert('Account created. Please sign in.')
    router.replace({ name: 'login' })
  } catch (_) {
    /* error shown below */
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

      <button class="w-full px-4 py-2 bg-black text-white rounded" :disabled="creating || loading">
        {{ creating ? 'Creating…' : 'Sign up' }}
      </button>

      <p v-if="error" class="text-red-600">{{ error }}</p>
      <RouterLink class="text-sm underline" :to="{ name: 'login' }">Already have an account? Log in</RouterLink>
    </form>
  </main>
</template>
