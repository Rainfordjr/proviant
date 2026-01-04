<template>
  <div class="min-h-screen bg-gray-50">
    <header class="bg-white shadow">
      <div class="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <h1 class="text-xl font-bold text-forest-950">Proviant</h1>
        <div class="flex items-center gap-4">
          <span class="text-gray-600">{{ user?.name }}</span>
          <button
            @click="handleLogout"
            class="text-slate-blue-500 hover:underline"
          >
            Logout
          </button>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 py-8">
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-2xl font-bold text-gray-800 mb-4">Welcome to Proviant!</h2>
        <p class="text-gray-600 mb-4">You're logged in as {{ user?.email }}</p>
        <div class="bg-forest-50 p-4 rounded-lg">
          <h3 class="font-semibold text-forest-900">Your Company</h3>
          <p class="text-forest-700">{{ tenant?.name }}</p>
          <p class="text-sm text-forest-600">Plan: {{ tenant?.plan }}</p>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
// Protect this route - requires authentication
definePageMeta({
  middleware: 'auth'
})

const { user, tenant, logout } = useAuth()
const router = useRouter()

const handleLogout = async () => {
  await logout()
  router.push('/login')
}
</script>
