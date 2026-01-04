/**
 * Guest Middleware
 * For pages that should only be accessible to non-authenticated users.
 * Redirects to /dashboard if user is already logged in.
 */
export default defineNuxtRouteMiddleware(async () => {
    const { isAuthenticated, fetchUser } = useAuth()
  
    // Try to restore session if we have a token
    if (!isAuthenticated.value) {
      await fetchUser()
    }
  
    // Already logged in? Redirect to dashboard
    if (isAuthenticated.value) {
      return navigateTo('/dashboard', { replace: true })
    }
  })