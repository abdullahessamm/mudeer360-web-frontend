<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    icon?: string
    loading?: boolean
  }>(),
  {
    subtitle: '',
    icon: 'pi-chart-bar',
    loading: false,
  },
)
</script>

<template>
  <div dir="rtl" class="bs-page">
    <div class="bs-hero">
      <div class="bs-hero-text">
        <div class="bs-hero-badge">
          <i class="pi" :class="icon"></i>
        </div>
        <div>
          <h1 class="bs-hero-title">{{ title }}</h1>
          <p v-if="subtitle" class="bs-hero-sub">{{ subtitle }}</p>
        </div>
      </div>
      <div v-if="$slots.toolbar" class="bs-hero-actions">
        <slot name="toolbar" />
      </div>
    </div>

    <div v-if="$slots.filters" class="bs-filters">
      <slot name="filters" />
    </div>

    <div v-if="loading" class="bs-loading">
      <i class="pi pi-spin pi-spinner"></i>
      <span>جاري تحميل البيانات...</span>
    </div>

    <div v-else class="bs-body">
      <slot />
    </div>
  </div>
</template>
