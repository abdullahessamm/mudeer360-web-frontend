import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiClient } from '@/api/axios'
import { unwrapPayload, getErrorMessage } from '@/api/utils'

export interface IncomeStatementRow {
  type: string
  total: number
}

export interface IncomeStatementPayload {
  income: IncomeStatementRow[]
  expenses: IncomeStatementRow[]
  total_income: number
  total_expense: number
  net_profit: number
}

export interface CashFlowAccountRow {
  id: number
  name: string
  opening_balance: number
  inflow: number
  outflow: number
  closing_balance: number
}

export interface CashFlowPayload {
  opening_balance: number
  inflow: number
  outflow: number
  closing_balance: number
  accounts: CashFlowAccountRow[]
}

export interface BalanceSheetAssetRow {
  id: number
  name: string
  type: string | null
  balance: number
}

export interface BalanceSheetLiabilities {
  suppliers: number
  payroll: number
  customers: number
  partners: number
  total_liabilities: number
}

export interface BalanceSheetPayload {
  assets: BalanceSheetAssetRow[]
  total_assets: number
  liabilities: BalanceSheetLiabilities
  partners_equity: number
  equity: number
}

export const useFinancialReportsStore = defineStore('financialReports', () => {
  const loading = ref(false)
  const error = ref<string | null>(null)

  const incomeStatement = ref<IncomeStatementPayload | null>(null)
  const cashFlow = ref<CashFlowPayload | null>(null)
  const balanceSheet = ref<BalanceSheetPayload | null>(null)

  async function getIncomeStatement(params: { date_from: string; date_to: string }) {
    loading.value = true
    error.value = null
    try {
      const { data } = await apiClient.get('/api/reports/income-statement', { params })
      const payload = unwrapPayload<IncomeStatementPayload>(data)
      incomeStatement.value = payload
      return payload
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحميل قائمة الدخل')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function getCashFlow(params: {
    date_from: string
    date_to: string
    financial_account_id?: number | null
  }) {
    loading.value = true
    error.value = null
    try {
      const { data } = await apiClient.get('/api/reports/cash-flow', { params })
      const payload = unwrapPayload<CashFlowPayload>(data)
      cashFlow.value = payload
      return payload
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحميل تقرير التدفقات النقدية')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function getBalanceSheet() {
    loading.value = true
    error.value = null
    try {
      const { data } = await apiClient.get('/api/reports/balance-sheet')
      const payload = unwrapPayload<BalanceSheetPayload>(data)
      balanceSheet.value = payload
      return payload
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحميل المركز المالي')
      throw e
    } finally {
      loading.value = false
    }
  }

  function clearError() {
    error.value = null
  }

  return {
    loading,
    error,
    incomeStatement,
    cashFlow,
    balanceSheet,
    getIncomeStatement,
    getCashFlow,
    getBalanceSheet,
    clearError,
  }
})
