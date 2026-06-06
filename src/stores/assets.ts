import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiClient } from '@/api/axios'
import { unwrapPayload, parsePaginatedResponse, getErrorMessage } from '@/api/utils'
import type { Asset } from '@/types'
import type { PaginatedPayload } from '@/types'

export type AssetWritePayload = Partial<Asset> & {
  auto_generate_code?: boolean
  create_financial_transaction?: boolean
  financial_account_id?: number | null
}

/** Fixed assets on balance sheet: sum of purchase_price grouped by asset category. */
export interface FixedAssetsCategoryRow {
  key: string
  asset_category_id: number | null
  category: string
  count: number
  total: number
}

export interface FixedAssetsSummary {
  by_category: FixedAssetsCategoryRow[]
  total: number
}

function summarizeFixedAssets(assets: Asset[]): FixedAssetsSummary {
  const active = assets.filter((a) => a.status !== 'excluded')
  const map = new Map<string, FixedAssetsCategoryRow>()

  for (const a of active) {
    const categoryId = a.asset_category_id ?? null
    const key = categoryId != null ? String(categoryId) : '_none'
    const category = a.category?.name?.trim() || 'بدون فئة'
    const row = map.get(key) ?? {
      key,
      asset_category_id: categoryId,
      category,
      count: 0,
      total: 0,
    }
    row.count += 1
    row.total += a.purchase_price
    map.set(key, row)
  }

  const by_category = [...map.values()].sort((a, b) =>
    a.category.localeCompare(b.category, 'ar'),
  )
  const total = by_category.reduce((sum, row) => sum + row.total, 0)
  return { by_category, total }
}

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

  /** Build body matching StoreAssetRequest / UpdateAssetRequest validation. */
  function buildAssetApiPayload(asset: AssetWritePayload): Record<string, unknown> {
    const createFt = asset.create_financial_transaction === true
    const payload: Record<string, unknown> = {
      name: asset.name,
      purchase_price: asset.purchase_price,
      purchase_date: asset.purchase_date,
      status: asset.status,
      create_financial_transaction: createFt,
    }

    if (asset.asset_category_id != null) {
      payload.asset_category_id = asset.asset_category_id
    }

    const location = asset.location?.trim()
    if (location) payload.location = location

    const notes = asset.notes?.trim()
    if (notes) payload.notes = notes

    if (createFt && asset.financial_account_id != null) {
      payload.financial_account_id = asset.financial_account_id
    }

    if (asset.auto_generate_code) {
      payload.auto_generate_code = true
    } else {
      const code = asset.code?.trim()
      if (code) payload.code = code
    }

    return payload
  }

  async function create(asset: Omit<Asset, 'id'> & AssetWritePayload) {
    loading.value = true
    error.value = null
    try {
      const payload = buildAssetApiPayload(asset)
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

  async function update(id: number, asset: AssetWritePayload) {
    loading.value = true
    error.value = null
    try {
      const payload = buildAssetApiPayload(asset)
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

  /** All assets from the module (all pages). Does not toggle list loading. */
  async function fetchAllForReport(): Promise<Asset[]> {
    const all: Asset[] = []
    try {
      let page = 1
      let last = 1
      do {
        const { data } = await apiClient.get('/api/assets', { params: { page, per_page: 100 } })
        const payload = parsePaginatedResponse<Asset>(data)
        all.push(...(payload.data ?? []))
        last = payload.meta?.last_page ?? 1
        page += 1
      } while (page <= last)
    } catch {
      return all
    }
    return all
  }

  /** Sum assets value (purchase_price) for قائمة المركز المالي — أصول ثابتة. */
  async function getFixedAssetsSummary(): Promise<FixedAssetsSummary> {
    return summarizeFixedAssets(await fetchAllForReport())
  }

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
    fetchAllForReport,
    getFixedAssetsSummary,
    clearError,
  }
})
