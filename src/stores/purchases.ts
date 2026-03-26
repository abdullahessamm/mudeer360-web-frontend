import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiClient } from '@/api/axios'
import { unwrapPayload, parsePaginatedResponse, getErrorMessage } from '@/api/utils'
import type {
  PurchaseInvoice,
  PurchaseInvoiceCreatePayload,
  PaymentPayload,
  PaginatedPayload,
} from '@/types'
import type { FinancialTransaction } from '@/types'

const API_BASE = '/api/purchase-invoices'

export const usePurchasesStore = defineStore('purchases', () => {
  const items = ref<PurchaseInvoice[]>([])
  const currentInvoice = ref<PurchaseInvoice | null>(null)
  const payments = ref<FinancialTransaction[]>([])
  const meta = ref<PaginatedPayload<PurchaseInvoice>['meta'] | null>(null)
  const indexLoading = ref(false)
  const showLoading = ref(false)
  const error = ref<string | null>(null)

  const total = computed(() => meta.value?.total ?? 0)
  const currentPage = computed(() => meta.value?.current_page ?? 1)
  const lastPage = computed(() => meta.value?.last_page ?? 1)
  const perPage = computed(() => meta.value?.per_page ?? 15)

  const summary = ref<{
    total_amount: number
    paid_amount: number
    remaining_amount: number
    total_received_amount: number
    total_remaining_receive: number
    total_dues: number
  }>({
    total_amount: 0,
    paid_amount: 0,
    remaining_amount: 0,
    total_received_amount: 0,
    total_remaining_receive: 0,
    total_dues: 0,
  })

  async function fetchPage(
    page = 1,
    perPageCount = 15,
    filters?: {
      supplier_id?: number | null
      status?: 'unpaid' | 'partial' | 'paid' | null
      type?: 'cash' | 'credit' | null
      date_from?: string
      date_to?: string
    }
  ) {
    indexLoading.value = true
    error.value = null
    try {
      const params: Record<string, number | string> = { page, per_page: perPageCount }
      if (filters?.supplier_id) params.supplier_id = filters.supplier_id
      if (filters?.status) params.status = filters.status
      if (filters?.type) params.type = filters.type
      if (filters?.date_from) params.date_from = filters.date_from
      if (filters?.date_to) params.date_to = filters.date_to
      const { data } = await apiClient.get(API_BASE, { params })
      const res = data as {
        success?: boolean
        payload?: {
          data?: unknown[]
          meta?: unknown
          links?: unknown
          summary?: Record<string, number>
        }
      }
      const rawPayload = res?.success && res?.payload ? res.payload : data
      const payload = parsePaginatedResponse<PurchaseInvoice>(rawPayload)
      items.value = payload.data ?? []
      meta.value = payload.meta
      if (rawPayload && typeof rawPayload === 'object' && 'summary' in rawPayload) {
        const s = (rawPayload as { summary: Record<string, number> }).summary
        summary.value = {
          total_amount: s?.total_amount ?? 0,
          paid_amount: s?.paid_amount ?? 0,
          remaining_amount: s?.remaining_amount ?? 0,
          total_received_amount: s?.total_received_amount ?? 0,
          total_remaining_receive: s?.total_remaining_receive ?? 0,
          total_dues: s?.total_dues ?? 0,
        }
      }
      return payload
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحميل فواتير الشراء')
      throw e
    } finally {
      indexLoading.value = false
    }
  }

  async function fetchById(id: number): Promise<PurchaseInvoice | null> {
    showLoading.value = true
    error.value = null
    try {
      const { data } = await apiClient.get(`${API_BASE}/${id}`)
      const invoice = unwrapPayload<PurchaseInvoice>(data)
      currentInvoice.value = invoice
      return invoice
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحميل الفاتورة')
      throw e
    } finally {
      showLoading.value = false
    }
  }

  async function create(payload: PurchaseInvoiceCreatePayload): Promise<PurchaseInvoice> {
    indexLoading.value = true
    error.value = null
    try {
      const { data } = await apiClient.post(API_BASE, payload)
      const created = unwrapPayload<PurchaseInvoice>(data)
      items.value = [created, ...items.value]
      return created
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل إنشاء الفاتورة')
      throw e
    } finally {
      indexLoading.value = false
    }
  }

  async function update(id: number, payload: PurchaseInvoiceCreatePayload): Promise<PurchaseInvoice> {
    indexLoading.value = true
    error.value = null
    try {
      const { data } = await apiClient.put(`${API_BASE}/${id}`, payload)
      const updated = unwrapPayload<PurchaseInvoice>(data)
      const idx = items.value.findIndex((p) => p.id === id)
      if (idx !== -1) items.value[idx] = updated
      if (currentInvoice.value?.id === id) currentInvoice.value = updated
      return updated
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحديث الفاتورة')
      throw e
    } finally {
      indexLoading.value = false
    }
  }

  async function remove(id: number): Promise<void> {
    indexLoading.value = true
    error.value = null
    try {
      await apiClient.delete(`${API_BASE}/${id}`)
      items.value = items.value.filter((p) => p.id !== id)
      if (currentInvoice.value?.id === id) currentInvoice.value = null
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل حذف الفاتورة')
      throw e
    } finally {
      indexLoading.value = false
    }
  }

  async function pay(id: number, payload: PaymentPayload): Promise<PurchaseInvoice> {
    showLoading.value = true
    error.value = null
    try {
      const { data } = await apiClient.post(`${API_BASE}/${id}/pay`, payload)
      const updated = unwrapPayload<PurchaseInvoice>(data)
      const idx = items.value.findIndex((p) => p.id === id)
      if (idx !== -1) items.value[idx] = updated
      if (currentInvoice.value?.id === id) currentInvoice.value = updated
      return updated
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل إضافة الدفعة')
      throw e
    } finally {
      showLoading.value = false
    }
  }

  async function fetchPayments(id: number): Promise<FinancialTransaction[]> {
    showLoading.value = true
    error.value = null
    try {
      const { data } = await apiClient.get(`${API_BASE}/${id}/payments`)
      const list = unwrapPayload<FinancialTransaction[]>(data)
      payments.value = Array.isArray(list) ? list : []
      return payments.value
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحميل الدفعات')
      throw e
    } finally {
      showLoading.value = false
    }
  }

  async function updatePayment(
    invoiceId: number,
    transactionId: number,
    payload: PaymentPayload
  ): Promise<PurchaseInvoice> {
    showLoading.value = true
    error.value = null
    try {
      const { data } = await apiClient.put(
        `${API_BASE}/${invoiceId}/payments/${transactionId}`,
        payload
      )
      const updated = unwrapPayload<PurchaseInvoice>(data)
      const idx = items.value.findIndex((p) => p.id === invoiceId)
      if (idx !== -1) items.value[idx] = updated
      if (currentInvoice.value?.id === invoiceId) currentInvoice.value = updated
      return updated
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحديث الدفعة')
      throw e
    } finally {
      showLoading.value = false
    }
  }

  async function deletePayment(
    invoiceId: number,
    transactionId: number
  ): Promise<PurchaseInvoice> {
    showLoading.value = true
    error.value = null
    try {
      const { data } = await apiClient.delete(
        `${API_BASE}/${invoiceId}/payments/${transactionId}`
      )
      const updated = unwrapPayload<PurchaseInvoice>(data)
      const idx = items.value.findIndex((p) => p.id === invoiceId)
      if (idx !== -1) items.value[idx] = updated
      if (currentInvoice.value?.id === invoiceId) currentInvoice.value = updated
      payments.value = payments.value.filter((p) => p.id !== transactionId)
      return updated
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل حذف الدفعة')
      throw e
    } finally {
      showLoading.value = false
    }
  }

  async function receive(invoiceId: number, itemIds?: number[]): Promise<PurchaseInvoice> {
    showLoading.value = true
    error.value = null
    try {
      const { data } = await apiClient.post(`${API_BASE}/${invoiceId}/receive`, {
        item_ids: itemIds ?? [],
      })
      const updated = unwrapPayload<PurchaseInvoice>(data)
      const idx = items.value.findIndex((p) => p.id === invoiceId)
      if (idx !== -1) items.value[idx] = updated
      if (currentInvoice.value?.id === invoiceId) currentInvoice.value = updated
      return updated
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل استلام الأصناف')
      throw e
    } finally {
      showLoading.value = false
    }
  }

  async function unreceive(invoiceId: number, itemIds?: number[]): Promise<PurchaseInvoice> {
    showLoading.value = true
    error.value = null
    try {
      const { data } = await apiClient.post(`${API_BASE}/${invoiceId}/unreceive`, {
        item_ids: itemIds ?? [],
      })
      const updated = unwrapPayload<PurchaseInvoice>(data)
      const idx = items.value.findIndex((p) => p.id === invoiceId)
      if (idx !== -1) items.value[idx] = updated
      if (currentInvoice.value?.id === invoiceId) currentInvoice.value = updated
      return updated
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تراجع الاستلام')
      throw e
    } finally {
      showLoading.value = false
    }
  }

  function clearError() {
    error.value = null
  }

  function clearCurrentInvoice() {
    currentInvoice.value = null
    payments.value = []
  }

  return {
    items,
    currentInvoice,
    payments,
    meta,
    summary,
    indexLoading,
    showLoading,
    error,
    total,
    currentPage,
    lastPage,
    perPage,
    fetchPage,
    fetchById,
    create,
    update,
    remove,
    pay,
    receive,
    unreceive,
    fetchPayments,
    updatePayment,
    deletePayment,
    clearError,
    clearCurrentInvoice,
  }
})
