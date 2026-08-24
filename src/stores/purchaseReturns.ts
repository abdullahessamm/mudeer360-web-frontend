import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiClient } from '@/api/axios'
import { unwrapPayload, parsePaginatedResponse, getErrorMessage } from '@/api/utils'
import type { PurchaseReturn, PurchaseReturnCreatePayload, PaginatedPayload } from '@/types'

const API_BASE = '/api/purchase-returns'

export const usePurchaseReturnsStore = defineStore('purchaseReturns', () => {
  const items = ref<PurchaseReturn[]>([])
  const meta = ref<PaginatedPayload<PurchaseReturn>['meta'] | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const summary = ref<{ total_amount: number; total_returns: number }>({
    total_amount: 0,
    total_returns: 0,
  })

  const total = computed(() => meta.value?.total ?? 0)
  const currentPage = computed(() => meta.value?.current_page ?? 1)
  const lastPage = computed(() => meta.value?.last_page ?? 1)
  const perPage = computed(() => meta.value?.per_page ?? 15)

  async function fetchPage(
    page = 1,
    perPageCount = 15,
    filters?: {
      supplier_id?: number | null
      purchase_invoice_id?: number | null
      date_from?: string
      date_to?: string
    },
  ) {
    loading.value = true
    error.value = null
    try {
      const params: Record<string, number | string> = { page, per_page: perPageCount }
      if (filters?.supplier_id) params.supplier_id = filters.supplier_id
      if (filters?.purchase_invoice_id) params.purchase_invoice_id = filters.purchase_invoice_id
      if (filters?.date_from) params.date_from = filters.date_from
      if (filters?.date_to) params.date_to = filters.date_to

      const { data } = await apiClient.get(API_BASE, { params })
      const res = data as {
        success?: boolean
        payload?: { data?: unknown[]; meta?: unknown; links?: unknown; summary?: Record<string, number> }
      }
      const rawPayload = res?.success && res?.payload ? res.payload : data
      const payload = parsePaginatedResponse<PurchaseReturn>(rawPayload)
      items.value = payload.data ?? []
      meta.value = payload.meta
      if (rawPayload && typeof rawPayload === 'object' && 'summary' in rawPayload) {
        const s = (rawPayload as { summary: Record<string, number> }).summary
        summary.value = {
          total_amount: s?.total_amount ?? 0,
          total_returns: s?.total_returns ?? 0,
        }
      }
      return payload
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحميل مرتجعات المشتريات')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function create(payload: PurchaseReturnCreatePayload): Promise<PurchaseReturn> {
    loading.value = true
    error.value = null
    try {
      const { data } = await apiClient.post(API_BASE, payload)
      const created = unwrapPayload<PurchaseReturn>(data)
      items.value = [created, ...items.value]
      return created
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل إنشاء المرتجع')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function update(id: number, payload: PurchaseReturnCreatePayload): Promise<PurchaseReturn> {
    loading.value = true
    error.value = null
    try {
      const { data } = await apiClient.put(`${API_BASE}/${id}`, payload)
      const updated = unwrapPayload<PurchaseReturn>(data)
      const idx = items.value.findIndex((r) => r.id === id)
      if (idx !== -1) items.value[idx] = updated
      return updated
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحديث المرتجع')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function remove(id: number): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await apiClient.delete(`${API_BASE}/${id}`)
      items.value = items.value.filter((r) => r.id !== id)
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل حذف المرتجع')
      throw e
    } finally {
      loading.value = false
    }
  }

  /** Fetch a single purchase invoice by id (for auto-fill). */
  async function fetchPurchaseInvoice(invoiceId: number) {
    const { data } = await apiClient.get(`/api/purchase-invoices/${invoiceId}`)
    return unwrapPayload<import('@/types').PurchaseInvoice>(data)
  }

  function clearError() {
    error.value = null
  }

  return {
    items,
    meta,
    summary,
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
    fetchPurchaseInvoice,
    clearError,
  }
})
