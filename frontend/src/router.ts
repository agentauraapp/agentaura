import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from './useAuth'

const routes = [
  { path: '/', component: () => import('./pages/Landing.vue') },
  { path: '/pricing', component: () => import('./pages/Pricing.vue') },
  { path: '/login', component: () => import('./pages/Login.vue') },
  { path: '/magic-submit', component: () => import('./pages/MagicSubmit.vue') }, // public form
  { path: '/app', component: () => import('./pages/AppHome.vue'), meta: { requiresAuth: true } }, // tester area
]

const router = createRouter({ history: createWebHistory(), routes })
router.beforeEach((to) => {
  const { user } = useAuth()
  if (to.meta.requiresAuth && !user.value) return { path: '/login', query: { next: to.fullPath } }
})
export default router
