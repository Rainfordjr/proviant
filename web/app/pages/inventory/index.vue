<template>
    <div>
      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">Inventory</h2>
          <p class="text-gray-500 mt-1">Manage your raw materials and finished products</p>
        </div>
        <NuxtLink 
          to="/inventory/new"
          class="bg-forest-600 hover:bg-forest-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors w-fit"
        >
          <Icon name="lucide:plus" class="w-5 h-5" />
          Add Item
        </NuxtLink>
      </div>
  
      <!-- Stats Cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p class="text-sm text-gray-500">Total Items</p>
          <p class="text-2xl font-bold text-gray-900">{{ summary?.total_items ?? '-' }}</p>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p class="text-sm text-gray-500">Active Items</p>
          <p class="text-2xl font-bold text-gray-900">{{ summary?.active_items ?? '-' }}</p>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p class="text-sm text-gray-500">Low Stock</p>
          <p class="text-2xl font-bold" :class="(summary?.low_stock_count ?? 0) > 0 ? 'text-amber-600' : 'text-gray-900'">
            {{ summary?.low_stock_count ?? '-' }}
          </p>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p class="text-sm text-gray-500">Total Value</p>
          <p class="text-2xl font-bold text-gray-900">${{ formatNumber(summary?.total_value ?? 0) }}</p>
        </div>
      </div>
  
      <!-- Filters -->
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm mb-6">
        <div class="p-4 flex flex-col sm:flex-row gap-4">
          <!-- Search -->
          <div class="flex-1">
            <div class="relative">
              <Icon name="lucide:search" class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                v-model="filters.search"
                type="text"
                placeholder="Search by name or SKU..."
                class="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-500 focus:border-transparent"
                @input="debouncedSearch"
              />
            </div>
          </div>
  
          <!-- Category Filter -->
          <select
            v-model="filters.category_id"
            class="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-500 bg-white"
            @change="loadItems"
          >
            <option :value="undefined">All Categories</option>
            <option v-for="cat in categories" :key="cat.id" :value="cat.id">
              {{ cat.name }}
            </option>
          </select>
  
          <!-- Type Filter -->
          <select
            v-model="filters.item_type"
            class="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-500 bg-white"
            @change="loadItems"
          >
            <option :value="undefined">All Types</option>
            <option value="raw_material">Raw Material</option>
            <option value="finished_product">Finished Product</option>
            <option value="packaging">Packaging</option>
            <option value="ingredient">Ingredient</option>
            <option value="supply">Supply</option>
          </select>
  
          <!-- Low Stock Toggle -->
          <button
            @click="toggleLowStock"
            class="px-4 py-2 border rounded-lg font-medium transition-colors"
            :class="filters.low_stock 
              ? 'border-amber-500 bg-amber-50 text-amber-700' 
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'"
          >
            <Icon name="lucide:alert-triangle" class="w-4 h-4 inline mr-1" />
            Low Stock
          </button>
        </div>
      </div>
  
      <!-- Items Table -->
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <!-- Loading State -->
        <div v-if="loading" class="p-12 text-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-forest-600 mx-auto"></div>
          <p class="mt-2 text-gray-500">Loading inventory...</p>
        </div>
  
        <!-- Empty State -->
        <div v-else-if="items.length === 0" class="p-12 text-center">
          <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Icon name="lucide:package" class="w-8 h-8 text-gray-400" />
          </div>
          <h3 class="text-lg font-semibold text-gray-900 mb-2">No items found</h3>
          <p class="text-gray-500 mb-4">
            {{ hasFilters ? 'Try adjusting your filters' : 'Get started by adding your first inventory item' }}
          </p>
          <NuxtLink
            v-if="!hasFilters"
            to="/inventory/new"
            class="inline-flex items-center gap-2 bg-forest-600 hover:bg-forest-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Icon name="lucide:plus" class="w-5 h-5" />
            Add Item
          </NuxtLink>
        </div>
  
        <!-- Table -->
        <table v-else class="w-full">
          <thead class="bg-gray-50 border-b border-gray-100">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Item</th>
              <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Category</th>
              <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Type</th>
              <th class="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Stock</th>
              <th class="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Cost</th>
              <th class="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr 
              v-for="item in items" 
              :key="item.id"
              class="hover:bg-gray-50 transition-colors"
            >
              <td class="px-6 py-4">
                <div>
                  <NuxtLink :to="`/inventory/${item.id}`" class="font-medium text-gray-900 hover:text-forest-600">
                    {{ item.name }}
                  </NuxtLink>
                  <p v-if="item.sku" class="text-sm text-gray-500">SKU: {{ item.sku }}</p>
                </div>
              </td>
              <td class="px-6 py-4 hidden md:table-cell">
                <span v-if="item.category" class="text-gray-600">{{ item.category.name }}</span>
                <span v-else class="text-gray-400">—</span>
              </td>
              <td class="px-6 py-4 hidden lg:table-cell">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" :class="typeColors[item.item_type]">
                  {{ typeLabels[item.item_type] }}
                </span>
              </td>
              <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-2">
                  <span 
                    class="font-medium"
                    :class="isItemLowStock(item) ? 'text-amber-600' : 'text-gray-900'"
                  >
                    {{ formatNumber(item.current_stock) }}
                  </span>
                  <span class="text-gray-500 text-sm">{{ item.unit_of_measure }}</span>
                  <Icon 
                    v-if="isItemLowStock(item)" 
                    name="lucide:alert-triangle" 
                    class="w-4 h-4 text-amber-500" 
                  />
                </div>
              </td>
              <td class="px-6 py-4 text-right hidden sm:table-cell">
                <span v-if="item.cost_price" class="text-gray-900">${{ formatNumber(item.cost_price) }}</span>
                <span v-else class="text-gray-400">—</span>
              </td>
              <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-1">
                  <NuxtLink
                    :to="`/inventory/${item.id}/edit`"
                    class="p-2 text-gray-400 hover:text-forest-600 hover:bg-forest-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Icon name="lucide:pencil" class="w-4 h-4" />
                  </NuxtLink>
                  <button
                    @click="openAdjustStock(item)"
                    class="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Adjust Stock"
                  >
                    <Icon name="lucide:plus-minus" class="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
  
        <!-- Pagination -->
        <div v-if="pagination.last_page > 1" class="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <p class="text-sm text-gray-500">
            Showing {{ (pagination.current_page - 1) * pagination.per_page + 1 }} to 
            {{ Math.min(pagination.current_page * pagination.per_page, pagination.total) }} of 
            {{ pagination.total }} items
          </p>
          <div class="flex gap-2">
            <button
              @click="goToPage(pagination.current_page - 1)"
              :disabled="pagination.current_page === 1"
              class="px-3 py-1 border border-gray-200 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              @click="goToPage(pagination.current_page + 1)"
              :disabled="pagination.current_page === pagination.last_page"
              class="px-3 py-1 border border-gray-200 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
  
      <!-- Adjust Stock Modal -->
      <div 
        v-if="adjustStockModal.open" 
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        @click.self="adjustStockModal.open = false"
      >
        <div class="bg-white rounded-xl shadow-xl w-full max-w-md">
          <div class="px-6 py-4 border-b border-gray-100">
            <h3 class="text-lg font-semibold text-gray-900">Adjust Stock</h3>
            <p class="text-sm text-gray-500">{{ adjustStockModal.item?.name }}</p>
          </div>
          <form @submit.prevent="submitAdjustStock" class="p-6">
            <div class="mb-4">
              <p class="text-sm text-gray-600 mb-2">
                Current stock: <span class="font-medium">{{ adjustStockModal.item?.current_stock }} {{ adjustStockModal.item?.unit_of_measure }}</span>
              </p>
            </div>
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-1">Adjustment</label>
              <div class="flex gap-2">
                <button
                  type="button"
                  @click="adjustStockModal.adjustment = Math.abs(adjustStockModal.adjustment) * -1"
                  class="px-4 py-2 border rounded-lg font-medium transition-colors"
                  :class="adjustStockModal.adjustment < 0 ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-600'"
                >
                  − Remove
                </button>
                <button
                  type="button"
                  @click="adjustStockModal.adjustment = Math.abs(adjustStockModal.adjustment)"
                  class="px-4 py-2 border rounded-lg font-medium transition-colors"
                  :class="adjustStockModal.adjustment >= 0 ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600'"
                >
                  + Add
                </button>
              </div>
            </div>
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
              <input
                v-model.number="adjustStockModal.quantity"
                type="number"
                min="0"
                step="0.001"
                class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-500"
                required
              />
            </div>
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
              <input
                v-model="adjustStockModal.reason"
                type="text"
                placeholder="e.g., Received shipment, Used in production"
                class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-500"
              />
            </div>
            <div class="flex gap-3">
              <button
                type="button"
                @click="adjustStockModal.open = false"
                class="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="adjustStockModal.loading"
                class="flex-1 px-4 py-2 bg-forest-600 text-white rounded-lg hover:bg-forest-700 disabled:opacity-50 transition-colors"
              >
                {{ adjustStockModal.loading ? 'Saving...' : 'Save' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
  import type { Item, Category, InventorySummary } from '~/composables/useInventory'
  
  definePageMeta({
    layout: 'dashboard',
    middleware: 'auth'
  })
  
  const { getItems, getCategories, getInventorySummary, adjustStock } = useInventory()
  
  // State
  const loading = ref(true)
  const items = ref<Item[]>([])
  const categories = ref<Category[]>([])
  const summary = ref<InventorySummary | null>(null)
  
  const filters = ref({
    search: '',
    category_id: undefined as number | undefined,
    item_type: undefined as string | undefined,
    low_stock: false,
  })
  
  const pagination = ref({
    current_page: 1,
    last_page: 1,
    per_page: 25,
    total: 0,
  })
  
  const adjustStockModal = ref({
    open: false,
    item: null as Item | null,
    adjustment: 1,
    quantity: 0,
    reason: '',
    loading: false,
  })
  
  // Type display helpers
  const typeLabels: Record<string, string> = {
    raw_material: 'Raw Material',
    finished_product: 'Finished',
    packaging: 'Packaging',
    ingredient: 'Ingredient',
    supply: 'Supply',
  }
  
  const typeColors: Record<string, string> = {
    raw_material: 'bg-blue-100 text-blue-800',
    finished_product: 'bg-green-100 text-green-800',
    packaging: 'bg-purple-100 text-purple-800',
    ingredient: 'bg-orange-100 text-orange-800',
    supply: 'bg-gray-100 text-gray-800',
  }
  
  // Computed
  const hasFilters = computed(() => {
    return filters.value.search || filters.value.category_id || filters.value.item_type || filters.value.low_stock
  })
  
  // Methods
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', { 
      minimumFractionDigits: 0,
      maximumFractionDigits: 2 
    }).format(num)
  }
  
  // Helper function for low stock check with proper number comparison
  const isItemLowStock = (item: Item): boolean => {
    return Number(item.current_stock) <= Number(item.min_stock_level)
  }
  
  const loadItems = async () => {
    loading.value = true
    try {
      const response = await getItems({
        ...filters.value,
        page: pagination.value.current_page,
        per_page: pagination.value.per_page,
      })
      items.value = response.data
      pagination.value = {
        current_page: response.current_page,
        last_page: response.last_page,
        per_page: response.per_page,
        total: response.total,
      }
    } catch (error) {
      console.error('Failed to load items:', error)
    } finally {
      loading.value = false
    }
  }
  
  const loadCategories = async () => {
    try {
      categories.value = await getCategories()
    } catch (error) {
      console.error('Failed to load categories:', error)
    }
  }
  
  const loadSummary = async () => {
    try {
      summary.value = await getInventorySummary()
    } catch (error) {
      console.error('Failed to load summary:', error)
    }
  }
  
  // Debounced search
  let searchTimeout: ReturnType<typeof setTimeout>
  const debouncedSearch = () => {
    clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => {
      pagination.value.current_page = 1
      loadItems()
    }, 300)
  }
  
  const toggleLowStock = () => {
    filters.value.low_stock = !filters.value.low_stock
    pagination.value.current_page = 1
    loadItems()
  }
  
  const goToPage = (page: number) => {
    pagination.value.current_page = page
    loadItems()
  }
  
  const openAdjustStock = (item: Item) => {
    adjustStockModal.value = {
      open: true,
      item,
      adjustment: 1,
      quantity: 0,
      reason: '',
      loading: false,
    }
  }
  
  const submitAdjustStock = async () => {
    if (!adjustStockModal.value.item) return
    
    adjustStockModal.value.loading = true
    try {
      const finalAdjustment = adjustStockModal.value.adjustment < 0 
        ? -adjustStockModal.value.quantity 
        : adjustStockModal.value.quantity
      
      await adjustStock(
        adjustStockModal.value.item.id,
        finalAdjustment,
        adjustStockModal.value.reason
      )
      
      adjustStockModal.value.open = false
      await Promise.all([loadItems(), loadSummary()])
    } catch (error) {
      console.error('Failed to adjust stock:', error)
      alert('Failed to adjust stock. Please try again.')
    } finally {
      adjustStockModal.value.loading = false
    }
  }
  
  // Load data on mount
  onMounted(async () => {
    await Promise.all([
      loadItems(),
      loadCategories(),
      loadSummary(),
    ])
  })
  </script>