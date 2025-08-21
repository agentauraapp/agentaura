import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'

// Only import files that actually exist
const AgentProfile = () => import('./views/AgentProfile.vue')

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/agent' },
  { path: '/agent', name: 'AgentProfile', component: AgentProfile },
  { path: '/:pathMatch(.*)*', name: 'NotFound', component: { template: '<div class="p-4">Not found</div>' } }
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
