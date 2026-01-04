<template>
    <div class="max-w-3xl">
      <!-- Loading -->
      <div v-if="pageLoading" class="flex items-center justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-forest-600"></div>
      </div>
  
      <template v-else-if="item">
        <!-- Page Header -->
        <div class="mb-8">
          <NuxtLink :to="`/inventory/${item.id}`" class="text-forest-600 hover:text-forest-700 text-sm font-medium flex items-center gap-1 mb-2">
            <Icon name="lucide:arrow-left" class="w-4 h-4" />
            Back to Item
          </NuxtLink>
          <h2 class="text-2xl font-bold text-gray-900">Edit Item</h2>
          <p class="text-gray-500 mt-1">{{ item.name }}</p>
        </div>
  
        <!-- Form -->
        <form @submit.prevent="handleSubmit" class="space-y-8">
          <!-- Basic Info -->
          <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="md:col-span-2">
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Name <span class="text-red-500">*</span>
                </label>
                <input
                  v-model="form.name"
                  type="text"
                  required
                  class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-500"
                />
              </div>
  
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                <input
                  v-model="form.sku"
                  type="text"
                  class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-500"
                />
              </div>
  
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  v-model="form.category_id"
                  class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-500 bg-white"
                >
                  <option :value="null">No Category</option>
                  <option v-for="cat in categories" :key="cat.id" :value="cat.id">
                    {{ cat.name }}
                  </option>
                </select>
              </div>
  
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Item Type <span class="text-red-500">*</span>
                </label>
                <select
                  v-model="form.item_type"
                  required
                  class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-500 bg-white"
                >
                  <option value="raw_material">Raw Material</option>
                  <option value="finished_product">Finished Product</option>
                  <option value="packaging">Packaging</option>
                  <option value="ingredient">Ingredient</option>
                  <option value="supply">Supply</option>
                </select>
              </div>
  
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Unit of Measure <span class="text-red-500">*</span>
                </label>
                <select
                  v-model="form.unit_of_measure"
                  required
                  class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-500 bg-white"
                >
                  <option value="kg">Kilograms (kg)</option>
                  <option value="g">Grams (g)</option>
                  <option value="lb">Pounds (lb)</option>
                  <option value="oz">Ounces (oz)</option>
                  <option value="l">Liters (L)</option>
                  <option value="ml">Milliliters (mL)</option>
                  <option value="gal">Gallons (gal)</option>
                  <option value="pcs">Pieces (pcs)</option>
                  <option value="box">Boxes</option>
                  <option value="case">Cases</option>
                  <option value="bag">Bags</option>
                  <option value="roll">Rolls</option>
                </select>
              </div>
  
              <div class="md:col-span-2">
                <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  v-model="form.description"
                  rows="3"
                  class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-500"
                ></textarea>
              </div>
            </div>
          </div>
  
          <!-- Stock Levels -->
          <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Stock Levels</h3>
            <p class="text-sm text-gray-500 mb-4">Use "Adjust Stock" on the item page to change current stock.</p>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Current Stock</label>
                <input
                  :value="form.current_stock"
                  type="number"
                  disabled
                  class="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                />
              </div>
  
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Minimum Stock Level</label>
                <input
                  v-model.number="form.min_stock_level"
                  type="number"
                  min="0"
                  step="0.001"
                  class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-500"
                />
              </div>
  
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Maximum Stock Level</label>
                <input
                  v-model.number="form.max_stock_level"
                  type="number"
                  min="0"
                  step="0.001"
                  class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-500"
                />
              </div>
            </div>
          </div>
  
          <!-- Pricing -->
          <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Pricing</h3>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Cost Price</label>
                <div class="relative">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    v-model.number="form.cost_price"
                    type="number"
                    min="0"
                    step="0.01"
                    class="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-500"
                  />
                </div>
              </div>
  
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Sale Price</label>
                <div class="relative">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    v-model.number="form.sale_price"
                    type="number"
                    min="0"
                    step="0.01"
                    class="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-500"
                  />
                </div>
              </div>
            </div>
          </div>
  
          <!-- Food-Specific -->
          <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Food Safety</h3>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Shelf Life (Days)</label>
                <input
                  v-model.number="form.shelf_life_days"
                  type="number"
                  min="0"
                  class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-500"
                />
              </div>
  
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Storage Requirements</label>
                <select
                  v-model="form.storage_requirements"
                  class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-500 bg-white"
                >
                  <option :value="null">Not specified</option>
                  <option value="dry">Dry Storage</option>
                  <option value="refrigerated">Refrigerated (32-40°F)</option>
                  <option value="frozen">Frozen (0°F or below)</option>
                  <option value="cool">Cool & Dry</option>
                  <option value="room_temp">Room Temperature</option>
                </select>
              </div>
            </div>
          </div>
  
          <!-- Status -->
          <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Status</h3>
            
            <label class="flex items-center gap-3 cursor-pointer">
              <input
                v-model="form.is_active"
                type="checkbox"
                class="w-5 h-5 rounded border-gray-300 text-forest-600 focus:ring-forest-500"
              />
              <span class="text-gray-700">Item is active</span>
            </label>
            <p class="text-sm text-gray-500 mt-1 ml-8">Inactive items won't appear in production or orders</p>
          </div>
  
          <!-- Error Message -->
          <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {{ error }}
          </div>
  
          <!-- Submit Buttons -->
          <div class="flex gap-4">
            <NuxtLink
              :to="`/inventory/${item.id}`"
              class="px-6 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </NuxtLink>
            <button
              type="submit"
              :disabled="loading"
              class="px-6 py-2 bg-forest-600 text-white rounded-lg hover:bg-forest-700 disabled:opacity-50 transition-colors"
            >
              {{ loading ? 'Saving...' : 'Save Changes' }}
            </button>
          </div>
        </form>
      </template>
  
      <!-- Not Found -->
      <div v-else class="text-center py-12">
        <p class="text-gray-500">Item not found</p>
        <NuxtLink to="/inventory" class="text-forest-600 hover:text-forest-700 mt-2 inline-block">
          Back to Inventory
        </NuxtLink>
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
  import type { Item, Category } from '~/composables/useInventory'
  
  definePageMeta({
    layout: 'dashboard',
    middleware: 'auth'
  })
  
  const route = useRoute()
  const router = useRouter()
  const { getItem, updateItem, getCategories } = useInventory()
  
  const pageLoading = ref(true)
  const loading = ref(false)
  const error = ref('')
  const item = ref<Item | null>(null)
  const categories = ref<Category[]>([])
  
  const form = ref({
    name: '',
    sku: '',
    description: '',
    category_id: null as number | null,
    item_type: 'raw_material',
    unit_of_measure: 'kg',
    current_stock: 0,
    min_stock_level: 0,
    max_stock_level: null as number | null,
    cost_price: null as number | null,
    sale_price: null as number | null,
    shelf_life_days: null as number | null,
    storage_requirements: null as string | null,
    is_active: true,
  })
  
  const handleSubmit = async () => {
    if (!item.value) return
    
    loading.value = true
    error.value = ''
  
    try {
      // Don't send current_stock in update - use adjustStock instead
      const { current_stock, ...updateData } = form.value
      await updateItem(item.value.id, updateData)
      router.push(`/inventory/${item.value.id}`)
    } catch (e: any) {
      error.value = e.data?.message || 'Failed to update item'
    } finally {
      loading.value = false
    }
  }
  
  // Load data
  onMounted(async () => {
    try {
      const [loadedItem, loadedCategories] = await Promise.all([
        getItem(Number(route.params.id)),
        getCategories(),
      ])
      
      item.value = loadedItem
      categories.value = loadedCategories
      
      // Populate form
      form.value = {
        name: loadedItem.name,
        sku: loadedItem.sku || '',
        description: loadedItem.description || '',
        category_id: loadedItem.category_id,
        item_type: loadedItem.item_type,
        unit_of_measure: loadedItem.unit_of_measure,
        current_stock: loadedItem.current_stock,
        min_stock_level: loadedItem.min_stock_level,
        max_stock_level: loadedItem.max_stock_level,
        cost_price: loadedItem.cost_price,
        sale_price: loadedItem.sale_price,
        shelf_life_days: loadedItem.shelf_life_days,
        storage_requirements: loadedItem.storage_requirements,
        is_active: loadedItem.is_active,
      }
    } catch (e) {
      console.error('Failed to load item:', e)
    } finally {
      pageLoading.value = false
    }
  })
  </script>