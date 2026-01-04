<template>
    <div>
      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-forest-600"></div>
      </div>
  
      <!-- Content -->
      <div v-else-if="item">
        <!-- Page Header -->
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div>
            <NuxtLink to="/inventory" class="text-forest-600 hover:text-forest-700 text-sm font-medium flex items-center gap-1 mb-2">
              <Icon name="lucide:arrow-left" class="w-4 h-4" />
              Back to Inventory
            </NuxtLink>
            <h2 class="text-2xl font-bold text-gray-900">{{ item.name }}</h2>
            <p v-if="item.sku" class="text-gray-500 mt-1">SKU: {{ item.sku }}</p>
          </div>
          <div class="flex gap-2">
            <button
              @click="openAdjustStock"
              class="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <Icon name="lucide:plus-minus" class="w-4 h-4" />
              Adjust Stock
            </button>
            <NuxtLink
              :to="`/inventory/${item.id}/edit`"
              class="px-4 py-2 bg-forest-600 text-white rounded-lg hover:bg-forest-700 transition-colors flex items-center gap-2"
            >
              <Icon name="lucide:pencil" class="w-4 h-4" />
              Edit
            </NuxtLink>
          </div>
        </div>
  
        <!-- Status Alert -->
        <div 
          v-if="isLowStock" 
          class="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3"
        >
          <Icon name="lucide:alert-triangle" class="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p class="font-medium text-amber-800">Low Stock Warning</p>
            <p class="text-sm text-amber-700">Current stock is at or below minimum level. Consider reordering.</p>
          </div>
        </div>
  
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <!-- Main Info -->
          <div class="lg:col-span-2 space-y-6">
            <!-- Details Card -->
            <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">Details</h3>
              
              <dl class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <dt class="text-sm text-gray-500">Category</dt>
                  <dd class="font-medium text-gray-900">{{ item.category?.name || 'Uncategorized' }}</dd>
                </div>
                <div>
                  <dt class="text-sm text-gray-500">Type</dt>
                  <dd>
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" :class="typeColors[item.item_type]">
                      {{ typeLabels[item.item_type] }}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt class="text-sm text-gray-500">Unit of Measure</dt>
                  <dd class="font-medium text-gray-900">{{ unitLabels[item.unit_of_measure] || item.unit_of_measure }}</dd>
                </div>
                <div>
                  <dt class="text-sm text-gray-500">Status</dt>
                  <dd>
                    <span 
                      class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                      :class="item.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'"
                    >
                      {{ item.is_active ? 'Active' : 'Inactive' }}
                    </span>
                  </dd>
                </div>
              </dl>
  
              <div v-if="item.description" class="mt-4 pt-4 border-t border-gray-100">
                <dt class="text-sm text-gray-500 mb-1">Description</dt>
                <dd class="text-gray-900">{{ item.description }}</dd>
              </div>
            </div>
  
            <!-- Pricing Card -->
            <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">Pricing</h3>
              
              <dl class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <dt class="text-sm text-gray-500">Cost Price</dt>
                  <dd class="font-medium text-gray-900">
                    {{ item.cost_price ? `$${formatNumber(item.cost_price)}` : '—' }}
                    <span v-if="item.cost_price" class="text-gray-500 text-sm">/ {{ item.unit_of_measure }}</span>
                  </dd>
                </div>
                <div>
                  <dt class="text-sm text-gray-500">Sale Price</dt>
                  <dd class="font-medium text-gray-900">
                    {{ item.sale_price ? `$${formatNumber(item.sale_price)}` : '—' }}
                    <span v-if="item.sale_price" class="text-gray-500 text-sm">/ {{ item.unit_of_measure }}</span>
                  </dd>
                </div>
                <div>
                  <dt class="text-sm text-gray-500">Stock Value</dt>
                  <dd class="font-medium text-gray-900">
                    {{ item.cost_price ? `$${formatNumber(Number(item.current_stock) * Number(item.cost_price))}` : '—' }}
                  </dd>
                </div>
              </dl>
            </div>
  
            <!-- Food Safety Card -->
            <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">Food Safety</h3>
              
              <dl class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <dt class="text-sm text-gray-500">Shelf Life</dt>
                  <dd class="font-medium text-gray-900">
                    {{ item.shelf_life_days ? `${item.shelf_life_days} days` : '—' }}
                  </dd>
                </div>
                <div>
                  <dt class="text-sm text-gray-500">Storage Requirements</dt>
                  <dd class="font-medium text-gray-900">
                    {{ storageLabels[item.storage_requirements] || item.storage_requirements || '—' }}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
  
          <!-- Sidebar -->
          <div class="space-y-6">
            <!-- Stock Card -->
            <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">Stock Levels</h3>
              
              <div class="text-center mb-6">
                <p 
                  class="text-4xl font-bold"
                  :class="isLowStock ? 'text-amber-600' : 'text-gray-900'"
                >
                  {{ formatNumber(item.current_stock) }}
                </p>
                <p class="text-gray-500">{{ item.unit_of_measure }}</p>
              </div>
  
              <dl class="space-y-3">
                <div class="flex justify-between">
                  <dt class="text-sm text-gray-500">Minimum Level</dt>
                  <dd class="font-medium text-gray-900">{{ formatNumber(item.min_stock_level) }}</dd>
                </div>
                <div v-if="item.max_stock_level" class="flex justify-between">
                  <dt class="text-sm text-gray-500">Maximum Level</dt>
                  <dd class="font-medium text-gray-900">{{ formatNumber(item.max_stock_level) }}</dd>
                </div>
              </dl>
  
              <button
                @click="openAdjustStock"
                class="w-full mt-4 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                <Icon name="lucide:plus-minus" class="w-4 h-4" />
                Adjust Stock
              </button>
            </div>
  
            <!-- Timestamps -->
            <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Activity</h3>
              <dl class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <dt class="text-gray-500">Created</dt>
                  <dd class="text-gray-900">{{ formatDate(item.created_at) }}</dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-gray-500">Updated</dt>
                  <dd class="text-gray-900">{{ formatDate(item.updated_at) }}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
  
      <!-- Not Found -->
      <div v-else class="text-center py-12">
        <p class="text-gray-500">Item not found</p>
        <NuxtLink to="/inventory" class="text-forest-600 hover:text-forest-700 mt-2 inline-block">
          Back to Inventory
        </NuxtLink>
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
            <p class="text-sm text-gray-500">{{ item?.name }}</p>
          </div>
          <form @submit.prevent="submitAdjustStock" class="p-6">
            <div class="mb-4">
              <p class="text-sm text-gray-600 mb-2">
                Current stock: <span class="font-medium">{{ item?.current_stock }} {{ item?.unit_of_measure }}</span>
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
  import type { Item } from '~/composables/useInventory'
  
  definePageMeta({
    layout: 'dashboard',
    middleware: 'auth'
  })
  
  const route = useRoute()
  const { getItem, adjustStock } = useInventory()
  
  const loading = ref(true)
  const item = ref<Item | null>(null)
  
  const adjustStockModal = ref({
    open: false,
    adjustment: 1,
    quantity: 0,
    reason: '',
    loading: false,
  })
  
  // Computed property for low stock check
  const isLowStock = computed(() => {
    if (!item.value) return false
    return Number(item.value.current_stock) <= Number(item.value.min_stock_level)
  })
  
  // Labels
  const typeLabels: Record<string, string> = {
    raw_material: 'Raw Material',
    finished_product: 'Finished Product',
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
  
  const unitLabels: Record<string, string> = {
    kg: 'Kilograms',
    g: 'Grams',
    lb: 'Pounds',
    oz: 'Ounces',
    l: 'Liters',
    ml: 'Milliliters',
    gal: 'Gallons',
    pcs: 'Pieces',
    box: 'Boxes',
    case: 'Cases',
    bag: 'Bags',
    roll: 'Rolls',
  }
  
  const storageLabels: Record<string, string> = {
    dry: 'Dry Storage',
    refrigerated: 'Refrigerated (32-40°F)',
    frozen: 'Frozen (0°F or below)',
    cool: 'Cool & Dry',
    room_temp: 'Room Temperature',
  }
  
  // Methods
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', { 
      minimumFractionDigits: 0,
      maximumFractionDigits: 2 
    }).format(num)
  }
  
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }
  
  const openAdjustStock = () => {
    adjustStockModal.value = {
      open: true,
      adjustment: 1,
      quantity: 0,
      reason: '',
      loading: false,
    }
  }
  
  const submitAdjustStock = async () => {
    if (!item.value) return
    
    adjustStockModal.value.loading = true
    try {
      const finalAdjustment = adjustStockModal.value.adjustment < 0 
        ? -adjustStockModal.value.quantity 
        : adjustStockModal.value.quantity
      
      await adjustStock(item.value.id, finalAdjustment, adjustStockModal.value.reason)
      
      // Reload item
      item.value = await getItem(item.value.id)
      adjustStockModal.value.open = false
    } catch (error) {
      console.error('Failed to adjust stock:', error)
      alert('Failed to adjust stock. Please try again.')
    } finally {
      adjustStockModal.value.loading = false
    }
  }
  
  // Load item
  onMounted(async () => {
    try {
      const id = Number(route.params.id)
      item.value = await getItem(id)
    } catch (error) {
      console.error('Failed to load item:', error)
    } finally {
      loading.value = false
    }
  })
  </script>