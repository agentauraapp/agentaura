<template>
  <main style="padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial">
    <nav style="display:flex;gap:12px;margin-bottom:16px">
      <router-link to="/">Dashboard</router-link>
      <router-link to="/login">Login</router-link>
      <router-link to="/pricing">Pricing</router-link>
      <router-link to="/magic-submit">Magic Submit</router-link>
    </nav>
    <!-- This renders the current route -->
    <router-view />
  </main>
</template>
