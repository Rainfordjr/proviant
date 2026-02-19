<template>
    <div>
      <!-- Page Header -->
      <div class="mb-8">
        <NuxtLink :to="backLink" class="text-forest-600 hover:text-forest-700 text-sm font-medium flex items-center gap-1 mb-2">
          <Icon name="lucide:arrow-left" class="w-4 h-4" />
          {{ backLabel }}
        </NuxtLink>
        
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div class="flex items-center gap-3">
              <h2 class="text-2xl font-bold text-gray-900">{{ item?.name }}</h2>
              <span 
                v-if="item"
                class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                :class="item.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'"
              >
                {{ item.is_active ? 'Active' : 'Inactive' }}
              </span>
            </div>
            <p v-if="item?.sku" class="text-gray-500 mt-1">SKU: {{ item.sku }}</p>
          </div>
          
          <div class="flex gap-2">
            <button
              @click="openAdjustStock"
              class="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <Icon name="lucide:plus-circle" class="w-4 h-4" />
              Adjust Stock
            </button>
            <NuxtLink
              :to="`${basePath}/${item?.id}/edit`"
              class="px-4 py-2 bg-forest-600 text-white rounded-lg hover:bg-forest-700 transition-colors flex items-center gap-2"
            >
              <Icon name="lucide:pencil" class="w-4 h-4" />
              Edit
            </NuxtLink>
          </div>
        </div>
      </div>
  
      <!-- Loading State -->
      <div v-if="loading" class="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-forest-600 mx-auto"></div>
        <p class="mt-2 text-gray-500">Loading...</p>
      </div>
  
      <!-- Error State -->
      <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <Icon name="lucide:alert-circle" class="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p class="text-red-700">{{ error }}</p>
        <NuxtLink :to="backLink" class="text-red-600 hover:text-red-700 font-medium mt-2 inline-block">
          Go back
        </NuxtLink>
      </div>
  
      <!-- Content -->
      <div v-else-if="item" class="space-y-6">
        <!-- Stock Level Card -->
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Stock Level</h3>
          
          <div class="flex items-center gap-6">
            <div class="flex-1">
              <div class="flex items-baseline gap-2">
                <span 
                  class="text-4xl font-bold"
                  :class="isLowStock ? 'text-amber-600' : 'text-gray-900'"
                >
                  {{ formatNumber(item.current_stock) }}
                </span>
                <span class="text-lg text-gray-500">{{ item.unit_of_measure }}</span>
                <Icon 
                  v-if="isLowStock" 
                  name="lucide:alert-triangle" 
                  class="w-6 h-6 text-amber-500 ml-2" 
                />
              </div>
              
              <!-- Stock Bar -->
              <div class="mt-4 h-3 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  class="h-full rounded-full transition-all"
                  :class="stockBarColor"
                  :style="{ width: stockPercentage + '%' }"
                ></div>
              </div>
              
              <div class="flex justify-between mt-2 text-sm text-gray-500">
                <span>Min: {{ formatNumber(item.min_stock_level) }} {{ item.unit_of_measure }}</span>
                <span v-if="item.max_stock_level">Max: {{ formatNumber(item.max_stock_level) }} {{ item.unit_of_measure }}</span>
              </div>
            </div>
          </div>
          
          <div v-if="isLowStock" class="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
            <Icon name="lucide:alert-triangle" class="w-5 h-5 text-amber-600 flex-shrink-0" />
            <p class="text-sm text-amber-800">Stock is below minimum level. Consider reordering soon.</p>
          </div>
        </div>
  
        <!-- Details Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Basic Info -->
          <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Details</h3>
            
            <dl class="space-y-4">
              <div v-if="showType">
                <dt class="text-sm text-gray-500">Type</dt>
                <dd class="mt-1">
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" :class="typeColors[item.item_type]">
                    {{ typeLabels[item.item_type] }}
                  </span>
                </dd>
              </div>
              
              <div>
                <dt class="text-sm text-gray-500">Category</dt>
                <dd class="mt-1 text-gray-900">{{ item.category?.name || 'Uncategorized' }}</dd>
              </div>
              
              <div>
                <dt class="text-sm text-gray-500">Unit of Measure</dt>
                <dd class="mt-1 text-gray-900">{{ unitLabels[item.unit_of_measure] || item.unit_of_measure }}</dd>
              </div>
              
              <div v-if="item.description">
                <dt class="text-sm text-gray-500">Description</dt>
                <dd class="mt-1 text-gray-900">{{ item.description }}</dd>
              </div>
            </dl>
          </div>
  
          <!-- Pricing -->
          <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Pricing</h3>
            
            <dl class="space-y-4">
              <div>
                <dt class="text-sm text-gray-500">Cost Price</dt>
                <dd class="mt-1 text-gray-900 text-xl font-semibold">
                  {{ item.cost_price ? '$' + formatNumber(item.cost_price) : '—' }}
                  <span v-if="item.cost_price" class="text-sm font-normal text-gray-500">per {{ item.unit_of_measure }}</span>
                </dd>
              </div>
              
              <div v-if="showSalePrice">
                <dt class="text-sm text-gray-500">Sale Price</dt>
                <dd class="mt-1 text-gray-900 text-xl font-semibold">
                  {{ item.sale_price ? '$' + formatNumber(item.sale_price) : '—' }}
                  <span v-if="item.sale_price" class="text-sm font-normal text-gray-500">per {{ item.unit_of_measure }}</span>
                </dd>
              </div>
              
              <div>
                <dt class="text-sm text-gray-500">Total Stock Value</dt>
                <dd class="mt-1 text-gray-900 text-xl font-semibold">
                  {{ item.cost_price ? '$' + formatNumber(item.current_stock * item.cost_price) : '—' }}
                </dd>
              </div>
            </dl>
          </div>
  
          <!-- Food Safety -->
          <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Food Safety</h3>
            
            <dl class="space-y-4">
              <div>
                <dt class="text-sm text-gray-500">Shelf Life</dt>
                <dd class="mt-1 text-gray-900">
                  {{ item.shelf_life_days ? item.shelf_life_days + ' days' : 'Not specified' }}
                </dd>
              </div>
              
              <div>
                <dt class="text-sm text-gray-500">Storage Requirements</dt>
                <dd class="mt-1 text-gray-900">
                  {{ storageLabels[item.storage_requirements] || 'Not specified' }}
                </dd>
              </div>
            </dl>
          </div>
  
          <!-- Timestamps -->
          <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">History</h3>
            
            <dl class="space-y-4">
              <div>
                <dt class="text-sm text-gray-500">Created</dt>
                <dd class="mt-1 text-gray-900">{{ formatDate(item.created_at) }}</dd>
              </div>
              
              <div>
                <dt class="text-sm text-gray-500">Last Updated</dt>
                <dd class="mt-1 text-gray-900">{{ formatDate(item.updated_at) }}</dd>
              </div>
            </dl>
          </div>
        </div>
  
        <!-- Danger Zone -->
        <div class="bg-white rounded-xl border border-red-200 shadow-sm p-6">
          <h3 class="text-lg font-semibold text-red-600 mb-2">Danger Zone</h3>
          <p class="text-sm text-gray-500 mb-4">Permanently delete this item. This action cannot be undone.</p>
          <button
            @click="confirmDelete"
            class="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
          >
            Delete Item
          </button>
        </div>
      </div>
  
      <!-- Adjust Stock Modal -->
      <div v-if="adjustStockModal.open" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" @click="adjustStockModal.open = false" />
        <div class="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Adjust Stock</h3>
          <p class="text-sm text-gray-500 mb-4">
            {{ item?.name }} — Current: {{ item?.current_stock }} {{ item?.unit_of_measure }}
          </p>
          <form @submit.prevent="submitAdjustStock">
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-1">Adjustment Type</label>
              <div class="flex gap-2">
                <button
                  type="button"
                  @click="adjustStockModal.adjustment = 1"
                  class="flex-1 px-4 py-2 border rounded-lg font-medium transition-colors"
                  :class="adjustStockModal.adjustment > 0 
                    ? 'border-green-500 bg-green-50 text-green-700' 
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'"
                >
                  <Icon name="lucide:plus" class="w-4 h-4 inline mr-1" />
                  Add
                </button>
                <button
                  type="button"
                  @click="adjustStockModal.adjustment = -1"
                  class="flex-1 px-4 py-2 border rounded-lg font-medium transition-colors"
                  :class="adjustStockModal.adjustment < 0 
                    ? 'border-red-500 bg-red-50 text-red-700' 
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'"
                >
                  <Icon name="lucide:minus" class="w-4 h-4 inline mr-1" />
                  Remove
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
                required
                class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-500"
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
  
      <!-- Delete Confirmation Modal -->
      <div v-if="deleteModal.open" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" @click="deleteModal.open = false" />
        <div class="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-2">Delete Item</h3>
          <p class="text-gray-500 mb-6">
            Are you sure you want to delete <strong>{{ item?.name }}</strong>? This action cannot be undone.
          </p>
          <div class="flex gap-3">
            <button
              @click="deleteModal.open = false"
              class="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              @click="handleDelete"
              :disabled="deleteModal.loading"
              class="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {{ deleteModal.loading ? 'Deleting...' : 'Delete' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
  import type { Item } from '~/composables/useInventory'
  
  // Props
  const props = withDefaults(defineProps<{
    backLink: string
    backLabel: string
    basePath: string
    showSalePrice?: boolean
    showType?: boolean
  }>(), {
    showSalePrice: false,
    showType: false
  })
  
  const route = useRoute()
  const router = useRouter()
  const { getItem, adjustStock, deleteItem } = useInventory()
  
  const loading = ref(true)
  const error = ref('')
  const item = ref<Item | null>(null)
  
  const adjustStockModal = ref({
    open: false,
    adjustment: 1,
    quantity: 0,
    reason: '',
    loading: false,
  })
  
  const deleteModal = ref({
    open: false,
    loading: false,
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
    kg: 'Kilograms (kg)',
    g: 'Grams (g)',
    lb: 'Pounds (lb)',
    oz: 'Ounces (oz)',
    l: 'Liters (L)',
    ml: 'Milliliters (mL)',
    gal: 'Gallons (gal)',
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
  
  // Computed
  const isLowStock = computed(() => {
    if (!item.value) return false
    return Number(item.value.current_stock) <= Number(item.value.min_stock_level)
  })
  
  const stockPercentage = computed(() => {
    if (!item.value) return 0
    const max = item.value.max_stock_level || item.value.min_stock_level * 3
    return Math.min(100, (item.value.current_stock / max) * 100)
  })
  
  const stockBarColor = computed(() => {
    if (!item.value) return 'bg-gray-300'
    if (isLowStock.value) return 'bg-amber-500'
    if (stockPercentage.value > 66) return 'bg-green-500'
    return 'bg-blue-500'
  })
  
  // Methods
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', { 
      minimumFractionDigits: 0,
      maximumFractionDigits: 2 
    }).format(num)
  }
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
  
  const loadItem = async () => {
    loading.value = true
    error.value = ''
    
    try {
      const id = Number(route.params.id)
      item.value = await getItem(id)
    } catch (e: any) {
      error.value = e.data?.message || 'Failed to load item'
    } finally {
      loading.value = false
    }
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
      adjustStockModal.value.open = false
      await loadItem()
    } catch (e) {
      console.error('Failed to adjust stock:', e)
      alert('Failed to adjust stock. Please try again.')
    } finally {
      adjustStockModal.value.loading = false
    }
  }
  
  const confirmDelete = () => {
    deleteModal.value = { open: true, loading: false }
  }
  
  const handleDelete = async () => {
    if (!item.value) return
    
    deleteModal.value.loading = true
    try {
      await deleteItem(item.value.id)
      router.push(props.backLink)
    } catch (e) {
      console.error('Failed to delete item:', e)
      alert('Failed to delete item. Please try again.')
    } finally {
      deleteModal.value.loading = false
    }
  }
  
  onMounted(() => {
    loadItem()
  })
  </script>