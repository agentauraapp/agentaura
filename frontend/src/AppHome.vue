<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '../supabase'

const API = import.meta.env.VITE_API_BASE
const me = ref<any>(null)
const err = ref('')

onMounted(async () => {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  try{
    const res = await fetch(`${API}/api/me`, { headers: { Authorization: `Bearer ${token}` } })
    me.value = await res.json()
  }catch(e:any){
    err.value = e.message
  }
})
</script>

<template>
  <div style="max-width:720px;margin:24px auto">
    <h1>Tester Home</h1>
    <pre>{{ me ?? err }}</pre>
  </div>
</template>
