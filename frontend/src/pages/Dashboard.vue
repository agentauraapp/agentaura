<!-- src/pages/Dashboard.vue -->
<template><main class="p-6">Dashboard OK</main></template>
<script setup lang="ts">
  import { supabase } from '@/lib/supabase'
supabase.auth.getUser().then(r => console.log('auth user', r.data.user))
</script>
