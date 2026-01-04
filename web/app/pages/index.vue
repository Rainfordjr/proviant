<template>
    <div class="min-h-screen bg-gray-50 flex items-center justify-center">
      <div class="text-center">
        <h1 class="text-4xl font-bold text-forest-950 mb-4">Proviant</h1>
        <p class="text-slate-blue-500 text-lg mb-8">Food Production ERP</p>
        <div class="space-x-4">
          <NuxtLink
            to="/login"
            class="bg-forest-950 text-white px-6 py-2 rounded-lg hover:bg-forest-800 inline-block"
          >
            Sign In
          </NuxtLink>
          <NuxtLink
            to="/register"
            class="border border-slate-blue-500 text-slate-blue-500 px-6 py-2 rounded-lg hover:bg-slate-blue-50 inline-block"
          >
            Register
          </NuxtLink>
        </div>
      </div>
    </div>
  </template>