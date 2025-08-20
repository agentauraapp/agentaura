import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from './stores/auth'

const routes = [
  { path: '/', component: () => import('./pages/Landing.vue') },
  { path: '/login', component: () => import('./pages/Login.vue') },
  { path: '/signup', component: () => import('./pages/Signup.vue') },
  { path: '/magic-submit', component: () => import('./pages/MagicSubmit.vue') },
  { path: '/@:handle', component: () => import('./AgentPublic.vue'), props: true },
  { path: '/app', component: () => import('./pages/AppHome.vue'), meta: { auth: true } },
  { path: '/app/settings', component: () => import('./pages/Settings.vue'), meta: { auth: true } },
  { path: '/app/requests/new', component: () => import('./pages/NewRequest.vue'), meta: { auth: true } },
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (auth.loading) await auth.init()
  if (to.meta.auth && !auth.user) return '/login'
  if ((to.path === '/login' || to.path === '/signup') && auth.user) return '/app'
})

export default router
