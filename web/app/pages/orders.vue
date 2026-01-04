<template>
  <div>
    <div class="flex items-center justify-between mb-8">
      <div>
        <h2 class="text-2xl font-bold text-gray-900">Orders</h2>
        <p class="text-gray-500 mt-1">Track and manage customer orders</p>
      </div>
      <button class="bg-forest-600 hover:bg-forest-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors">
        <Icon name="lucide:plus" class="w-5 h-5" />
        New Order
      </button>
    </div>

    <div class="bg-white rounded-xl border border-gray-200 p-12 text-center">
      <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <Icon name="lucide:clipboard-list" class="w-8 h-8 text-gray-400" />
      </div>
      <h3 class="text-lg font-semibold text-gray-900 mb-2">Orders Module</h3>
      <p class="text-gray-500 max-w-md mx-auto">
        Manage customer orders, track fulfillment status, and handle shipping logistics.
      </p>
      <p class="text-sm text-forest-600 mt-4 font-medium">Coming Soon</p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})
</script>
