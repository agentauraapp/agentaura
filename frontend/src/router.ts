import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'

// point ONLY to files that really exist right now
const AgentProfile = () => import('@/views/AgentProfile.vue')

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/agent' },
  { path: '/agent', name: 'AgentProfile', component: AgentProfile },

  // simple 404
  { path: '/:pathMatch(.*)*', name: 'NotFound', component: { template: '<div class="p-4">Not found</div>' } }
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
