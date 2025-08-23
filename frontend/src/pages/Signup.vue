<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useRouter } from 'vue-router'

const router = useRouter()
const { signUp, loading, error } = useAuth()

const email = ref('')
const password = ref('')
const confirm = ref('')
const creating = ref(false)

async function submit() {
  if (!email.value || !password.value || password.value !== confirm.value) {
    alert('Please provide matching passwords.')
    return
  }
  creating.value = true
  try {
    await signUp(email.value.trim().toLowerCase(), password.value)
    alert('Account created. Please sign in.')
    router.replace({ name: 'login' })
  } catch (_) {
    /* error is exposed via useAuth().error */
  } finally {
    creating.value = false
  }
}
</script>
