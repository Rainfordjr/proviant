/**
 * Auth Middleware
 * Protects routes that require authentication.
 * Redirects to /login if user is not authenticated.
 * Works on both server and client since we use cookies for token storage.
 */
export default defineNuxtRouteMiddleware(async () => {
    const { isAuthenticated, fetchUser } = useAuth()
  
    // Try to restore session if we have a token but no user data
    if (!isAuthenticated.value) {
      await fetchUser()
    }
  
    // Still not authenticated? Redirect to login
    if (!isAuthenticated.value) {
      return navigateTo('/login', { replace: true })
    }
  })