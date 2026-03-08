import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiClient } from '@/api/axios'
import { unwrapPayload, getErrorMessage } from '@/api/utils'
import type { FinancialAccount } from '@/types'

export const useFinancialAccountsStore = defineStore('financialAccounts', () => {
  const items = ref<FinancialAccount[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      const { data } = await apiClient.get('/api/financial-accounts')
      const payload = unwrapPayload<{ data?: FinancialAccount[] } | FinancialAccount[]>(data)
      const list = Array.isArray(payload)
        ? payload
        : payload && typeof payload === 'object' && Array.isArray((payload as { data?: FinancialAccount[] }).data)
          ? (payload as { data: FinancialAccount[] }).data
          : []
      items.value = list
      return items.value
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحميل الحسابات المالية')
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
    loading,
    error,
    fetchAll,
    clearError,
  }
})
