import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiClient } from '@/api/axios'
import { unwrapPayload, parsePaginatedResponse, getErrorMessage } from '@/api/utils'
import type { Product, ProductStockMovement } from '@/types'
import type { PaginatedPayload } from '@/types'

export const useProductsStore = defineStore('products', () => {
  const items = ref<Product[]>([])
  const allProducts = ref<Product[]>([])
  const meta = ref<PaginatedPayload<Product>['meta'] | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const total = computed(() => meta.value?.total ?? 0)
  const currentPage = computed(() => meta.value?.current_page ?? 1)
  const lastPage = computed(() => meta.value?.last_page ?? 1)
  const perPage = computed(() => meta.value?.per_page ?? 15)

  async function fetchPage(
    page = 1,
    perPageCount = 15,
    search?: string,
    productCategoryId?: number | null,
    lowStock?: boolean
  ) {
    loading.value = true
    error.value = null
    try {
      const params: Record<string, number | string | boolean> = { page, per_page: perPageCount }
      if (search && search.trim()) params.search = search.trim()
      if (productCategoryId != null && productCategoryId > 0) params.product_category_id = productCategoryId
      if (lowStock) params.low_stock = true
      const { data } = await apiClient.get('/api/products', { params })
      const payload = parsePaginatedResponse<Product>(data)
      items.value = payload.data ?? []
      meta.value = payload.meta
      return payload
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحميل المنتجات')
      throw e
    } finally {
      loading.value = false
    }
  }

  /** Fetch all products (for dropdowns in sales/purchases). */
  async function fetchAllForSelect() {
    try {
      const { data } = await apiClient.get('/api/products', {
        params: { per_page: 1000 },
      })
      const payload = parsePaginatedResponse<Product>(data)
      allProducts.value = payload.data ?? []
      return allProducts.value
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحميل المنتجات')
      throw e
    }
  }

  async function create(product: Omit<Product, 'id'>) {
    loading.value = true
    error.value = null
    try {
      const payload: Record<string, unknown> = {
        name: product.name,
        product_category_id: product.product_category_id || undefined,
        unit: product.unit ?? 'قطعة',
        purchase_price: product.purchase_price,
        sale_price: product.sale_price,
        quantity: product.quantity,
        min_quantity: product.min_quantity,
        description: product.description || undefined,
      }
      const p = product as { auto_generate_code?: boolean; product_code?: string }
      if (p.auto_generate_code) payload.auto_generate_code = true
      else if (p.product_code != null) payload.product_code = p.product_code
      const { data } = await apiClient.post('/api/products', payload)
      const created = unwrapPayload<Product>(data)
      items.value = [created, ...items.value]
      return created
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل إضافة المنتج')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function update(id: number, product: Partial<Product>) {
    loading.value = true
    error.value = null
    try {
      const payload: Record<string, unknown> = {
        name: product.name,
        product_category_id: product.product_category_id || undefined,
        unit: product.unit,
        purchase_price: product.purchase_price,
        sale_price: product.sale_price,
        quantity: product.quantity,
        min_quantity: product.min_quantity,
        description: product.description || undefined,
      }
      const p = product as { auto_generate_code?: boolean; product_code?: string }
      if (p.auto_generate_code) payload.auto_generate_code = true
      else if (p.product_code !== undefined) payload.product_code = p.product_code
      const { data } = await apiClient.put(`/api/products/${id}`, payload)
      const updated = unwrapPayload<Product>(data)
      const idx = items.value.findIndex((p) => p.id === id)
      if (idx !== -1) items.value[idx] = updated
      return updated
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحديث المنتج')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function remove(id: number) {
    loading.value = true
    error.value = null
    try {
      await apiClient.delete(`/api/products/${id}`)
      items.value = items.value.filter((p) => p.id !== id)
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل حذف المنتج')
      throw e
    } finally {
      loading.value = false
    }
  }

  const byId = computed(() => (id: number) => items.value.find((p) => p.id === id))

  function clearError() {
    error.value = null
  }

  async function fetchStockMovements(
    productId: number,
    page = 1,
    perPage = 15,
    filters?: { direction?: 'in' | 'out'; source?: string },
  ) {
    const params: Record<string, string | number> = { page, per_page: perPage }
    if (filters?.direction) params.direction = filters.direction
    if (filters?.source) params.source = filters.source
    const { data } = await apiClient.get(`/api/products/${productId}/stock-movements`, { params })
    return parsePaginatedResponse<ProductStockMovement>(data)
  }

  return {
    items,
    allProducts,
    meta,
    loading,
    error,
    total,
    currentPage,
    lastPage,
    perPage,
    fetchPage,
    fetchAllForSelect,
    create,
    update,
    remove,
    byId,
    clearError,
    fetchStockMovements,
  }
})
