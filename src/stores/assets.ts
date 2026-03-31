import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiClient } from '@/api/axios'
import { unwrapPayload, parsePaginatedResponse, getErrorMessage } from '@/api/utils'
import type { Asset } from '@/types'
import type { PaginatedPayload } from '@/types'

export const useAssetsStore = defineStore('assets', () => {
  const items = ref<Asset[]>([])
  const meta = ref<PaginatedPayload<Asset>['meta'] | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const total = computed(() => meta.value?.total ?? 0)
  const currentPage = computed(() => meta.value?.current_page ?? 1)
  const lastPage = computed(() => meta.value?.last_page ?? 1)
  const perPage = computed(() => meta.value?.per_page ?? 15)

  async function fetchPage(
    page = 1,
    perPageCount = 15,
    search?: string,
    assetCategoryId?: number | null,
    status?: string | null,
  ) {
    loading.value = true
    error.value = null
    try {
      const params: Record<string, number | string> = { page, per_page: perPageCount }
      if (search && search.trim()) params.search = search.trim()
      if (assetCategoryId != null && assetCategoryId > 0) params.asset_category_id = assetCategoryId
      if (status && status.trim()) params.status = status.trim()
      const { data } = await apiClient.get('/api/assets', { params })
      const payload = parsePaginatedResponse<Asset>(data)
      items.value = payload.data ?? []
      meta.value = payload.meta
      return payload
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحميل الأصول')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function create(asset: Omit<Asset, 'id'>) {
    loading.value = true
    error.value = null
    try {
      const payload: Record<string, unknown> = {
        name: asset.name,
        asset_category_id: asset.asset_category_id ?? null,
        purchase_price: asset.purchase_price,
        purchase_date: asset.purchase_date,
        status: asset.status,
        location: asset.location?.trim() || null,
        notes: asset.notes?.trim() || null,
      }
      const a = asset as { auto_generate_code?: boolean; code?: string }
      if (a.auto_generate_code) payload.auto_generate_code = true
      else if (a.code != null && String(a.code).trim() !== '') payload.code = String(a.code).trim()
      const { data } = await apiClient.post('/api/assets', payload)
      const created = unwrapPayload<Asset>(data)
      items.value = [created, ...items.value]
      return created
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل إضافة الأصل')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function update(id: number, asset: Partial<Asset>) {
    loading.value = true
    error.value = null
    try {
      const payload: Record<string, unknown> = {
        name: asset.name,
        asset_category_id: asset.asset_category_id ?? null,
        purchase_price: asset.purchase_price,
        purchase_date: asset.purchase_date,
        status: asset.status,
        location: asset.location?.trim() || null,
        notes: asset.notes?.trim() || null,
      }
      const a = asset as { auto_generate_code?: boolean; code?: string }
      if (a.auto_generate_code) payload.auto_generate_code = true
      else if (a.code !== undefined) payload.code = a.code
      const { data } = await apiClient.put(`/api/assets/${id}`, payload)
      const updated = unwrapPayload<Asset>(data)
      const idx = items.value.findIndex((x) => x.id === id)
      if (idx !== -1) items.value[idx] = updated
      return updated
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحديث الأصل')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function remove(id: number) {
    loading.value = true
    error.value = null
    try {
      await apiClient.delete(`/api/assets/${id}`)
      items.value = items.value.filter((x) => x.id !== id)
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل حذف الأصل')
      throw e
    } finally {
      loading.value = false
    }
  }

  const byId = computed(() => (id: number) => items.value.find((x) => x.id === id))

  function clearError() {
    error.value = null
  }

  return {
    items,
    meta,
    loading,
    error,
    total,
    currentPage,
    lastPage,
    perPage,
    fetchPage,
    create,
    update,
    remove,
    byId,
    clearError,
  }
})
