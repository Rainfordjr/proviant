export default defineNuxtConfig({
    compatibilityDate: '2025-05-14',
    devtools: { enabled: true },
    ssr: false,
  
    modules: [
      '@nuxt/eslint',
      '@nuxt/icon',
      '@nuxtjs/tailwindcss',
    ],
  
    tailwindcss: {
      config: {
        content: [
          './app/**/*.{vue,js,ts}',
          './components/**/*.{vue,js,ts}',
          './layouts/**/*.{vue,js,ts}',
          './pages/**/*.{vue,js,ts}',
        ],
        theme: {
          extend: {
            colors: {
              'forest': {
                50: '#E8F5E9',
                100: '#C8E6C9',
                200: '#A5D6A7',
                300: '#81C784',
                400: '#66BB6A',
                500: '#4CAF50',
                600: '#43A047',
                700: '#388E3C',
                800: '#2E7D32',
                900: '#1B5E20',
                950: '#2D5A3D',
              },
              'slate-blue': {
                50: '#E3EDF7',
                100: '#C7DBF0',
                200: '#9FC3E8',
                300: '#77ABE0',
                400: '#5C8FC4',
                500: '#3D5A80',
                600: '#344D6E',
                700: '#2B405C',
                800: '#22334A',
                900: '#192638',
              },
            },
            fontFamily: {
              sans: ['Inter', 'system-ui', 'sans-serif'],
            },
          },
        },
      },
    },
  
    runtimeConfig: {
      public: {
        apiBase: 'http://localhost/api'
      }
    }
  })