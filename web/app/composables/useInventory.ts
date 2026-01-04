/**
 * Inventory Composable
 * Provides inventory-related API operations.
 */

export interface Category {
  id: number
  name: string
  description: string | null
  parent_id: number | null
  is_active: boolean
  items_count?: number
  parent?: { id: number; name: string } | null
}

export interface Item {
  id: number
  name: string
  sku: string | null
  description: string | null
  category_id: number | null
  category?: { id: number; name: string } | null
  item_type: 'raw_material' | 'finished_product' | 'packaging' | 'ingredient' | 'supply'
  unit_of_measure: string
  current_stock: number
  min_stock_level: number
  max_stock_level: number | null
  cost_price: number | null
  sale_price: number | null
  shelf_life_days: number | null
  storage_requirements: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PaginatedItems {
  data: Item[]
  current_page: number
  last_page: number
  per_page: number
  total: number
}

export interface InventorySummary {
  total_items: number
  active_items: number
  low_stock_count: number
  out_of_stock_count: number
  total_value: number
  by_type: Record<string, number>
}

export interface ItemFilters {
  search?: string
  category_id?: number
  item_type?: string
  is_active?: boolean
  low_stock?: boolean
  sort?: string
  direction?: 'asc' | 'desc'
  page?: number
  per_page?: number
}

export const useInventory = () => {
  const { apiFetch } = useApi()

  // ---------- Categories ----------

  const getCategories = async (): Promise<Category[]> => {
    return await apiFetch<Category[]>('/categories')
  }

  const getCategory = async (id: number): Promise<Category> => {
    return await apiFetch<Category>(`/categories/${id}`)
  }

  const createCategory = async (data: Partial<Category>): Promise<Category> => {
    return await apiFetch<Category>('/categories', {
      method: 'POST',
      body: data,
    })
  }

  const updateCategory = async (id: number, data: Partial<Category>): Promise<Category> => {
    return await apiFetch<Category>(`/categories/${id}`, {
      method: 'PUT',
      body: data,
    })
  }

  const deleteCategory = async (id: number): Promise<void> => {
    await apiFetch(`/categories/${id}`, { method: 'DELETE' })
  }

  // ---------- Items ----------

  const getItems = async (filters: ItemFilters = {}): Promise<PaginatedItems> => {
    const query: Record<string, string | number | boolean | undefined> = {}
    
    if (filters.search) query.search = filters.search
    if (filters.category_id) query.category_id = filters.category_id
    if (filters.item_type) query.item_type = filters.item_type
    if (filters.is_active !== undefined) query.is_active = filters.is_active
    if (filters.low_stock) query.low_stock = filters.low_stock
    if (filters.sort) query.sort = filters.sort
    if (filters.direction) query.direction = filters.direction
    if (filters.page) query.page = filters.page
    if (filters.per_page) query.per_page = filters.per_page

    return await apiFetch<PaginatedItems>('/items', { query })
  }

  const getItem = async (id: number): Promise<Item> => {
    return await apiFetch<Item>(`/items/${id}`)
  }

  const createItem = async (data: Partial<Item>): Promise<Item> => {
    return await apiFetch<Item>('/items', {
      method: 'POST',
      body: data,
    })
  }

  const updateItem = async (id: number, data: Partial<Item>): Promise<Item> => {
    return await apiFetch<Item>(`/items/${id}`, {
      method: 'PUT',
      body: data,
    })
  }

  const deleteItem = async (id: number): Promise<void> => {
    await apiFetch(`/items/${id}`, { method: 'DELETE' })
  }

  const adjustStock = async (id: number, adjustment: number, reason?: string): Promise<void> => {
    await apiFetch(`/items/${id}/adjust-stock`, {
      method: 'POST',
      body: { adjustment, reason },
    })
  }

  // ---------- Helpers ----------

  const getItemTypes = async (): Promise<Record<string, string>> => {
    return await apiFetch<Record<string, string>>('/items/types')
  }

  const getUnitsOfMeasure = async (): Promise<Record<string, string>> => {
    return await apiFetch<Record<string, string>>('/items/units')
  }

  const getLowStockItems = async (): Promise<Item[]> => {
    return await apiFetch<Item[]>('/items/low-stock')
  }

  const getInventorySummary = async (): Promise<InventorySummary> => {
    return await apiFetch<InventorySummary>('/items/summary')
  }

  return {
    // Categories
    getCategories,
    getCategory,
    createCategory,
    updateCategory,
    deleteCategory,

    // Items
    getItems,
    getItem,
    createItem,
    updateItem,
    deleteItem,
    adjustStock,

    // Helpers
    getItemTypes,
    getUnitsOfMeasure,
    getLowStockItems,
    getInventorySummary,
  }
}
