<template>
  <div class="min-h-screen surface-ground text-900">
    <PMenubar :model="items" class="border-none px-3 md:px-4">
      <template #start>
        <div class="flex align-items-center gap-2">
          <i class="pi pi-sparkles text-primary-500"></i>
          <strong>Agent Aura</strong>
        </div>
      </template>
      <template #end>
        <PButton size="small" label="Dashboard" @click="$router.push('/app')" text />
        <PButton size="small" label="Logout" @click="logout" severity="secondary" text />
      </template>
    </PMenubar>

    <main class="p-3 md:p-4">
      <router-view />
    </main>

    <PToast />
  </div>
</template>

<script setup>
import { useAuthStore } from '../stores/auth'
const auth = useAuthStore()
const items = [] // optional: add menu items
const logout = () => auth.logout()
</script>

<style>
/* small helper if you want full-height */
.min-h-screen { min-height: 100vh; }
</style>
