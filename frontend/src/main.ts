import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'

import App from './App.vue'
import router from './router'

// PrimeVue v3 styles (make sure you’re on primevue@^3)
import 'primeflex/primeflex.css'
import 'primeicons/primeicons.css'
import 'primevue/resources/themes/lara-light-indigo/theme.css'
import 'primevue/resources/primevue.min.css'

createApp(App)
  .use(createPinia())
  .use(router)
  .use(PrimeVue)
  .mount('#app')
