import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiClient } from '@/api/axios'
import { unwrapPayload, parsePaginatedResponse, getErrorMessage } from '@/api/utils'
import type {
  SaleInvoice,
  SaleInvoiceCreatePayload,
  PaymentPayload,
  PaginatedPayload,
  InvoicePaymentLine,
} from '@/types'

const API_BASE = '/api/sale-invoices'

export const useSalesStore = defineStore('sales', () => {
  const items = ref<SaleInvoice[]>([])
  const currentInvoice = ref<SaleInvoice | null>(null)
  const payments = ref<InvoicePaymentLine[]>([])
  const meta = ref<PaginatedPayload<SaleInvoice>['meta'] | null>(null)
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
    total_dispensed_amount: number
    total_remaining_dispense: number
    total_dues: number
  }>({
    total_amount: 0,
    paid_amount: 0,
    remaining_amount: 0,
    total_dispensed_amount: 0,
    total_remaining_dispense: 0,
    total_dues: 0,
  })

  async function fetchPage(
    page = 1,
    perPageCount = 15,
    filters?: {
      customer_id?: number | null
      status?: 'unpaid' | 'partial' | 'paid' | null
      type?: 'cash' | 'credit' | null
      date_from?: string
      date_to?: string
    },
  ) {
    indexLoading.value = true
    error.value = null
    try {
      const params: Record<string, number | string> = { page, per_page: perPageCount }
      if (filters?.customer_id) params.customer_id = filters.customer_id
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
      const payload = parsePaginatedResponse<SaleInvoice>(rawPayload)
      items.value = payload.data ?? []
      meta.value = payload.meta
      if (rawPayload && typeof rawPayload === 'object' && 'summary' in rawPayload) {
        const s = (rawPayload as { summary: Record<string, number> }).summary
        summary.value = {
          total_amount: s?.total_amount ?? 0,
          paid_amount: s?.paid_amount ?? 0,
          remaining_amount: s?.remaining_amount ?? 0,
          total_dispensed_amount: s?.total_dispensed_amount ?? 0,
          total_remaining_dispense: s?.total_remaining_dispense ?? 0,
          total_dues: s?.total_dues ?? 0,
        }
      }
      return payload
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحميل فواتير البيع')
      throw e
    } finally {
      indexLoading.value = false
    }
  }

  async function fetchById(id: number): Promise<SaleInvoice | null> {
    showLoading.value = true
    error.value = null
    try {
      const { data } = await apiClient.get(`${API_BASE}/${id}`)
      const invoice = unwrapPayload<SaleInvoice>(data)
      currentInvoice.value = invoice
      return invoice
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحميل الفاتورة')
      throw e
    } finally {
      showLoading.value = false
    }
  }

  async function create(payload: SaleInvoiceCreatePayload): Promise<SaleInvoice> {
    indexLoading.value = true
    error.value = null
    try {
      const { data } = await apiClient.post(API_BASE, payload)
      const created = unwrapPayload<SaleInvoice>(data)
      items.value = [created, ...items.value]
      return created
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل إنشاء الفاتورة')
      throw e
    } finally {
      indexLoading.value = false
    }
  }

  async function update(id: number, payload: SaleInvoiceCreatePayload): Promise<SaleInvoice> {
    indexLoading.value = true
    error.value = null
    try {
      const { data } = await apiClient.put(`${API_BASE}/${id}`, payload)
      const updated = unwrapPayload<SaleInvoice>(data)
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

  async function pay(id: number, payload: PaymentPayload): Promise<SaleInvoice> {
    showLoading.value = true
    error.value = null
    try {
      const body: Record<string, unknown> = {
        amount: payload.amount,
        date: payload.date,
        balance_amount: payload.balance_amount ?? 0,
        description: payload.description,
      }
      if (payload.financial_account_id != null) {
        body.financial_account_id = payload.financial_account_id
      }
      const { data } = await apiClient.post(`${API_BASE}/${id}/pay`, body)
      const updated = unwrapPayload<SaleInvoice>(data)
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

  async function fetchPayments(id: number): Promise<InvoicePaymentLine[]> {
    showLoading.value = true
    error.value = null
    try {
      const { data } = await apiClient.get(`${API_BASE}/${id}/payments`)
      const list = unwrapPayload<unknown[]>(data)
      const raw = Array.isArray(list) ? list : []
      payments.value = raw.map((row) => {
        if (row && typeof row === 'object' && 'payment_type' in row) {
          return row as InvoicePaymentLine
        }
        return { ...(row as object), payment_type: 'cash' } as InvoicePaymentLine
      })
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
    payload: PaymentPayload,
  ): Promise<SaleInvoice> {
    showLoading.value = true
    error.value = null
    try {
      const { data } = await apiClient.put(
        `${API_BASE}/${invoiceId}/payments/${transactionId}`,
        payload,
      )
      const updated = unwrapPayload<SaleInvoice>(data)
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

  async function dispense(invoiceId: number, itemIds?: number[]): Promise<SaleInvoice> {
    showLoading.value = true
    error.value = null
    try {
      const { data } = await apiClient.post(`${API_BASE}/${invoiceId}/dispense`, {
        item_ids: itemIds ?? [],
      })
      const updated = unwrapPayload<SaleInvoice>(data)
      const idx = items.value.findIndex((p) => p.id === invoiceId)
      if (idx !== -1) items.value[idx] = updated
      if (currentInvoice.value?.id === invoiceId) currentInvoice.value = updated
      return updated
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل صرف الأصناف')
      throw e
    } finally {
      showLoading.value = false
    }
  }

  async function undispense(invoiceId: number, itemIds?: number[]): Promise<SaleInvoice> {
    showLoading.value = true
    error.value = null
    try {
      const { data } = await apiClient.post(`${API_BASE}/${invoiceId}/undispense`, {
        item_ids: itemIds ?? [],
      })
      const updated = unwrapPayload<SaleInvoice>(data)
      const idx = items.value.findIndex((p) => p.id === invoiceId)
      if (idx !== -1) items.value[idx] = updated
      if (currentInvoice.value?.id === invoiceId) currentInvoice.value = updated
      return updated
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تراجع الصرف')
      throw e
    } finally {
      showLoading.value = false
    }
  }

  async function deletePayment(invoiceId: number, transactionId: number): Promise<SaleInvoice> {
    showLoading.value = true
    error.value = null
    try {
      const { data } = await apiClient.delete(`${API_BASE}/${invoiceId}/payments/${transactionId}`)
      const updated = unwrapPayload<SaleInvoice>(data)
      const idx = items.value.findIndex((p) => p.id === invoiceId)
      if (idx !== -1) items.value[idx] = updated
      if (currentInvoice.value?.id === invoiceId) currentInvoice.value = updated
      payments.value = payments.value.filter(
        (p) => !(p.payment_type === 'cash' && p.id === transactionId),
      )
      return updated
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل حذف الدفعة')
      throw e
    } finally {
      showLoading.value = false
    }
  }

  async function deleteBalancePayment(
    invoiceId: number,
    balancePaymentId: number,
  ): Promise<SaleInvoice> {
    showLoading.value = true
    error.value = null
    try {
      const { data } = await apiClient.delete(
        `${API_BASE}/${invoiceId}/balance-payments/${balancePaymentId}`,
      )
      const updated = unwrapPayload<SaleInvoice>(data)
      const idx = items.value.findIndex((p) => p.id === invoiceId)
      if (idx !== -1) items.value[idx] = updated
      if (currentInvoice.value?.id === invoiceId) currentInvoice.value = updated
      payments.value = payments.value.filter(
        (p) => !(p.payment_type === 'balance' && p.id === balancePaymentId),
      )
      return updated
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل حذف الدفعة')
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
    dispense,
    undispense,
    fetchPayments,
    updatePayment,
    deletePayment,
    deleteBalancePayment,
    clearError,
    clearCurrentInvoice,
  }
})
