<template>
  <InventoryForm
    title="Add New Ingredient"
    subtitle="Create a new raw material or ingredient"
    back-link="/ingredients"
    back-label="Back to Ingredients"
    :allowed-types="['raw_material', 'ingredient']"
    default-type="raw_material"
    :show-sale-price="false"
    submit-label="Create Ingredient"
    name-placeholder="e.g., Organic Rolled Oats"
    sku-placeholder="e.g., ING-OATS-001"
  />
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})
</script>
