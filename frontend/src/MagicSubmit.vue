<script setup lang="ts">
import { ref } from 'vue'
const API = import.meta.env.VITE_API_BASE

const rating = ref(0)
const text = ref('')
const name = ref('')
const email = ref('')
const sent = ref(false)
async function submit(){
  if(!rating.value || text.value.trim().length<10) return alert('Pick a rating and add a short review.')
  const res = await fetch(`${API}/api/reviews/submit`, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ rating: rating.value, text: text.value.trim(), name: name.value || undefined, email: email.value || undefined })
  })
  sent.value = res.ok
}
</script>

<template>
  <div style="max-width:560px;margin:24px auto">
    <h1>Leave a quick review</h1>
    <p style="opacity:.7">One form posts where it matters—no accounts required.</p>

    <div style="display:flex;gap:6px;margin:12px 0">
      <button v-for="n in 5" :key="n" @click="rating=n" style="font-size:24px">{{ n<=rating ? '⭐' : '☆' }}</button>
    </div>

    <textarea v-model="text" rows="5" placeholder="What stood out?" style="width:100%"></textarea>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
      <input v-model="name" placeholder="Your name (optional)" />
      <input v-model="email" type="email" placeholder="Email (optional)" />
    </div>
    <button @click="submit" style="margin-top:10px">Send</button>

    <p v-if="sent" style="color:#22c55e;margin-top:8px">Thanks! Your review has been received.</p>
  </div>
</template>
