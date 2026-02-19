<template>
  <InventoryList
    title="Ingredients"
    subtitle="Manage your raw materials and ingredients"
    :allowed-types="['raw_material', 'ingredient']"
    base-path="/ingredients"
    add-new-link="/ingredients/new"
    add-new-label="Add Ingredient"
    empty-icon="lucide:wheat"
    empty-message="Get started by adding your first ingredient"
    price-label="Cost"
  />
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})
</script>
