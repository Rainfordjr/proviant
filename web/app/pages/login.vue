<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
    <div class="max-w-md w-full">
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-forest-950">Proviant</h1>
        <p class="text-slate-blue-500 mt-2">Sign in to your account</p>
      </div>

      <form @submit.prevent="handleLogin" class="bg-white p-8 rounded-lg shadow">
        <div v-if="error" class="mb-4 p-3 bg-red-100 text-red-700 rounded">
          {{ error }}
        </div>

        <div class="mb-4">
          <label class="block text-gray-700 mb-2">Email</label>
          <input
            v-model="email"
            type="email"
            required
            class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-500"
          />
        </div>

        <div class="mb-6">
          <label class="block text-gray-700 mb-2">Password</label>
          <input
            v-model="password"
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
          {{ loading ? 'Signing in...' : 'Sign In' }}
        </button>

        <p class="mt-4 text-center text-gray-600">
          Don't have an account?
          <NuxtLink to="/register" class="text-forest-700 hover:underline">Register</NuxtLink>
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

const { login } = useAuth()
const router = useRouter()

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

const handleLogin = async () => {
  loading.value = true
  error.value = ''

  try {
    await login(email.value, password.value)
    router.push('/dashboard')
  } catch (e: any) {
    error.value = e.data?.message || 'Login failed'
  } finally {
    loading.value = false
  }
}
</script>
