<template>
  <nav style="padding:12px; border-bottom:1px solid #eee">
    <a href="/">Dashboard</a> |
    <a href="/requests/new">New Request</a>
  </nav>
  <router-view />
</template>

<script setup>
// empty
</script>

<style>
html, body, #app { height: 100%; }
body { margin: 0; background: #0f172a0a; }
</style>
