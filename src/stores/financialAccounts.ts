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

  async function create(body: { name: string; type?: string | null }) {
    loading.value = true
    error.value = null
    try {
      const { data } = await apiClient.post('/api/financial-accounts', {
        name: body.name.trim(),
        ...(body.type != null && body.type !== '' ? { type: body.type } : {}),
      })
      const created = unwrapPayload<FinancialAccount>(data)
      items.value = [...items.value, created]
      return created
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل إضافة الحساب')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function update(id: number, body: { name?: string; type?: string | null }) {
    loading.value = true
    error.value = null
    try {
      const payload: Record<string, unknown> = {}
      if (body.name !== undefined) payload.name = body.name.trim()
      if (body.type !== undefined) payload.type = body.type || null
      const { data } = await apiClient.put(`/api/financial-accounts/${id}`, payload)
      const updated = unwrapPayload<FinancialAccount>(data)
      const idx = items.value.findIndex((a) => a.id === id)
      if (idx !== -1) items.value[idx] = updated
      return updated
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحديث الحساب')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function remove(id: number) {
    loading.value = true
    error.value = null
    try {
      await apiClient.delete(`/api/financial-accounts/${id}`)
      items.value = items.value.filter((a) => a.id !== id)
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل حذف الحساب')
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
    create,
    update,
    remove,
    clearError,
  }
})
