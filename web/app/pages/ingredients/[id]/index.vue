<template>
  <InventoryDetail
    back-link="/ingredients"
    back-label="Back to Ingredients"
    base-path="/ingredients"
    :show-sale-price="false"
    :show-type="true"
  />
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})
</script>
