import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiClient } from '@/api/axios'
import { unwrapPayload, parsePaginatedResponse, getErrorMessage } from '@/api/utils'
import type { Payroll } from '@/types'
import type { PaginatedPayload } from '@/types'

export interface PayrollFilters {
  employee_id?: number
  month?: number
  year?: number
  status?: 'pending' | 'paid'
}

export const usePayrollsStore = defineStore('payrolls', () => {
  const items = ref<Payroll[]>([])
  const currentPayroll = ref<Payroll | null>(null)
  const meta = ref<PaginatedPayload<Payroll>['meta'] | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const total = computed(() => meta.value?.total ?? 0)
  const currentPage = computed(() => meta.value?.current_page ?? 1)
  const lastPage = computed(() => meta.value?.last_page ?? 1)
  const perPage = computed(() => meta.value?.per_page ?? 15)

  async function fetchPage(
    page = 1,
    perPageCount = 15,
    filters?: PayrollFilters,
  ) {
    loading.value = true
    error.value = null
    try {
      const params: Record<string, number | string> = { page, per_page: perPageCount }
      if (filters?.employee_id) params.employee_id = filters.employee_id
      if (filters?.month) params.month = filters.month
      if (filters?.year) params.year = filters.year
      if (filters?.status) params.status = filters.status
      const { data } = await apiClient.get('/api/payrolls', { params })
      const payload = parsePaginatedResponse<Payroll>(data)
      items.value = payload.data ?? []
      meta.value = payload.meta
      return payload
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحميل كشوف الرواتب')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchById(id: number): Promise<Payroll | null> {
    try {
      const { data } = await apiClient.get(`/api/payrolls/${id}`)
      const payload = unwrapPayload<Payroll>(data)
      if (payload?.id) {
        currentPayroll.value = payload
        return payload
      }
      return null
    } catch {
      return null
    }
  }

  async function create(payload: { employee_id: number; month: number; year: number }) {
    loading.value = true
    error.value = null
    try {
      const { data } = await apiClient.post('/api/payrolls', payload)
      return unwrapPayload<Payroll>(data)
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل إنشاء كشف الراتب')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function pay(
    id: number,
    payload: { financial_account_id: number; date: string },
  ) {
    loading.value = true
    error.value = null
    try {
      const { data } = await apiClient.post(`/api/payrolls/${id}/pay`, payload)
      const updated = unwrapPayload<Payroll>(data)
      const idx = items.value.findIndex((p) => p.id === id)
      if (idx !== -1) items.value[idx] = updated
      if (currentPayroll.value?.id === id) currentPayroll.value = updated
      return updated
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل صرف الراتب')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function remove(id: number) {
    loading.value = true
    error.value = null
    try {
      await apiClient.delete(`/api/payrolls/${id}`)
      items.value = items.value.filter((p) => p.id !== id)
      if (currentPayroll.value?.id === id) currentPayroll.value = null
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل حذف كشف الراتب')
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
    currentPayroll,
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
    pay,
    remove,
    clearError,
  }
})
