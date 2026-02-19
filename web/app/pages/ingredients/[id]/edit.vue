<template>
  <InventoryEdit
    title="Edit Ingredient"
    subtitle="Update ingredient details"
    back-link="/ingredients"
    back-label="Back to Ingredients"
    :allowed-types="['raw_material', 'ingredient']"
    :show-sale-price="false"
  />
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})
</script>
