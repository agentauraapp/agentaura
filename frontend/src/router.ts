import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'

// Keep ONLY routes that you KNOW exist on disk:
const AgentProfile = () => import('./views/AgentProfile.vue') // adjust if path differs

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/agent' },
  { path: '/agent', name: 'AgentProfile', component: AgentProfile },

  // simple 404 so unknown paths don't crash
  { path: '/:pathMatch(.*)*', name: 'NotFound', component: { template: '<div class="p-4">Not found</div>' } }
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
