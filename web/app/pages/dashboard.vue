<template>
  <div>
    <!-- Welcome Card -->
    <div class="bg-gradient-to-r from-forest-600 to-forest-700 rounded-xl p-6 text-white mb-8">
      <h2 class="text-2xl font-bold mb-2">Welcome back, {{ firstName }}!</h2>
      <p class="text-forest-100">Here's what's happening with your production today.</p>
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div 
        v-for="stat in stats" 
        :key="stat.label"
        class="bg-white rounded-xl p-6 border border-gray-100 shadow-sm"
      >
        <div class="flex items-center justify-between mb-4">
          <div 
            class="w-12 h-12 rounded-lg flex items-center justify-center"
            :class="stat.bgColor"
          >
            <Icon :name="stat.icon" class="w-6 h-6" :class="stat.iconColor" />
          </div>
          <span 
            v-if="stat.change"
            class="text-sm font-medium px-2 py-1 rounded-full"
            :class="stat.change > 0 ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'"
          >
            {{ stat.change > 0 ? '+' : '' }}{{ stat.change }}%
          </span>
        </div>
        <p class="text-2xl font-bold text-gray-900">{{ stat.value }}</p>
        <p class="text-sm text-gray-500 mt-1">{{ stat.label }}</p>
      </div>
    </div>

    <!-- Two Column Layout -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <!-- Recent Activity -->
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div class="px-6 py-4 border-b border-gray-100">
          <h3 class="text-lg font-semibold text-gray-900">Recent Activity</h3>
        </div>
        <div class="divide-y divide-gray-100">
          <div 
            v-for="activity in recentActivity" 
            :key="activity.id"
            class="px-6 py-4 flex items-start gap-4"
          >
            <div 
              class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              :class="activity.bgColor"
            >
              <Icon :name="activity.icon" class="w-5 h-5" :class="activity.iconColor" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900">{{ activity.title }}</p>
              <p class="text-sm text-gray-500">{{ activity.description }}</p>
            </div>
            <span class="text-xs text-gray-400 whitespace-nowrap">{{ activity.time }}</span>
          </div>
        </div>
        <div class="px-6 py-4 border-t border-gray-100">
          <button class="text-sm text-forest-600 hover:text-forest-700 font-medium">
            View all activity →
          </button>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div class="px-6 py-4 border-b border-gray-100">
          <h3 class="text-lg font-semibold text-gray-900">Quick Actions</h3>
        </div>
        <div class="p-6 grid grid-cols-2 gap-4">
          <button 
            v-for="action in quickActions"
            :key="action.label"
            class="flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-forest-300 hover:bg-forest-50 transition-colors group"
          >
            <div class="w-12 h-12 rounded-xl bg-gray-100 group-hover:bg-forest-100 flex items-center justify-center transition-colors">
              <Icon :name="action.icon" class="w-6 h-6 text-gray-600 group-hover:text-forest-600" />
            </div>
            <span class="text-sm font-medium text-gray-700 group-hover:text-forest-700">{{ action.label }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Low Stock Alert (if any) -->
    <div class="mt-8 bg-amber-50 border border-amber-200 rounded-xl p-6">
      <div class="flex items-start gap-4">
        <div class="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <Icon name="lucide:alert-triangle" class="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h4 class="text-sm font-semibold text-amber-800">Low Stock Alert</h4>
          <p class="text-sm text-amber-700 mt-1">3 items are running low on stock and may need to be reordered soon.</p>
          <button class="mt-3 text-sm font-medium text-amber-800 hover:text-amber-900">
            View inventory →
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})

const { user } = useAuth()

const firstName = computed(() => {
  if (!user.value?.name) return ''
  return user.value.name.split(' ')[0]
})

// Placeholder stats - these would come from API
const stats = [
  { 
    label: 'Total Products', 
    value: '248', 
    icon: 'lucide:package', 
    bgColor: 'bg-blue-100', 
    iconColor: 'text-blue-600',
    change: 12 
  },
  { 
    label: 'Active Orders', 
    value: '18', 
    icon: 'lucide:clipboard-list', 
    bgColor: 'bg-green-100', 
    iconColor: 'text-green-600',
    change: 8 
  },
  { 
    label: 'Production Runs', 
    value: '6', 
    icon: 'lucide:factory', 
    bgColor: 'bg-purple-100', 
    iconColor: 'text-purple-600',
    change: -2 
  },
  { 
    label: 'Low Stock Items', 
    value: '3', 
    icon: 'lucide:alert-triangle', 
    bgColor: 'bg-amber-100', 
    iconColor: 'text-amber-600',
    change: null 
  },
]

// Placeholder activity
const recentActivity = [
  {
    id: 1,
    title: 'New order received',
    description: 'Order #1234 from Metro Foods',
    time: '2m ago',
    icon: 'lucide:shopping-cart',
    bgColor: 'bg-green-100',
    iconColor: 'text-green-600',
  },
  {
    id: 2,
    title: 'Production completed',
    description: 'Batch #567 - Organic Granola',
    time: '1h ago',
    icon: 'lucide:check-circle',
    bgColor: 'bg-blue-100',
    iconColor: 'text-blue-600',
  },
  {
    id: 3,
    title: 'Inventory updated',
    description: 'Received 500kg of organic oats',
    time: '3h ago',
    icon: 'lucide:package',
    bgColor: 'bg-purple-100',
    iconColor: 'text-purple-600',
  },
  {
    id: 4,
    title: 'Quality check passed',
    description: 'Batch #566 approved for shipping',
    time: '5h ago',
    icon: 'lucide:shield-check',
    bgColor: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
  },
]

// Quick actions
const quickActions = [
  { label: 'Add Product', icon: 'lucide:plus-circle' },
  { label: 'New Order', icon: 'lucide:file-plus' },
  { label: 'Start Production', icon: 'lucide:play-circle' },
  { label: 'Run Report', icon: 'lucide:bar-chart-3' },
]
</script>
