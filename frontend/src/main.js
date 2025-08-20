import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import PrimeVue from 'primevue/config'

// PrimeVue core + theme
import PrimeVue from 'primevue/config'
import Aura from 'primevue/themes/aura' // or Lara if you prefer
import 'primeflex/primeflex.css'
import 'primeicons/primeicons.css'

// PrimeVue global components you’ll use a lot
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Card from 'primevue/card'
import Menubar from 'primevue/menubar'
import Dialog from 'primevue/dialog'
import Textarea from 'primevue/textarea'
import ToastService from 'primevue/toastservice'
import Toast from 'primevue/toast'
import ProgressBar from 'primevue/progressbar'

// PrimeFlex utilities & icons
import 'primeflex/primeflex.css'
import 'primeicons/primeicons.css'
// PrimeVue base style (required)
import 'primevue/resources/primevue.min.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(PrimeVue, { theme: { preset: Aura } })
app.use(ToastService)

// Register most-used components globally
app.component('PButton', Button)
app.component('PInputText', InputText)
app.component('PPassword', Password)
app.component('PCard', Card)
app.component('PMenubar', Menubar)
app.component('PDialog', Dialog)
app.component('PTextarea', Textarea)
app.component('PToast', Toast)
app.component('PProgressBar', ProgressBar)

app.mount('#app')
