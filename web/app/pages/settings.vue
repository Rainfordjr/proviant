<template>
  <div>
    <div class="mb-8">
      <h2 class="text-2xl font-bold text-gray-900">Settings</h2>
      <p class="text-gray-500 mt-1">Manage your account and company preferences</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <!-- Company Settings -->
      <div class="bg-white rounded-xl border border-gray-200 p-6 hover:border-forest-300 transition-colors cursor-pointer">
        <div class="w-12 h-12 bg-forest-100 rounded-lg flex items-center justify-center mb-4">
          <Icon name="lucide:building-2" class="w-6 h-6 text-forest-600" />
        </div>
        <h3 class="text-lg font-semibold text-gray-900 mb-2">Company</h3>
        <p class="text-sm text-gray-500">Update company name, logo, and contact information</p>
      </div>

      <!-- User Management -->
      <div class="bg-white rounded-xl border border-gray-200 p-6 hover:border-forest-300 transition-colors cursor-pointer">
        <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
          <Icon name="lucide:users" class="w-6 h-6 text-blue-600" />
        </div>
        <h3 class="text-lg font-semibold text-gray-900 mb-2">Team Members</h3>
        <p class="text-sm text-gray-500">Invite users, manage roles and permissions</p>
      </div>

      <!-- Billing -->
      <div class="bg-white rounded-xl border border-gray-200 p-6 hover:border-forest-300 transition-colors cursor-pointer">
        <div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
          <Icon name="lucide:credit-card" class="w-6 h-6 text-purple-600" />
        </div>
        <h3 class="text-lg font-semibold text-gray-900 mb-2">Billing</h3>
        <p class="text-sm text-gray-500">Manage subscription, view invoices, update payment</p>
      </div>

      <!-- Locations -->
      <div class="bg-white rounded-xl border border-gray-200 p-6 hover:border-forest-300 transition-colors cursor-pointer">
        <div class="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mb-4">
          <Icon name="lucide:map-pin" class="w-6 h-6 text-amber-600" />
        </div>
        <h3 class="text-lg font-semibold text-gray-900 mb-2">Locations</h3>
        <p class="text-sm text-gray-500">Manage warehouses, production facilities, and stores</p>
      </div>

      <!-- Integrations -->
      <div class="bg-white rounded-xl border border-gray-200 p-6 hover:border-forest-300 transition-colors cursor-pointer">
        <div class="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center mb-4">
          <Icon name="lucide:plug" class="w-6 h-6 text-pink-600" />
        </div>
        <h3 class="text-lg font-semibold text-gray-900 mb-2">Integrations</h3>
        <p class="text-sm text-gray-500">Connect with QuickBooks, Shopify, and other tools</p>
      </div>

      <!-- Profile -->
      <div class="bg-white rounded-xl border border-gray-200 p-6 hover:border-forest-300 transition-colors cursor-pointer">
        <div class="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
          <Icon name="lucide:user" class="w-6 h-6 text-gray-600" />
        </div>
        <h3 class="text-lg font-semibold text-gray-900 mb-2">Your Profile</h3>
        <p class="text-sm text-gray-500">Update your name, email, and password</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})
</script>
