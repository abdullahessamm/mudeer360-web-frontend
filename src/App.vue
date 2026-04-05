<script setup lang="ts">
</script>

<template>
  <div id="app" class="min-h-screen" dir="rtl">
    <Toast position="top-left" />
    <ConfirmDialog />
    <router-view v-slot="{ Component }">
      <Transition name="fade" mode="out-in">
        <component :is="Component" />
      </Transition>
    </router-view>
  </div>
</template>
