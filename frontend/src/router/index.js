// src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '../pages/Dashboard.vue'
import NewRequest from '../pages/NewRequest.vue' // build next

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: Dashboard },
    { path: '/requests/new', name: 'request-new', component: NewRequest }
  ]
})
