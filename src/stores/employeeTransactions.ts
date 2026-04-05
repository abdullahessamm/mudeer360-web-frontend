import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiClient } from '@/api/axios'
import { unwrapPayload, parsePaginatedResponse, getErrorMessage } from '@/api/utils'
import type { EmployeeTransaction } from '@/types'
import type { PaginatedPayload } from '@/types'

export interface EmployeeTransactionFilters {
  employee_id?: number
  type?: 'bonus' | 'deduction' | 'loan'
  date_from?: string
  date_to?: string
}

export const useEmployeeTransactionsStore = defineStore('employeeTransactions', () => {
  const items = ref<EmployeeTransaction[]>([])
  const meta = ref<PaginatedPayload<EmployeeTransaction>['meta'] | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const total = computed(() => meta.value?.total ?? 0)
  const currentPage = computed(() => meta.value?.current_page ?? 1)
  const lastPage = computed(() => meta.value?.last_page ?? 1)
  const perPage = computed(() => meta.value?.per_page ?? 15)

  async function fetchPage(
    page = 1,
    perPageCount = 15,
    filters?: EmployeeTransactionFilters,
  ) {
    loading.value = true
    error.value = null
    try {
      const params: Record<string, number | string> = { page, per_page: perPageCount }
      if (filters?.employee_id) params.employee_id = filters.employee_id
      if (filters?.type) params.type = filters.type
      if (filters?.date_from) params.date_from = filters.date_from
      if (filters?.date_to) params.date_to = filters.date_to
      const { data } = await apiClient.get('/api/employee-transactions', { params })
      const payload = parsePaginatedResponse<EmployeeTransaction>(data)
      items.value = payload.data ?? []
      meta.value = payload.meta
      return payload
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحميل المعاملات')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchById(id: number): Promise<EmployeeTransaction | null> {
    try {
      const { data } = await apiClient.get(`/api/employee-transactions/${id}`)
      return unwrapPayload<EmployeeTransaction>(data)
    } catch {
      return null
    }
  }

  async function create(payload: {
    employee_id: number
    type: 'bonus' | 'deduction' | 'loan'
    amount: number
    date: string
    description?: string
    financial_account_id?: number
  }) {
    loading.value = true
    error.value = null
    try {
      const body: Record<string, unknown> = {
        employee_id: payload.employee_id,
        type: payload.type,
        amount: payload.amount,
        date: payload.date,
        description: payload.description || undefined,
      }
      if (payload.type === 'loan' && payload.financial_account_id) {
        body.financial_account_id = payload.financial_account_id
      }
      const { data } = await apiClient.post('/api/employee-transactions', body)
      return unwrapPayload<EmployeeTransaction>(data)
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل إضافة المعاملة')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function update(
    id: number,
    payload: Partial<{
      employee_id: number
      type: 'bonus' | 'deduction' | 'loan'
      amount: number
      date: string
      description: string
      financial_account_id: number
    }>,
  ) {
    loading.value = true
    error.value = null
    try {
      const { data } = await apiClient.put(`/api/employee-transactions/${id}`, payload)
      const updated = unwrapPayload<EmployeeTransaction>(data)
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
      await apiClient.delete(`/api/employee-transactions/${id}`)
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
    loading,
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
    clearError,
  }
})
