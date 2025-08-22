import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const Dashboard   = () => import('@/pages/Dashboard.vue')
const NewRequest  = () => import('@/pages/NewRequest.vue')

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'dashboard', component: Dashboard },
  { path: '/requests/new', name: 'request-new', component: NewRequest },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
