import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const Dashboard  = () => import('@/pages/Dashboard.vue')
const NewRequest = () => import('@/pages/NewRequest.vue')

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'dashboard', component: Dashboard },
  { path: '/requests/new', name: 'request-new', component: NewRequest },
  // optional: helpful 404 to avoid a totally blank page on bad paths
  { path: '/:pathMatch(.*)*', component: { template: '<div style="padding:24px">Not found</div>' } }
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
