<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const { signIn, resetPassword, loading, error, user } = useAuth()

const email = ref('')
const password = ref('')
const sending = ref(false)
const resetting = ref(false)

async function submit() {
  if (!email.value || !password.value) return
  sending.value = true
  try {
    await signIn(email.value.trim().toLowerCase(), password.value)
    const redirect = (route.query.redirect as string) || '/'
    router.replace(redirect)
  } catch (_) {
    /* error is exposed via useAuth().error */
  } finally {
    sending.value = false
  }
}

async function sendReset() {
  if (!email.value) return
  resetting.value = true
  try {
    await resetPassword(email.value.trim().toLowerCase())
    alert('Password reset email sent.')
  } finally {
    resetting.value = false
  }
}
</script>

<template>
  <main class="max-w-md mx-auto p-6 space-y-6">
    <h1 class="text-2xl font-semibold">Log in</h1>

    <form class="space-y-3" @submit.prevent="submit">
      <div>
        <label class="block text-sm mb-1" for="email">Email</label>
        <input id="email" v-model="email" type="email" required class="border rounded p-2 w-full" />
      </div>

      <div>
        <label class="block text-sm mb-1" for="password">Password</label>
        <input id="password" v-model="password" type="password" required class="border rounded p-2 w-full" />
      </div>

      <button class="w-full px-4 py-2 bg-black text-white rounded" :disabled="sending || loading">
        {{ sending ? 'Signing in…' : 'Sign in' }}
      </button>

      <button type="button" class="w-full px-4 py-2 border rounded" :disabled="resetting || !email"
              @click="sendReset">
        {{ resetting ? 'Sending…' : 'Forgot password?' }}
      </button>

      <p v-if="error" class="text-red-600">{{ error }}</p>
      <p v-if="user" class="text-green-700">Signed in as {{ user.email }}</p>
    </form>

    <RouterLink class="text-sm underline" :to="{ name: 'signup' }">Need an account? Sign up</RouterLink>
  </main>
</template>
