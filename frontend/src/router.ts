import { createRouter, createWebHistory } from 'vue-router'
import { user } from './useAuth'

const Dashboard   = () => import('./AppHome.vue')
const Login       = () => import('./Login.vue')
const Pricing     = () => import('./Pricing.vue')
const MagicSubmit = () => import('./MagicSubmit.vue')

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/',             name: 'dashboard', component: Dashboard },
    { path: '/login',        name: 'login',     component: Login },
    { path: '/pricing',      name: 'pricing',   component: Pricing },
    { path: '/magic-submit', name: 'magic',     component: MagicSubmit },
    { path: '/app',          name: 'app',       component: Dashboard, meta:{ requiresAuth:true } },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})

router.beforeEach((to) => {
  if (to.meta.requiresAuth && !user.value) return { path: '/login', query: { next: to.fullPath } }
})
export default router
