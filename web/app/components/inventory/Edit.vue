<template>
    <div>
      <!-- Page Header -->
      <div class="mb-8">
        <NuxtLink :to="backLink" class="text-forest-600 hover:text-forest-700 text-sm font-medium flex items-center gap-1 mb-2">
          <Icon name="lucide:arrow-left" class="w-4 h-4" />
          {{ backLabel }}
        </NuxtLink>
        <h2 class="text-2xl font-bold text-gray-900">{{ title }}</h2>
        <p class="text-gray-500 mt-1">{{ subtitle }}</p>
      </div>
  
      <!-- Loading State -->
      <div v-if="loadingItem" class="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-forest-600 mx-auto"></div>
        <p class="mt-2 text-gray-500">Loading item...</p>
      </div>
  
      <!-- Error State -->
      <div v-else-if="loadError" class="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <Icon name="lucide:alert-circle" class="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p class="text-red-700">{{ loadError }}</p>
        <NuxtLink :to="backLink" class="text-red-600 hover:text-red-700 font-medium mt-2 inline-block">
          Go back
        </NuxtLink>
      </div>
  
      <!-- Form -->
      <form v-else @submit.prevent="handleSubmit" class="space-y-8">
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
  
            <div v-if="allowedTypes.length > 1">
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Item Type <span class="text-red-500">*</span>
              </label>
              <select
                v-model="form.item_type"
                required
                class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-500 bg-white"
              >
                <option v-for="type in allowedTypes" :key="type" :value="type">
                  {{ typeLabels[type] }}
                </option>
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
                <optgroup label="Weight">
                  <option value="kg">Kilograms (kg)</option>
                  <option value="g">Grams (g)</option>
                  <option value="lb">Pounds (lb)</option>
                  <option value="oz">Ounces (oz)</option>
                </optgroup>
                <optgroup label="Volume">
                  <option value="l">Liters (L)</option>
                  <option value="ml">Milliliters (mL)</option>
                  <option value="gal">Gallons (gal)</option>
                </optgroup>
                <optgroup label="Count">
                  <option value="pcs">Pieces (pcs)</option>
                  <option value="box">Boxes</option>
                  <option value="case">Cases</option>
                  <option value="bag">Bags</option>
                  <option value="roll">Rolls</option>
                </optgroup>
              </select>
            </div>
  
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                v-model="form.is_active"
                class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-500 bg-white"
              >
                <option :value="true">Active</option>
                <option :value="false">Inactive</option>
              </select>
            </div>
  
            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                v-model="form.description"
                rows="3"
                class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-500"
                placeholder="Optional description..."
              ></textarea>
            </div>
          </div>
        </div>
  
        <!-- Stock Levels -->
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Stock Levels</h3>
          <p class="text-sm text-gray-500 mb-4">
            Current stock: <strong>{{ form.current_stock }} {{ form.unit_of_measure }}</strong> 
            — Use "Adjust Stock" on the detail page to change stock levels.
          </p>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Minimum Stock Level</label>
              <input
                v-model.number="form.min_stock_level"
                type="number"
                min="0"
                step="0.001"
                class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-500"
                placeholder="Alert when below this"
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
                placeholder="Optional"
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
                  placeholder="0.00"
                />
              </div>
              <p class="text-xs text-gray-500 mt-1">Price per unit of measure</p>
            </div>
  
            <div v-if="showSalePrice">
              <label class="block text-sm font-medium text-gray-700 mb-1">Sale Price</label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  v-model.number="form.sale_price"
                  type="number"
                  min="0"
                  step="0.01"
                  class="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-500"
                  placeholder="0.00"
                />
              </div>
              <p class="text-xs text-gray-500 mt-1">Selling price to customers</p>
            </div>
          </div>
        </div>
  
        <!-- Food Safety -->
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
                placeholder="e.g., 365"
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
  
        <!-- Error Message -->
        <div v-if="submitError" class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {{ submitError }}
        </div>
  
        <!-- Submit Buttons -->
        <div class="flex gap-4">
          <NuxtLink
            :to="backLink"
            class="px-6 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </NuxtLink>
          <button
            type="submit"
            :disabled="saving"
            class="px-6 py-2 bg-forest-600 text-white rounded-lg hover:bg-forest-700 disabled:opacity-50 transition-colors"
          >
            {{ saving ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
      </form>
    </div>
  </template>
  
  <script setup lang="ts">
  import type { Item, Category } from '~/composables/useInventory'
  
  // Props
  const props = withDefaults(defineProps<{
    title: string
    subtitle: string
    backLink: string
    backLabel: string
    allowedTypes: string[]
    showSalePrice?: boolean
  }>(), {
    showSalePrice: false
  })
  
  const route = useRoute()
  const router = useRouter()
  const { getItem, updateItem, getCategories } = useInventory()
  
  const loadingItem = ref(true)
  const loadError = ref('')
  const saving = ref(false)
  const submitError = ref('')
  const categories = ref<Category[]>([])
  
  const form = ref({
    name: '',
    sku: '',
    description: '',
    category_id: null as number | null,
    item_type: '',
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
  
  const typeLabels: Record<string, string> = {
    raw_material: 'Raw Material',
    finished_product: 'Finished Product',
    packaging: 'Packaging',
    ingredient: 'Ingredient',
    supply: 'Supply',
  }
  
  const loadItem = async () => {
    loadingItem.value = true
    loadError.value = ''
    
    try {
      const id = Number(route.params.id)
      const item = await getItem(id)
      
      // Populate form
      form.value = {
        name: item.name,
        sku: item.sku || '',
        description: item.description || '',
        category_id: item.category_id,
        item_type: item.item_type,
        unit_of_measure: item.unit_of_measure,
        current_stock: item.current_stock,
        min_stock_level: item.min_stock_level,
        max_stock_level: item.max_stock_level,
        cost_price: item.cost_price,
        sale_price: item.sale_price,
        shelf_life_days: item.shelf_life_days,
        storage_requirements: item.storage_requirements,
        is_active: item.is_active,
      }
    } catch (e: any) {
      loadError.value = e.data?.message || 'Failed to load item'
    } finally {
      loadingItem.value = false
    }
  }
  
  const handleSubmit = async () => {
    saving.value = true
    submitError.value = ''
  
    try {
      const id = Number(route.params.id)
      await updateItem(id, form.value)
      router.push(props.backLink)
    } catch (e: any) {
      submitError.value = e.data?.message || 'Failed to save changes'
    } finally {
      saving.value = false
    }
  }
  
  onMounted(async () => {
    await Promise.all([
      loadItem(),
      getCategories().then(cats => categories.value = cats).catch(console.error)
    ])
  })
  </script>