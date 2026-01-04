<template>
    <div>
      <NuxtLayout name="dashboard">
        <!-- Page Header -->
        <div class="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">Categories</h1>
            <p class="mt-1 text-sm text-gray-500">Organize your inventory items into categories</p>
          </div>
          <button
            @click="openCreateModal"
            class="inline-flex items-center gap-2 px-4 py-2.5 bg-forest-600 text-white text-sm font-medium rounded-lg hover:bg-forest-700 transition-colors"
          >
            <Icon name="lucide:plus" class="w-4 h-4" />
            Add Category
          </button>
        </div>
  
        <!-- Loading State -->
        <div v-if="loading" class="bg-white rounded-xl border border-gray-200 p-12">
          <div class="flex flex-col items-center justify-center text-gray-500">
            <Icon name="lucide:loader-2" class="w-8 h-8 animate-spin mb-3" />
            <p>Loading categories...</p>
          </div>
        </div>
  
        <!-- Error State -->
        <div v-else-if="error" class="bg-white rounded-xl border border-gray-200 p-12">
          <div class="flex flex-col items-center justify-center text-red-500">
            <Icon name="lucide:alert-circle" class="w-8 h-8 mb-3" />
            <p>{{ error }}</p>
            <button @click="fetchCategories" class="mt-4 text-sm text-forest-600 hover:underline">
              Try again
            </button>
          </div>
        </div>
  
        <!-- Empty State -->
        <div v-else-if="categories.length === 0" class="bg-white rounded-xl border border-gray-200 p-12">
          <div class="flex flex-col items-center justify-center text-gray-500">
            <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Icon name="lucide:folder-tree" class="w-8 h-8 text-gray-400" />
            </div>
            <h3 class="text-lg font-medium text-gray-900 mb-1">No categories yet</h3>
            <p class="text-sm text-gray-500 mb-4">Create your first category to organize inventory items</p>
            <button
              @click="openCreateModal"
              class="inline-flex items-center gap-2 px-4 py-2 bg-forest-600 text-white text-sm font-medium rounded-lg hover:bg-forest-700 transition-colors"
            >
              <Icon name="lucide:plus" class="w-4 h-4" />
              Add Category
            </button>
          </div>
        </div>
  
        <!-- Categories Table -->
        <div v-else class="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="category in hierarchicalCategories" :key="category.id" class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center gap-3">
                    <!-- Indentation based on depth -->
                    <div 
                      v-if="category.depth > 0" 
                      class="flex items-center text-gray-300"
                      :style="{ paddingLeft: `${(category.depth - 1) * 24}px` }"
                    >
                      <span class="mr-2">└─</span>
                    </div>
                    <div class="w-8 h-8 rounded-lg flex items-center justify-center"
                      :class="category.depth === 0 ? 'bg-forest-100' : 'bg-gray-100'"
                    >
                      <Icon 
                        :name="category.depth === 0 ? 'lucide:folder' : 'lucide:file'" 
                        class="w-4 h-4"
                        :class="category.depth === 0 ? 'text-forest-600' : 'text-gray-500'"
                      />
                    </div>
                    <span class="text-sm font-medium text-gray-900">{{ category.name }}</span>
                  </div>
                </td>
                <td class="px-6 py-4">
                  <span class="text-sm text-gray-500">{{ category.description || '—' }}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span
                    :class="category.is_active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'"
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                  >
                    {{ category.is_active ? 'Active' : 'Inactive' }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right">
                  <div class="flex items-center justify-end gap-2">
                    <button
                      @click="openEditModal(category)"
                      class="p-2 text-gray-400 hover:text-forest-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Icon name="lucide:pencil" class="w-4 h-4" />
                    </button>
                    <button
                      @click="confirmDelete(category)"
                      class="p-2 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Icon name="lucide:trash-2" class="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
  
        <!-- Create/Edit Modal -->
        <div
          v-if="showModal"
          class="fixed inset-0 z-50 overflow-y-auto"
          aria-labelledby="modal-title"
          role="dialog"
          aria-modal="true"
        >
          <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <!-- Backdrop -->
            <div
              class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              @click="closeModal"
            />
  
            <!-- Modal Panel -->
            <div class="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form @submit.prevent="handleSubmit">
                <div class="bg-white px-6 py-5">
                  <h3 class="text-lg font-semibold text-gray-900 mb-4">
                    {{ editingCategory ? 'Edit Category' : 'Create Category' }}
                  </h3>
  
                  <div class="space-y-4">
                    <!-- Name -->
                    <div>
                      <label for="name" class="block text-sm font-medium text-gray-700 mb-1">
                        Name <span class="text-red-500">*</span>
                      </label>
                      <input
                        id="name"
                        v-model="form.name"
                        type="text"
                        required
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-forest-500 focus:border-forest-500"
                        placeholder="e.g., Raw Materials"
                      />
                    </div>
  
                    <!-- Description -->
                    <div>
                      <label for="description" class="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <textarea
                        id="description"
                        v-model="form.description"
                        rows="2"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-forest-500 focus:border-forest-500"
                        placeholder="Optional description"
                      />
                    </div>
  
                    <!-- Parent Category -->
                    <div>
                      <label for="parent_id" class="block text-sm font-medium text-gray-700 mb-1">
                        Parent Category
                      </label>
                      <select
                        id="parent_id"
                        v-model="form.parent_id"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-forest-500 focus:border-forest-500"
                      >
                        <option :value="null">None (Top Level)</option>
                        <option
                          v-for="cat in availableParents"
                          :key="cat.id"
                          :value="cat.id"
                        >
                          {{ cat.name }}
                        </option>
                      </select>
                    </div>
  
                    <!-- Active Status -->
                    <div class="flex items-center gap-3">
                      <input
                        id="is_active"
                        v-model="form.is_active"
                        type="checkbox"
                        class="h-4 w-4 text-forest-600 focus:ring-forest-500 border-gray-300 rounded"
                      />
                      <label for="is_active" class="text-sm font-medium text-gray-700">
                        Active
                      </label>
                    </div>
                  </div>
  
                  <!-- Form Error -->
                  <div v-if="formError" class="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p class="text-sm text-red-600">{{ formError }}</p>
                  </div>
                </div>
  
                <div class="bg-gray-50 px-6 py-4 flex justify-end gap-3">
                  <button
                    type="button"
                    @click="closeModal"
                    class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    :disabled="submitting"
                    class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-forest-600 rounded-lg hover:bg-forest-700 disabled:opacity-50 transition-colors"
                  >
                    <Icon v-if="submitting" name="lucide:loader-2" class="w-4 h-4 animate-spin" />
                    {{ editingCategory ? 'Save Changes' : 'Create Category' }}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
  
        <!-- Delete Confirmation Modal -->
        <div
          v-if="showDeleteModal"
          class="fixed inset-0 z-50 overflow-y-auto"
          aria-labelledby="modal-title"
          role="dialog"
          aria-modal="true"
        >
          <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <!-- Backdrop -->
            <div
              class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              @click="showDeleteModal = false"
            />
  
            <!-- Modal Panel -->
            <div class="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full">
              <div class="bg-white px-6 py-5">
                <div class="flex items-center gap-4">
                  <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Icon name="lucide:alert-triangle" class="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h3 class="text-lg font-semibold text-gray-900">Delete Category</h3>
                    <p class="mt-1 text-sm text-gray-500">
                      Are you sure you want to delete "{{ deletingCategory?.name }}"? This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>
  
              <div class="bg-gray-50 px-6 py-4 flex justify-end gap-3">
                <button
                  @click="showDeleteModal = false"
                  class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  @click="handleDelete"
                  :disabled="deleting"
                  class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  <Icon v-if="deleting" name="lucide:loader-2" class="w-4 h-4 animate-spin" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </NuxtLayout>
    </div>
  </template>
  
  <script setup lang="ts">
  import type { Category, CategoryForm } from '~/composables/useCategories'
  
  definePageMeta({
    middleware: 'auth',
  })
  
  const { getCategories, createCategory, updateCategory, deleteCategory } = useCategories()
  
  // State
  const categories = ref<Category[]>([])
  const loading = ref(true)
  const error = ref<string | null>(null)
  
  // Modal state
  const showModal = ref(false)
  const editingCategory = ref<Category | null>(null)
  const submitting = ref(false)
  const formError = ref<string | null>(null)
  
  // Delete modal state
  const showDeleteModal = ref(false)
  const deletingCategory = ref<Category | null>(null)
  const deleting = ref(false)
  
  // Form
  const form = ref<CategoryForm>({
    name: '',
    description: '',
    parent_id: null,
    is_active: true,
  })
  
  // Computed: available parents (exclude self when editing)
  const availableParents = computed(() => {
    if (!editingCategory.value) return categories.value
    return categories.value.filter(c => c.id !== editingCategory.value!.id)
  })
  
  // Build hierarchical tree structure
  interface CategoryWithDepth extends Category {
    depth: number
  }
  
  const hierarchicalCategories = computed<CategoryWithDepth[]>(() => {
    const result: CategoryWithDepth[] = []
    
    // Get root categories (no parent)
    const roots = categories.value.filter(c => !c.parent_id)
    
    // Recursive function to add categories with depth
    const addWithChildren = (category: Category, depth: number) => {
      result.push({ ...category, depth })
      
      // Find and add children
      const children = categories.value.filter(c => c.parent_id === category.id)
      children.forEach(child => addWithChildren(child, depth + 1))
    }
    
    // Start with root categories
    roots.forEach(root => addWithChildren(root, 0))
    
    return result
  })
  
  // Fetch categories
  const fetchCategories = async () => {
    loading.value = true
    error.value = null
    try {
      categories.value = await getCategories()
    } catch (e: any) {
      error.value = e.message || 'Failed to load categories'
    } finally {
      loading.value = false
    }
  }
  
  // Modal functions
  const openCreateModal = () => {
    editingCategory.value = null
    form.value = {
      name: '',
      description: '',
      parent_id: null,
      is_active: true,
    }
    formError.value = null
    showModal.value = true
  }
  
  const openEditModal = (category: Category) => {
    editingCategory.value = category
    form.value = {
      name: category.name,
      description: category.description || '',
      parent_id: category.parent_id,
      is_active: category.is_active,
    }
    formError.value = null
    showModal.value = true
  }
  
  const closeModal = () => {
    showModal.value = false
    editingCategory.value = null
  }
  
  // Submit form
  const handleSubmit = async () => {
    submitting.value = true
    formError.value = null
  
    try {
      if (editingCategory.value) {
        await updateCategory(editingCategory.value.id, form.value)
      } else {
        await createCategory(form.value)
      }
      closeModal()
      await fetchCategories()
    } catch (e: any) {
      formError.value = e.message || 'Failed to save category'
    } finally {
      submitting.value = false
    }
  }
  
  // Delete functions
  const confirmDelete = (category: Category) => {
    deletingCategory.value = category
    showDeleteModal.value = true
  }
  
  const handleDelete = async () => {
    if (!deletingCategory.value) return
  
    deleting.value = true
    try {
      await deleteCategory(deletingCategory.value.id)
      showDeleteModal.value = false
      deletingCategory.value = null
      await fetchCategories()
    } catch (e: any) {
      console.error('Failed to delete:', e)
    } finally {
      deleting.value = false
    }
  }
  
  // Load on mount
  onMounted(() => {
    fetchCategories()
  })
  </script>