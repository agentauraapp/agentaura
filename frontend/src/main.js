import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

// PrimeVue v4: single import + theme preset
import PrimeVue from 'primevue/config'
import Aura from 'primevue/themes/aura'

// Styles
import 'primeflex/primeflex.css'
import 'primeicons/primeicons.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(PrimeVue, {
  theme: { preset: Aura }
})

app.mount('#app')
