import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiClient } from '@/api/axios'
import { unwrapPayload, parsePaginatedResponse, getErrorMessage } from '@/api/utils'
import type { Customer, CustomerWithInvoices } from '@/types'
import type { PaginatedPayload } from '@/types'

export const useCustomersStore = defineStore('customers', () => {
  const items = ref<Customer[]>([])
  const allCustomers = ref<Customer[]>([])
  const meta = ref<PaginatedPayload<Customer>['meta'] | null>(null)
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
      const { data } = await apiClient.get('/api/customers', { params })
      const payload = parsePaginatedResponse<Customer>(data)
      items.value = payload.data ?? []
      meta.value = payload.meta
      return payload
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحميل العملاء')
      throw e
    } finally {
      loading.value = false
    }
  }

  /** Fetch single customer with sale invoices (GET /api/customers/{id}) */
  async function fetchById(id: number): Promise<CustomerWithInvoices | null> {
    try {
      const { data } = await apiClient.get(`/api/customers/${id}`)
      let payload = data as CustomerWithInvoices | { payload?: CustomerWithInvoices; data?: CustomerWithInvoices }
      if (payload && typeof payload === 'object' && 'payload' in payload && payload.payload) {
        payload = payload.payload
      } else if (payload && typeof payload === 'object' && 'data' in payload && payload.data) {
        payload = payload.data
      }
      const p = payload as CustomerWithInvoices
      if (p && p.id) {
        return {
          ...p,
          invoices: p.invoices ?? [],
        }
      }
      return null
    } catch {
      return null
    }
  }

  /** Fetch all customers (for dropdowns). Uses high per_page to get all in one request. */
  async function fetchAllForSelect() {
    try {
      const { data } = await apiClient.get('/api/customers', {
        params: { per_page: 1000 },
      })
      const payload = parsePaginatedResponse<Customer>(data)
      allCustomers.value = payload.data ?? []
      return allCustomers.value
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحميل العملاء')
      throw e
    }
  }

  /** Find customer by name or create new one. Returns the customer. */
  async function findOrCreate(name: string): Promise<Customer> {
    const trimmed = name?.trim()
    if (!trimmed) throw new Error('اسم العميل مطلوب')
    const { data } = await apiClient.post('/api/customers/find-or-create', { name: trimmed })
    const customer = unwrapPayload<Customer>(data)
    const exists = allCustomers.value.some((c) => c.id === customer.id)
    if (!exists) allCustomers.value = [customer, ...allCustomers.value]
    return customer
  }

  async function create(customer: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) {
    loading.value = true
    error.value = null
    try {
      const { data } = await apiClient.post('/api/customers', {
        name: customer.name,
        phone: customer.phone || undefined,
        email: customer.email || undefined,
        address: customer.address || undefined,
        notes: customer.notes || undefined,
      })
      const created = unwrapPayload<Customer>(data)
      items.value = [created, ...items.value]
      return created
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل إضافة العميل')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function update(id: number, customer: Partial<Customer>) {
    loading.value = true
    error.value = null
    try {
      const { data } = await apiClient.put(`/api/customers/${id}`, {
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        notes: customer.notes,
      })
      const updated = unwrapPayload<Customer>(data)
      const idx = items.value.findIndex((c) => c.id === id)
      if (idx !== -1) items.value[idx] = updated
      return updated
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحديث العميل')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function remove(id: number) {
    loading.value = true
    error.value = null
    try {
      await apiClient.delete(`/api/customers/${id}`)
      items.value = items.value.filter((c) => c.id !== id)
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل حذف العميل')
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
    allCustomers,
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
    findOrCreate,
    create,
    update,
    remove,
    clearError,
  }
})
