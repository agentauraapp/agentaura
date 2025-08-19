<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from './useAuth'

const { signIn, signUp, resetPassword, authError } = useAuth()
const router = useRouter()
const next = (useRoute().query.next as string) || '/app'

const mode = ref<'signin'|'signup'|'reset'>('signin')
const email = ref(''); const password = ref(''); const status = ref('')

async function doSignIn(){
  status.value = 'Signing in…'
  const { error } = await signIn(email.value.trim(), password.value)
  status.value = error ? '' : 'Success!'
  if (!error) router.push(next)
}
async function doSignUp(){
  status.value = 'Creating account…'
  const { error } = await signUp(email.value.trim(), password.value)
  if (!error) {
    // If email confirmations are OFF, they can sign in immediately with the same password.
    status.value = 'Account created. You can sign in now.'
    mode.value = 'signin'
  } else {
    status.value = ''
  }
}
async function doReset(){
  status.value = 'Sending reset email…'
  const { error } = await resetPassword(email.value.trim())
  status.value = error ? '' : 'Check your email for a reset link.'
}
</script>

<template>
  <div style="max-width:420px;margin:40px auto;display:grid;gap:12px">
    <h1 v-if="mode==='signin'">Sign in</h1>
    <h1 v-else-if="mode==='signup'">Create account</h1>
    <h1 v-else>Reset password</h1>

    <input v-model="email" type="email" placeholder="you@email.com" required />
    <input v-if="mode!=='reset'" v-model="password" type="password" placeholder="password" required />

    <button v-if="mode==='signin'" @click="doSignIn">Sign in</button>
    <button v-else-if="mode==='signup'" @click="doSignUp">Create account</button>
    <button v-else @click="doReset">Send reset link</button>

    <small style="color:#ef4444" v-if="authError">{{ authError }}</small>
    <small style="opacity:.7" v-if="status">{{ status }}</small>

    <div style="display:flex;gap:8px;justify-content:space-between;margin-top:8px">
      <a href="#" @click.prevent="mode='signin'">Sign in</a>
      <a href="#" @click.prevent="mode='signup'">Create account</a>
      <a href="#" @click.prevent="mode='reset'">Reset password</a>
    </div>
  </div>
</template>
