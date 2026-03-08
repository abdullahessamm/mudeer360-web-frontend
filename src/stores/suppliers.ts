import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiClient } from '@/api/axios'
import { unwrapPayload, parsePaginatedResponse, getErrorMessage } from '@/api/utils'
import type { Supplier, SupplierWithInvoices } from '@/types'
import type { PaginatedPayload } from '@/types'

export const useSuppliersStore = defineStore('suppliers', () => {
  const items = ref<Supplier[]>([])
  const allSuppliers = ref<Supplier[]>([])
  const meta = ref<PaginatedPayload<Supplier>['meta'] | null>(null)
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
      const { data } = await apiClient.get('/api/suppliers', { params })
      const payload = parsePaginatedResponse<Supplier>(data)
      items.value = payload.data ?? []
      meta.value = payload.meta
      return payload
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحميل الموردين')
      throw e
    } finally {
      loading.value = false
    }
  }

  /** Fetch single supplier with purchase invoices (GET /api/suppliers/{id}) */
  async function fetchById(id: number): Promise<SupplierWithInvoices | null> {
    try {
      const { data } = await apiClient.get(`/api/suppliers/${id}`)
      let payload = data as SupplierWithInvoices | { payload?: SupplierWithInvoices; data?: SupplierWithInvoices }
      if (payload && typeof payload === 'object' && 'payload' in payload && payload.payload) {
        payload = payload.payload
      } else if (payload && typeof payload === 'object' && 'data' in payload && payload.data) {
        payload = payload.data
      }
      const p = payload as SupplierWithInvoices
      if (p && p.id) {
        return {
          ...p,
          purchase_invoices: p.purchase_invoices ?? [],
        }
      }
      return null
    } catch {
      return null
    }
  }

  /** Fetch all suppliers (for dropdowns). Uses high per_page to get all in one request. */
  async function fetchAllForSelect() {
    try {
      const { data } = await apiClient.get('/api/suppliers', {
        params: { per_page: 1000 },
      })
      const payload = parsePaginatedResponse<Supplier>(data)
      allSuppliers.value = payload.data ?? []
      return allSuppliers.value
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحميل الموردين')
      throw e
    }
  }

  async function create(supplier: Omit<Supplier, 'id' | 'created_at' | 'updated_at'>) {
    loading.value = true
    error.value = null
    try {
      const { data } = await apiClient.post('/api/suppliers', {
        name: supplier.name,
        phone: supplier.phone || undefined,
        email: supplier.email || undefined,
        address: supplier.address || undefined,
        notes: supplier.notes || undefined,
      })
      const created = unwrapPayload<Supplier>(data)
      items.value = [created, ...items.value]
      return created
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل إضافة المورد')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function update(id: number, supplier: Partial<Supplier>) {
    loading.value = true
    error.value = null
    try {
      const { data } = await apiClient.put(`/api/suppliers/${id}`, {
        name: supplier.name,
        phone: supplier.phone,
        email: supplier.email,
        address: supplier.address,
        notes: supplier.notes,
      })
      const updated = unwrapPayload<Supplier>(data)
      const idx = items.value.findIndex((s) => s.id === id)
      if (idx !== -1) items.value[idx] = updated
      return updated
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحديث المورد')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function remove(id: number) {
    loading.value = true
    error.value = null
    try {
      await apiClient.delete(`/api/suppliers/${id}`)
      items.value = items.value.filter((s) => s.id !== id)
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل حذف المورد')
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
    allSuppliers,
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
