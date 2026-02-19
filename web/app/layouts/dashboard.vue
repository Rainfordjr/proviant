<template>
  <div class="min-h-screen bg-gray-50 flex">
    <!-- Sidebar -->
    <aside 
      class="fixed inset-y-0 left-0 z-30 w-64 bg-forest-950 text-white transform transition-transform duration-200 ease-in-out lg:translate-x-0"
      :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <!-- Logo -->
      <div class="h-16 flex items-center px-6 border-b border-forest-800">
        <NuxtLink to="/dashboard" class="flex items-center gap-3">
          <div class="w-8 h-8 bg-forest-500 rounded-lg flex items-center justify-center">
            <Icon name="lucide:leaf" class="w-5 h-5 text-white" />
          </div>
          <span class="text-xl font-semibold tracking-tight">Proviant</span>
        </NuxtLink>
      </div>

      <!-- Company Selector -->
      <div class="px-4 py-4 border-b border-forest-800">
        <div class="bg-forest-900/50 rounded-lg px-3 py-2">
          <p class="text-xs text-forest-300 uppercase tracking-wider">Company</p>
          <p class="text-sm font-medium text-white truncate">{{ tenant?.name || 'Loading...' }}</p>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p class="px-3 text-xs font-semibold text-forest-400 uppercase tracking-wider mb-2">Main</p>
        
        <NuxtLink 
          v-for="item in mainNav" 
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
          :class="isActive(item.to) 
            ? 'bg-forest-800 text-white' 
            : 'text-forest-200 hover:bg-forest-900 hover:text-white'"
        >
          <Icon :name="item.icon" class="w-5 h-5 flex-shrink-0" />
          <span>{{ item.label }}</span>
        </NuxtLink>

        <p class="px-3 text-xs font-semibold text-forest-400 uppercase tracking-wider mt-6 mb-2">Inventory</p>
        
        <NuxtLink 
          v-for="item in inventoryNav" 
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
          :class="isActive(item.to) 
            ? 'bg-forest-800 text-white' 
            : 'text-forest-200 hover:bg-forest-900 hover:text-white'"
        >
          <Icon :name="item.icon" class="w-5 h-5 flex-shrink-0" />
          <span>{{ item.label }}</span>
        </NuxtLink>

        <p class="px-3 text-xs font-semibold text-forest-400 uppercase tracking-wider mt-6 mb-2">Production</p>
        
        <NuxtLink 
          v-for="item in productionNav" 
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
          :class="isActive(item.to) 
            ? 'bg-forest-800 text-white' 
            : 'text-forest-200 hover:bg-forest-900 hover:text-white'"
        >
          <Icon :name="item.icon" class="w-5 h-5 flex-shrink-0" />
          <span>{{ item.label }}</span>
        </NuxtLink>

        <p class="px-3 text-xs font-semibold text-forest-400 uppercase tracking-wider mt-6 mb-2">Settings</p>
        
        <NuxtLink 
          v-for="item in settingsNav" 
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
          :class="isActive(item.to) 
            ? 'bg-forest-800 text-white' 
            : 'text-forest-200 hover:bg-forest-900 hover:text-white'"
        >
          <Icon :name="item.icon" class="w-5 h-5 flex-shrink-0" />
          <span>{{ item.label }}</span>
        </NuxtLink>
      </nav>

      <!-- User Section -->
      <div class="border-t border-forest-800 p-4">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 bg-forest-700 rounded-full flex items-center justify-center">
            <span class="text-sm font-medium">{{ userInitials }}</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-white truncate">{{ user?.name }}</p>
            <p class="text-xs text-forest-400 truncate">{{ user?.email }}</p>
          </div>
          <button 
            @click="handleLogout"
            class="p-2 text-forest-400 hover:text-white hover:bg-forest-800 rounded-lg transition-colors"
            title="Logout"
          >
            <Icon name="lucide:log-out" class="w-5 h-5" />
          </button>
        </div>
      </div>
    </aside>

    <!-- Mobile sidebar backdrop -->
    <div 
      v-if="sidebarOpen"
      class="fixed inset-0 z-20 bg-black/50 lg:hidden"
      @click="sidebarOpen = false"
    />

    <!-- Main Content -->
    <div class="flex-1 lg:pl-64">
      <!-- Top Header -->
      <header class="sticky top-0 z-10 h-16 bg-white border-b border-gray-200 flex items-center px-4 lg:px-8">
        <!-- Mobile menu button -->
        <button 
          @click="sidebarOpen = true"
          class="p-2 -ml-2 text-gray-500 hover:text-gray-700 lg:hidden"
        >
          <Icon name="lucide:menu" class="w-6 h-6" />
        </button>

        <!-- Page title -->
        <div class="flex-1">
          <h1 class="text-lg font-semibold text-gray-900">{{ pageTitle }}</h1>
        </div>

        <!-- Header actions -->
        <div class="flex items-center gap-2">
          <button class="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
            <Icon name="lucide:bell" class="w-5 h-5" />
          </button>
          <button class="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
            <Icon name="lucide:help-circle" class="w-5 h-5" />
          </button>
        </div>
      </header>

      <!-- Page Content -->
      <main class="p-4 lg:p-8">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { user, tenant, logout } = useAuth()

const sidebarOpen = ref(false)

// Navigation items
const mainNav = [
  { to: '/dashboard', label: 'Dashboard', icon: 'lucide:layout-dashboard' },
  { to: '/orders', label: 'Orders', icon: 'lucide:clipboard-list' },
]

const inventoryNav = [
  { to: '/ingredients', label: 'Ingredients', icon: 'lucide:wheat' },
  { to: '/products', label: 'Products', icon: 'lucide:package-check' },
  { to: '/supplies', label: 'Supplies', icon: 'lucide:boxes' },
  { to: '/categories', label: 'Categories', icon: 'lucide:folder-tree' },
]

const productionNav = [
  { to: '/recipes', label: 'Recipes', icon: 'lucide:chef-hat' },
  { to: '/production', label: 'Production Runs', icon: 'lucide:factory' },
  { to: '/quality', label: 'Quality Control', icon: 'lucide:shield-check' },
]

const settingsNav = [
  { to: '/reports', label: 'Reports', icon: 'lucide:bar-chart-3' },
  { to: '/settings', label: 'Settings', icon: 'lucide:settings' },
]

// Check if nav item is active
const isActive = (path: string) => {
  if (path === '/dashboard') {
    return route.path === '/dashboard'
  }
  return route.path.startsWith(path)
}

// Page title based on route
const pageTitle = computed(() => {
  const titles: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/ingredients': 'Ingredients',
    '/products': 'Products',
    '/supplies': 'Supplies',
    '/inventory': 'Inventory',
    '/orders': 'Orders',
    '/categories': 'Categories',
    '/recipes': 'Recipes',
    '/production': 'Production Runs',
    '/quality': 'Quality Control',
    '/reports': 'Reports',
    '/settings': 'Settings',
  }
  
  if (titles[route.path]) return titles[route.path]
  
  for (const [path, title] of Object.entries(titles)) {
    if (route.path.startsWith(path)) return title
  }
  
  return 'Proviant'
})

// User initials for avatar
const userInitials = computed(() => {
  if (!user.value?.name) return '?'
  return user.value.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
})

// Close sidebar on route change (mobile)
watch(() => route.path, () => {
  sidebarOpen.value = false
})

const handleLogout = async () => {
  await logout()
  router.push('/login')
}
</script>
