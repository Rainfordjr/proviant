<script setup lang="ts">
    const { isAuthenticated } = useAuth()
    
    // Redirect based on auth status
    // Logged in → dashboard, Not logged in → login
    await navigateTo(isAuthenticated.value ? '/dashboard' : '/login', { replace: true })
    </script>
    
    <template>
      <div></div>
    </template>