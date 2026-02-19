<template>
  <InventoryEdit
    title="Edit Supply"
    subtitle="Update supply item details"
    back-link="/supplies"
    back-label="Back to Supplies"
    :allowed-types="['packaging', 'supply']"
    :show-sale-price="false"
  />
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})
</script>
