import { createRouter, createWebHistory } from 'vue-router'
import AgentProfile from '../views/AgentProfile.vue'

const routes = [
  { path: '/', redirect: '/agent' },
  { path: '/agent', name: 'AgentProfile', component: AgentProfile }
]

export default createRouter({
  history: createWebHistory(),
  routes
})
