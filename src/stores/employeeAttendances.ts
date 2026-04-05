import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiClient } from '@/api/axios'
import { unwrapPayload, parsePaginatedResponse, getErrorMessage } from '@/api/utils'
import type { EmployeeAttendance } from '@/types'
import type { PaginatedPayload } from '@/types'

export interface EmployeeAttendanceFilters {
  employee_id?: number | null
  date_from?: string
  date_to?: string
}

export const useEmployeeAttendancesStore = defineStore('employeeAttendances', () => {
  const items = ref<EmployeeAttendance[]>([])
  const meta = ref<PaginatedPayload<EmployeeAttendance>['meta'] | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const total = computed(() => meta.value?.total ?? 0)
  const currentPage = computed(() => meta.value?.current_page ?? 1)
  const lastPage = computed(() => meta.value?.last_page ?? 1)
  const perPage = computed(() => meta.value?.per_page ?? 15)

  async function fetchPage(
    page = 1,
    perPageCount = 15,
    filters?: EmployeeAttendanceFilters,
  ) {
    loading.value = true
    error.value = null
    try {
      const params: Record<string, number | string> = { page, per_page: perPageCount }
      if (filters?.employee_id) params.employee_id = filters.employee_id
      if (filters?.date_from) params.date_from = filters.date_from
      if (filters?.date_to) params.date_to = filters.date_to
      const { data } = await apiClient.get('/api/employee-attendances', { params })
      const payload = parsePaginatedResponse<EmployeeAttendance>(data)
      items.value = payload.data ?? []
      meta.value = payload.meta
      return payload
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحميل سجل الحضور')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function create(payload: {
    employee_id: number
    work_date: string
    check_in?: string | null
    check_out?: string | null
    notes?: string | null
  }) {
    loading.value = true
    error.value = null
    try {
      const { data } = await apiClient.post('/api/employee-attendances', payload)
      return unwrapPayload<EmployeeAttendance>(data)
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تسجيل الحضور')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function update(
    id: number,
    payload: Partial<{
      employee_id: number
      work_date: string
      check_in: string | null
      check_out: string | null
      notes: string | null
    }>,
  ) {
    loading.value = true
    error.value = null
    try {
      const { data } = await apiClient.put(`/api/employee-attendances/${id}`, payload)
      const updated = unwrapPayload<EmployeeAttendance>(data)
      const idx = items.value.findIndex((r) => r.id === id)
      if (idx !== -1) items.value[idx] = updated
      return updated
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحديث السجل')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function remove(id: number) {
    loading.value = true
    error.value = null
    try {
      await apiClient.delete(`/api/employee-attendances/${id}`)
      items.value = items.value.filter((r) => r.id !== id)
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل حذف السجل')
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
    create,
    update,
    remove,
    clearError,
  }
})
