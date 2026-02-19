<template>
  <InventoryForm
    title="Add New Supply"
    subtitle="Create a new packaging or supply item"
    back-link="/supplies"
    back-label="Back to Supplies"
    :allowed-types="['packaging', 'supply']"
    default-type="packaging"
    :show-sale-price="false"
    submit-label="Create Supply"
    name-placeholder="e.g., 12oz Glass Jar"
    sku-placeholder="e.g., PKG-JAR-001"
  />
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})
</script>
