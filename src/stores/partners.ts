import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiClient } from '@/api/axios'
import { unwrapPayload, getErrorMessage } from '@/api/utils'

export interface Partner {
  id: number
  name: string
  phone: string | null
  notes: string | null
  computed_balance: number
}

export interface PartnerStatementRow {
  id: number
  date: string
  type: 'withdraw' | 'deposit'
  amount: number
  balance_after: number
}

export interface PartnerStatementPayload {
  partner: { id: number; name: string }
  transactions: PartnerStatementRow[]
}

export const usePartnersStore = defineStore('partners', () => {
  const items = ref<Partner[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      const { data } = await apiClient.get('/api/partners')
      const payload = unwrapPayload<Partner[]>(data)
      items.value = Array.isArray(payload) ? payload : []
      return items.value
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحميل الشركاء')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createPartner(body: { name: string; phone?: string | null; notes?: string | null }) {
    loading.value = true
    error.value = null
    try {
      const { data } = await apiClient.post('/api/partners', body)
      const created = unwrapPayload<Partner>(data)
      items.value = [...items.value, created]
      return created
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل إضافة الشريك')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function addTransaction(body: {
    partner_id: number
    financial_account_id: number
    type: 'withdraw' | 'deposit'
    amount: number
    date: string
    notes?: string | null
  }) {
    loading.value = true
    error.value = null
    try {
      await apiClient.post('/api/partners/transaction', body)
      await fetchAll()
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تسجيل الحركة')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function getStatement(partnerId: number) {
    loading.value = true
    error.value = null
    try {
      const { data } = await apiClient.get(`/api/partners/${partnerId}/statement`)
      return unwrapPayload<PartnerStatementPayload>(data)
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحميل كشف الحساب')
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
    createPartner,
    addTransaction,
    getStatement,
    clearError,
  }
})
