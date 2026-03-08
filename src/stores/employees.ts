import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiClient } from '@/api/axios'
import { unwrapPayload, parsePaginatedResponse, getErrorMessage } from '@/api/utils'
import type { Employee } from '@/types'
import type { PaginatedPayload } from '@/types'

export const useEmployeesStore = defineStore('employees', () => {
  const items = ref<Employee[]>([])
  const allEmployees = ref<Employee[]>([])
  const currentEmployee = ref<Employee | null>(null)
  const meta = ref<PaginatedPayload<Employee>['meta'] | null>(null)
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
      const { data } = await apiClient.get('/api/employees', { params })
      const payload = parsePaginatedResponse<Employee>(data)
      items.value = payload.data ?? []
      meta.value = payload.meta
      return payload
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحميل الموظفين')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchById(id: number): Promise<Employee | null> {
    try {
      const { data } = await apiClient.get(`/api/employees/${id}`)
      const payload = unwrapPayload<Employee>(data)
      if (payload?.id) {
        currentEmployee.value = payload
        return payload
      }
      return null
    } catch {
      return null
    }
  }

  async function fetchAllForSelect() {
    try {
      const { data } = await apiClient.get('/api/employees', {
        params: { per_page: 1000 },
      })
      const payload = parsePaginatedResponse<Employee>(data)
      allEmployees.value = payload.data ?? []
      return allEmployees.value
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحميل الموظفين')
      throw e
    }
  }

  async function create(payload: { name: string; position?: string; salary: number }) {
    loading.value = true
    error.value = null
    try {
      const { data } = await apiClient.post('/api/employees', payload)
      const created = unwrapPayload<Employee>(data)
      items.value = [created, ...items.value]
      return created
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل إضافة الموظف')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function update(id: number, payload: Partial<Employee>) {
    loading.value = true
    error.value = null
    try {
      const { data } = await apiClient.put(`/api/employees/${id}`, payload)
      const updated = unwrapPayload<Employee>(data)
      const idx = items.value.findIndex((e) => e.id === id)
      if (idx !== -1) items.value[idx] = updated
      if (currentEmployee.value?.id === id) currentEmployee.value = updated
      return updated
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحديث الموظف')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function remove(id: number) {
    loading.value = true
    error.value = null
    try {
      await apiClient.delete(`/api/employees/${id}`)
      items.value = items.value.filter((e) => e.id !== id)
      if (currentEmployee.value?.id === id) currentEmployee.value = null
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل حذف الموظف')
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
    allEmployees,
    currentEmployee,
    meta,
    loading,
    error,
    total,
    currentPage,
    lastPage,
    perPage,
    fetchPage,
    fetchById,
    fetchAllForSelect,
    create,
    update,
    remove,
    clearError,
  }
})
