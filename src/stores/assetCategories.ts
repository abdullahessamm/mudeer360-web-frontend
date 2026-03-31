import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiClient } from '@/api/axios'
import { unwrapPayload, parsePaginatedResponse, getErrorMessage } from '@/api/utils'
import type { AssetCategory } from '@/types'
import type { PaginatedPayload } from '@/types'

export const useAssetCategoriesStore = defineStore('assetCategories', () => {
  const items = ref<AssetCategory[]>([])
  const allCategories = ref<AssetCategory[]>([])
  const meta = ref<PaginatedPayload<AssetCategory>['meta'] | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const total = computed(() => meta.value?.total ?? 0)
  const currentPage = computed(() => meta.value?.current_page ?? 1)
  const lastPage = computed(() => meta.value?.last_page ?? 1)
  const perPage = computed(() => meta.value?.per_page ?? 15)

  async function fetchPage(page = 1, perPageCount = 15, search?: string) {
    loading.value = true
    error.value = null
    try {
      const params: Record<string, number | string> = { page, per_page: perPageCount }
      if (search && search.trim()) params.search = search.trim()
      const { data } = await apiClient.get('/api/asset-categories', { params })
      const payload = parsePaginatedResponse<AssetCategory>(data)
      items.value = payload.data ?? []
      meta.value = payload.meta
      return payload
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحميل فئات الأصول')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchAllForSelect() {
    try {
      const { data } = await apiClient.get('/api/asset-categories', {
        params: { per_page: 1000 },
      })
      const payload = parsePaginatedResponse<AssetCategory>(data)
      allCategories.value = payload.data ?? []
      return allCategories.value
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحميل فئات الأصول')
      throw e
    }
  }

  async function create(category: Omit<AssetCategory, 'id' | 'created_at' | 'updated_at'>) {
    loading.value = true
    error.value = null
    try {
      const { data } = await apiClient.post('/api/asset-categories', {
        name: category.name,
      })
      const created = unwrapPayload<AssetCategory>(data)
      items.value = [created, ...items.value]
      return created
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل إضافة الفئة')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function update(id: number, category: Partial<AssetCategory>) {
    loading.value = true
    error.value = null
    try {
      const { data } = await apiClient.put(`/api/asset-categories/${id}`, {
        name: category.name,
      })
      const updated = unwrapPayload<AssetCategory>(data)
      const idx = items.value.findIndex((c) => c.id === id)
      if (idx !== -1) items.value[idx] = updated
      return updated
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحديث الفئة')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function remove(id: number) {
    loading.value = true
    error.value = null
    try {
      await apiClient.delete(`/api/asset-categories/${id}`)
      items.value = items.value.filter((c) => c.id !== id)
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل حذف الفئة')
      throw e
    } finally {
      loading.value = false
    }
  }

  function clearError() {
    error.value = null
  }

  return {
    items,
    allCategories,
    meta,
    loading,
    error,
    total,
    currentPage,
    lastPage,
    perPage,
    fetchPage,
    fetchAllForSelect,
    create,
    update,
    remove,
    clearError,
  }
})
