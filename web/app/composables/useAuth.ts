/**
 * Auth Composable
 * Handles authentication state, login, logout, and registration.
 * Uses cookies for token storage so auth works on both server and client.
 */

interface User {
    id: number
    name: string
    email: string
    role: string
    tenant_id: number
  }
  
  interface Tenant {
    id: number
    name: string
    slug: string
    plan: string
    status: string
  }
  
  interface AuthState {
    user: User | null
    tenant: Tenant | null
  }
  
  export const useAuth = () => {
    // Use cookie for token - accessible on both server and client
    const token = useCookie('auth_token', {
      maxAge: 60 * 60 * 24 * 7, // 7 days
      sameSite: 'lax',
    })
  
    // Use useState for user/tenant data
    const state = useState<AuthState>('auth', () => ({
      user: null,
      tenant: null,
    }))
  
    const config = useRuntimeConfig()
    const apiBase = config.public.apiBase as string
  
    // Computed properties
    const user = computed(() => state.value.user)
    const tenant = computed(() => state.value.tenant)
    const isAuthenticated = computed(() => !!token.value && !!state.value.user)
  
    /**
     * Fetch current user from API using stored token
     * Used to restore session on page refresh
     */
    const fetchUser = async (): Promise<boolean> => {
      // No token? Not authenticated
      if (!token.value) return false
  
      // Already have user data? No need to fetch
      if (state.value.user) return true
  
      try {
        const response = await $fetch<{ user: User; tenant: Tenant }>(`${apiBase}/user`, {
          headers: {
            Authorization: `Bearer ${token.value}`,
            Accept: 'application/json',
          },
        })
  
        state.value.user = response.user
        state.value.tenant = response.tenant
        return true
      } catch (error) {
        // Token invalid or expired - clear auth state
        console.warn('Failed to fetch user, clearing auth state')
        clearAuth()
        return false
      }
    }
  
    /**
     * Register a new user and company
     */
    const register = async (data: {
      company_name: string
      name: string
      email: string
      password: string
      password_confirmation: string
    }) => {
      const response = await $fetch<{ user: User; tenant: Tenant; token: string }>(
        `${apiBase}/register`,
        {
          method: 'POST',
          body: data,
          headers: {
            Accept: 'application/json',
          },
        }
      )
  
      setAuth(response.user, response.tenant, response.token)
      return response
    }
  
    /**
     * Login with email and password
     */
    const login = async (email: string, password: string) => {
      const response = await $fetch<{ user: User; tenant: Tenant; token: string }>(
        `${apiBase}/login`,
        {
          method: 'POST',
          body: { email, password },
          headers: {
            Accept: 'application/json',
          },
        }
      )
  
      setAuth(response.user, response.tenant, response.token)
      return response
    }
  
    /**
     * Logout current user
     */
    const logout = async () => {
      try {
        if (token.value) {
          await $fetch(`${apiBase}/logout`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token.value}`,
              Accept: 'application/json',
            },
          })
        }
      } catch (error) {
        // Ignore logout errors - we'll clear local state anyway
        console.warn('Logout API call failed:', error)
      } finally {
        clearAuth()
      }
    }
  
    /**
     * Set auth state and persist token
     */
    const setAuth = (user: User, tenant: Tenant, newToken: string) => {
      state.value.user = user
      state.value.tenant = tenant
      token.value = newToken
    }
  
    /**
     * Clear auth state and remove persisted token
     */
    const clearAuth = () => {
      state.value.user = null
      state.value.tenant = null
      token.value = null
    }
  
    return {
      // State
      user,
      tenant,
      token: computed(() => token.value),
      isAuthenticated,
  
      // Actions
      login,
      logout,
      register,
      fetchUser,
    }
  }