<template>
  <InventoryEdit
    title="Edit Product"
    subtitle="Update product details"
    back-link="/products"
    back-label="Back to Products"
    :allowed-types="['finished_product']"
    :show-sale-price="true"
  />
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})
</script>
