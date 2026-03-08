import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiClient } from '@/api/axios'
import { unwrapPayload, parsePaginatedResponse, getErrorMessage } from '@/api/utils'
import type { FinancialTransaction } from '@/types'
import type { PaginatedPayload } from '@/types'

export interface FinancialTransactionsPayload extends PaginatedPayload<FinancialTransaction> {
  account_balance?: number
}

export const useFinancialTransactionsStore = defineStore('financialTransactions', () => {
  const items = ref<FinancialTransaction[]>([])
  const meta = ref<PaginatedPayload<FinancialTransaction>['meta'] | null>(null)
  const accountBalance = ref<number>(0)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const total = computed(() => meta.value?.total ?? 0)
  const currentPage = computed(() => meta.value?.current_page ?? 1)
  const lastPage = computed(() => meta.value?.last_page ?? 1)
  const perPage = computed(() => meta.value?.per_page ?? 15)

  async function fetchPage(
    page = 1,
    perPageCount = 15,
    filters?: {
      financial_account_id?: number | null
      type?: 'income' | 'expense' | null
      date_from?: string
      date_to?: string
    }
  ) {
    loading.value = true
    error.value = null
    try {
      const params: Record<string, number | string> = { page, per_page: perPageCount }
      if (filters?.financial_account_id) params.financial_account_id = filters.financial_account_id
      if (filters?.type) params.type = filters.type
      if (filters?.date_from) params.date_from = filters.date_from
      if (filters?.date_to) params.date_to = filters.date_to

      const { data } = await apiClient.get('/api/financial-transactions', { params })
      const res = data as { success?: boolean; payload?: FinancialTransactionsPayload }
      const p = res?.payload ?? (data as FinancialTransactionsPayload)
      if (p && typeof p === 'object' && 'account_balance' in p) {
        accountBalance.value = (p as FinancialTransactionsPayload).account_balance ?? 0
      }
      const payload = parsePaginatedResponse<FinancialTransaction>(data)
      items.value = payload.data ?? []
      meta.value = payload.meta
      return payload
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحميل المعاملات المالية')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function create(transaction: {
    financial_account_id: number
    type: 'income' | 'expense'
    amount: number
    date: string
    description?: string
  }) {
    loading.value = true
    error.value = null
    try {
      const { data } = await apiClient.post('/api/financial-transactions', { ...transaction })
      const created = unwrapPayload<FinancialTransaction>(data)
      items.value = [created, ...items.value]
      return created
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل إضافة المعاملة')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function update(id: number, transaction: Partial<FinancialTransaction>) {
    loading.value = true
    error.value = null
    try {
      const body: Record<string, unknown> = {}
      if (transaction.type !== undefined) body.type = transaction.type
      if (transaction.amount !== undefined) body.amount = transaction.amount
      if (transaction.date !== undefined) body.date = transaction.date
      if (transaction.description !== undefined) body.description = transaction.description
      const { data } = await apiClient.put(`/api/financial-transactions/${id}`, body)
      const updated = unwrapPayload<FinancialTransaction>(data)
      const idx = items.value.findIndex((t) => t.id === id)
      if (idx !== -1) items.value[idx] = updated
      return updated
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحديث المعاملة')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function remove(id: number) {
    loading.value = true
    error.value = null
    try {
      await apiClient.delete(`/api/financial-transactions/${id}`)
      items.value = items.value.filter((t) => t.id !== id)
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل حذف المعاملة')
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
    meta,
    accountBalance,
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
    clearError,
  }
})
