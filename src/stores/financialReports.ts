import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiClient } from '@/api/axios'
import { unwrapPayload, getErrorMessage } from '@/api/utils'
import type { FixedAssetsSummary } from '@/stores/assets'

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

/** Fixed assets (أصول ثابتة) — summed from assets module. */
export type BalanceSheetFixedAssets = FixedAssetsSummary

/** Inventory at purchase cost: opening + received purchases − dispensed sales (cost). */
export interface BalanceSheetStock {
  opening_value: number
  purchases: number
  sales_cost: number
  total: number
}

/** Customer indebted balances (ذمم مدينة) — amounts owed by customers. */
export interface BalanceSheetIndebtedCustomerRow {
  id: number
  name: string
  balance: number
}

export interface BalanceSheetIndebtedCustomers {
  by_customer: BalanceSheetIndebtedCustomerRow[]
  total: number
}

/** Customer credit liabilities (أرصدة عملاء دائنة). */
export type BalanceSheetCreditCustomerRow = BalanceSheetIndebtedCustomerRow

export interface BalanceSheetCreditCustomers {
  by_customer: BalanceSheetCreditCustomerRow[]
  total: number
}

export interface BalanceSheetSupplierRow {
  id: number
  name: string
  balance: number
}

export interface BalanceSheetSupplierPayables {
  by_supplier: BalanceSheetSupplierRow[]
  total: number
}

export interface BalanceSheetLiabilities {
  suppliers: number
  payroll: number
  customers: number
  partners: number
  total_liabilities: number
}

export interface LedgerAccountOption {
  id: number
  code: string
  name: string
  type: string
}

export interface GeneralLedgerEntryRow {
  id: number
  journal_entry_id: number
  entry_number: string
  date: string
  description: string | null
  line_description: string | null
  debit: number
  credit: number
  balance: number
}

export interface GeneralLedgerAccountRow {
  id: number
  code: string
  name: string
  type: string
  opening_balance: number
  total_debit: number
  total_credit: number
  closing_balance: number
  entries: GeneralLedgerEntryRow[]
}

export interface GeneralLedgerPayload {
  date_from: string
  date_to: string
  accounts: GeneralLedgerAccountRow[]
}

export interface BalanceSheetPayload {
  assets: BalanceSheetAssetRow[]
  /** Sum of financial account balances (نقدية وبنوك). */
  financial_assets_total?: number
  fixed_assets?: BalanceSheetFixedAssets
  stock?: BalanceSheetStock
  /** Sum of indebted customer balances (ذمم العملاء). */
  indebted_customers?: BalanceSheetIndebtedCustomers
  /** Supplier debit assets (ذمم الموردين المدنية). */
  supplier_debit_assets?: BalanceSheetSupplierPayables
  /** Customer credit liabilities (أرصدة عملاء دائنة). */
  credit_customers?: BalanceSheetCreditCustomers
  /** Supplier payables (ذمم الموردين). */
  supplier_payables?: BalanceSheetSupplierPayables
  total_assets: number
  liabilities: BalanceSheetLiabilities
  partners_equity: number
  equity: number
}

function normalizeBalanceSheet(payload: BalanceSheetPayload): BalanceSheetPayload {
  const financialTotal =
    payload.financial_assets_total ?? payload.assets.reduce((s, r) => s + r.balance, 0)
  const fixed: BalanceSheetFixedAssets = payload.fixed_assets ?? {
    by_category: [],
    total: 0,
  }
  const stock: BalanceSheetStock = payload.stock ?? {
    opening_value: 0,
    purchases: 0,
    sales_cost: 0,
    total: 0,
  }
  const indebtedCustomers: BalanceSheetIndebtedCustomers = payload.indebted_customers ?? {
    by_customer: [],
    total: 0,
  }
  const supplierDebitAssets: BalanceSheetSupplierPayables = payload.supplier_debit_assets ?? {
    by_supplier: [],
    total: 0,
  }
  const creditCustomers: BalanceSheetCreditCustomers = payload.credit_customers ?? {
    by_customer: [],
    total: 0,
  }
  const supplierPayables: BalanceSheetSupplierPayables = payload.supplier_payables ?? {
    by_supplier: [],
    total: 0,
  }
  const total_assets =
    payload.total_assets ??
    financialTotal + fixed.total + stock.total + indebtedCustomers.total + supplierDebitAssets.total

  return {
    ...payload,
    financial_assets_total: financialTotal,
    fixed_assets: fixed,
    stock,
    indebted_customers: indebtedCustomers,
    supplier_debit_assets: supplierDebitAssets,
    credit_customers: creditCustomers,
    supplier_payables: supplierPayables,
    total_assets,
  }
}

export const useFinancialReportsStore = defineStore('financialReports', () => {
  const loading = ref(false)
  const error = ref<string | null>(null)

  const incomeStatement = ref<IncomeStatementPayload | null>(null)
  const cashFlow = ref<CashFlowPayload | null>(null)
  const balanceSheet = ref<BalanceSheetPayload | null>(null)
  const generalLedger = ref<GeneralLedgerPayload | null>(null)
  const ledgerAccounts = ref<LedgerAccountOption[]>([])

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

  async function fetchLedgerAccounts() {
    try {
      const { data } = await apiClient.get('/api/reports/ledger-accounts')
      const payload = unwrapPayload<LedgerAccountOption[]>(data)
      ledgerAccounts.value = payload
      return payload
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحميل حسابات الدفتر')
      throw e
    }
  }

  async function getGeneralLedger(params: {
    date_from: string
    date_to: string
    ledger_account_id?: number | null
  }) {
    loading.value = true
    error.value = null
    try {
      const { data } = await apiClient.get('/api/reports/general-ledger', { params })
      const payload = unwrapPayload<GeneralLedgerPayload>(data)
      generalLedger.value = payload
      return payload
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحميل دفتر الأستاذ العام')
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
      const payload = normalizeBalanceSheet(unwrapPayload<BalanceSheetPayload>(data))
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
    generalLedger,
    ledgerAccounts,
    getIncomeStatement,
    getCashFlow,
    getBalanceSheet,
    fetchLedgerAccounts,
    getGeneralLedger,
    clearError,
  }
})
