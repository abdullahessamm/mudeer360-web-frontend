import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiClient } from '@/api/axios'

export interface DashboardData {
  products_count?: number
  suppliers_count?: number
  sales_invoices_count?: number
  purchase_invoices_count?: number
  current_month: { sales_total: number; purchases_total: number }
  sales_status: { paid: number; partial: number; unpaid: number }
  purchases_status: { paid: number; partial: number; unpaid: number }
  low_stock_products: { id: number; product_code?: string | null; name: string; quantity: number; min_quantity: number; unit: string }[]
  low_stock_total?: number
  monthly_totals: { month: string; sales: number; purchases: number }[]
}

export const useDashboardStore = defineStore('dashboard', () => {
  const searchQuery = ref('')
  const data = ref<DashboardData | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  function setSearchQuery(q: string | undefined) {
    searchQuery.value = q ?? ''
  }

  function clearSearch() {
    searchQuery.value = ''
  }

  async function fetchDashboard() {
    loading.value = true
    error.value = null
    try {
      const { data: res } = await apiClient.get<{ success?: boolean; payload?: DashboardData }>('/api/dashboard')
      const payload = (res && typeof res === 'object' && 'payload' in res ? (res as { payload?: DashboardData }).payload : res) as DashboardData
      data.value = payload ?? null
      return payload
    } catch (e: unknown) {
      error.value = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'فشل تحميل لوحة التحكم'
      throw e
    } finally {
      loading.value = false
    }
  }

  function clearError() {
    error.value = null
  }

  return {
    searchQuery,
    data,
    loading,
    error,
    setSearchQuery,
    clearSearch,
    fetchDashboard,
    clearError,
  }
})
