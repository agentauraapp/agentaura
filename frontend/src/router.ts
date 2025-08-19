// frontend/src/router.ts
import { createRouter, createWebHistory } from 'vue-router'

// Use the files you actually have in /src
const Dashboard   = () => import('./AppHome.vue')
const Login       = () => import('./Login.vue')
const Pricing     = () => import('./Pricing.vue')
const MagicSubmit = () => import('./MagicSubmit.vue')

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/',             name: 'dashboard',   component: Dashboard },
    { path: '/login',        name: 'login',       component: Login },
    { path: '/pricing',      name: 'pricing',     component: Pricing },
    { path: '/magic-submit', name: 'magic',       component: MagicSubmit },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})
