export const useCategories = () => {
    const { apiFetch } = useApi()
  
    // Fetch all categories
    const getCategories = async () => {
      return await apiFetch<Category[]>('/categories')
    }
  
    // Fetch single category
    const getCategory = async (id: number) => {
      return await apiFetch<Category>(`/categories/${id}`)
    }
  
    // Create category
    const createCategory = async (data: CategoryForm) => {
      return await apiFetch<Category>('/categories', {
        method: 'POST',
        body: data,
      })
    }
  
    // Update category
    const updateCategory = async (id: number, data: CategoryForm) => {
      return await apiFetch<Category>(`/categories/${id}`, {
        method: 'PUT',
        body: data,
      })
    }
  
    // Delete category
    const deleteCategory = async (id: number) => {
      return await apiFetch(`/categories/${id}`, {
        method: 'DELETE',
      })
    }
  
    return {
      getCategories,
      getCategory,
      createCategory,
      updateCategory,
      deleteCategory,
    }
  }