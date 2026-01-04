/**
 * API Composable
 * Provides authenticated API calls using the auth token from cookies.
 */
export const useApi = () => {
  const config = useRuntimeConfig()
  const apiBase = config.public.apiBase as string
  const token = useCookie('auth_token')

  /**
   * Make an authenticated API request
   */
  const apiFetch = async <T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
      body?: Record<string, unknown>
      query?: Record<string, string | number | boolean | undefined>
    } = {}
  ): Promise<T> => {
    const { method = 'GET', body, query } = options

    return await $fetch<T>(`${apiBase}${endpoint}`, {
      method,
      body,
      query,
      headers: {
        Authorization: `Bearer ${token.value}`,
        Accept: 'application/json',
      },
    })
  }

  return {
    apiFetch,
  }
}
