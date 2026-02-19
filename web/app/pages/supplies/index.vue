<template>
  <InventoryList
    title="Supplies"
    subtitle="Manage your packaging and supplies"
    :allowed-types="['packaging', 'supply']"
    base-path="/supplies"
    add-new-link="/supplies/new"
    add-new-label="Add Supply"
    empty-icon="lucide:boxes"
    empty-message="Get started by adding your first supply item"
    price-label="Cost"
  />
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})
</script>
