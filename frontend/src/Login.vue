<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../useAuth'

const { signInWithEmailLink } = useAuth()
const email = ref('')
const status = ref('')
const router = useRouter()
const route = useRoute()

async function submit(){
  status.value = 'Sending magic link…'
  const { error } = await signInWithEmailLink(email.value.trim())
  status.value = error ? error.message : 'Check your email for a sign-in link.'
  if(!error){
    // After clicking email link, Supabase redirects back; user will be logged in → route guard lets them in
    setTimeout(()=> router.push((route.query.next as string) || '/app'), 2000)
  }
}
</script>

<template>
  <div style="max-width:420px;margin:40px auto">
    <h1>Welcome back</h1>
    <p style="opacity:.7">Enter your email — we’ll send a sign-in link.</p>
    <form @submit.prevent="submit" style="display:grid;gap:12px;margin-top:12px">
      <input v-model="email" type="email" required placeholder="you@email.com" />
      <button>Send magic link</button>
      <div style="font-size:12px;opacity:.7">{{ status }}</div>
    </form>
  </div>
</template>
