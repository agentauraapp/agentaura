import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '@/lib/supabase'

const Dashboard = () => import('@/pages/Dashboard.vue')
const NewRequest = () => import('@/pages/NewRequest.vue')
const Login = () => import('@/pages/Login.vue')
const Signup = () => import('@/pages/Signup.vue')

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: Login },
    { path: '/signup', name: 'signup', component: Signup },
    { path: '/', name: 'dashboard', component: Dashboard, meta: { requiresAuth: true } },
    { path: '/requests/new', name: 'request-new', component: NewRequest, meta: { requiresAuth: true } },
    { path: '/magic-submit', name: 'magic-submit', component: () => import('@/pages/MagicSubmit.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})

router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) return true
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  return true
})

export default router
