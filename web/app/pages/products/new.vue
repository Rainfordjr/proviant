<template>
  <InventoryForm
    title="Add New Product"
    subtitle="Create a new finished product"
    back-link="/products"
    back-label="Back to Products"
    :allowed-types="['finished_product']"
    default-type="finished_product"
    :show-sale-price="true"
    submit-label="Create Product"
    name-placeholder="e.g., Organic Granola Bar"
    sku-placeholder="e.g., PROD-GRAN-001"
  />
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})
</script>
