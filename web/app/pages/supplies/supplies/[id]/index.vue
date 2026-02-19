<template>
  <InventoryDetail
    back-link="/supplies"
    back-label="Back to Supplies"
    base-path="/supplies"
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
