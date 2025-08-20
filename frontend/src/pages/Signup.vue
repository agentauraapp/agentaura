<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { supabase } from '../supabase'
import { useForm } from 'vee-validate'
import * as yup from 'yup'

const toast = useToast()
const router = useRouter()

const { handleSubmit, errors, values, meta } = useForm({
  validationSchema: yup.object({
    email: yup.string().email().required(),
    password: yup.string().min(8).required()
  }),
  initialValues: { email: '', password: '' }
})

const onSubmit = handleSubmit(async (vals) => {
  const { data, error } = await supabase.auth.signUp({
    email: vals.email, password: vals.password
  })
  if (error) return toast.add({ severity:'error', summary:'Signup failed', detail:error.message })
  toast.add({ severity:'success', summary:'Check your email', detail:'Confirm to continue' })
  router.push('/login')
})
</script>

<template>
  <div class="grid justify-content-center">
    <PCard class="w-full sm:w-10 md:w-6 lg:w-4">
      <template #title> Create your account </template>
      <form class="p-fluid grid gap-3" @submit.prevent="onSubmit">
        <div>
          <label>Email</label>
          <PInputText v-model="values.email" type="email" autocomplete="email" />
          <small class="p-error">{{ errors.email }}</small>
        </div>
        <div>
          <label>Password</label>
          <PPassword v-model="values.password" toggleMask :feedback="false" />
          <small class="p-error">{{ errors.password }}</small>
        </div>
        <PButton type="submit" label="Create account" :disabled="!meta.valid" />
      </form>
      <template #footer>
        <small>Already have an account? <a href="/login">Log in</a></small>
      </template>
    </PCard>
  </div>
</template>
