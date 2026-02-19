<template>
  <InventoryList
    title="Products"
    subtitle="Manage your finished products"
    :allowed-types="['finished_product']"
    base-path="/products"
    add-new-link="/products/new"
    add-new-label="Add Product"
    empty-icon="lucide:package-check"
    empty-message="Get started by adding your first product"
    price-label="Price"
    :show-sale-price="true"
  />
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})
</script>
