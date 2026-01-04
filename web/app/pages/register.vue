<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
    <div class="max-w-md w-full">
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-forest-950">Proviant</h1>
        <p class="text-slate-blue-500 mt-2">Start your 14-day free trial</p>
      </div>

      <form @submit.prevent="handleRegister" class="bg-white p-8 rounded-lg shadow">
        <div v-if="error" class="mb-4 p-3 bg-red-100 text-red-700 rounded">
          {{ error }}
        </div>

        <div class="mb-4">
          <label class="block text-gray-700 mb-2">Company Name</label>
          <input
            v-model="form.company_name"
            type="text"
            required
            class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-500"
          />
        </div>

        <div class="mb-4">
          <label class="block text-gray-700 mb-2">Your Name</label>
          <input
            v-model="form.name"
            type="text"
            required
            class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-500"
          />
        </div>

        <div class="mb-4">
          <label class="block text-gray-700 mb-2">Email</label>
          <input
            v-model="form.email"
            type="email"
            required
            class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-500"
          />
        </div>

        <div class="mb-4">
          <label class="block text-gray-700 mb-2">Password</label>
          <input
            v-model="form.password"
            type="password"
            required
            class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-500"
          />
        </div>

        <div class="mb-6">
          <label class="block text-gray-700 mb-2">Confirm Password</label>
          <input
            v-model="form.password_confirmation"
            type="password"
            required
            class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-500"
          />
        </div>

        <button
          type="submit"
          :disabled="loading"
          class="w-full bg-forest-950 text-white py-2 rounded-lg hover:bg-forest-800 disabled:opacity-50"
        >
          {{ loading ? 'Creating account...' : 'Create Account' }}
        </button>

        <p class="mt-4 text-center text-gray-600">
          Already have an account?
          <NuxtLink to="/login" class="text-forest-700 hover:underline">Sign in</NuxtLink>
        </p>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
// Redirect to dashboard if already logged in
definePageMeta({
  middleware: 'guest'
})

const { register } = useAuth()
const router = useRouter()

const form = ref({
  company_name: '',
  name: '',
  email: '',
  password: '',
  password_confirmation: '',
})

const loading = ref(false)
const error = ref('')

const handleRegister = async () => {
  loading.value = true
  error.value = ''

  try {
    await register(form.value)
    router.push('/dashboard')
  } catch (e: any) {
    error.value = e.data?.message || 'Registration failed'
  } finally {
    loading.value = false
  }
}
</script>
