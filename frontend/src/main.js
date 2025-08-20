import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import App from './App.vue'
import router from './router'

import 'primeflex/primeflex.css'
import 'primeicons/primeicons.css'
import 'primevue/resources/themes/lara-light-indigo/theme.css' // pick any v3 theme
import 'primevue/resources/primevue.min.css'

createApp(App).use(createPinia()).use(router).use(PrimeVue).mount('#app')
