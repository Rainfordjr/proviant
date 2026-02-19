<template>
  <InventoryDetail
    back-link="/products"
    back-label="Back to Products"
    base-path="/products"
    :show-sale-price="true"
    :show-type="false"
  />
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})
</script>
