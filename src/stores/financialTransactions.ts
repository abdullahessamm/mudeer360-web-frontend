import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import { apiClient } from '@/api/axios'
import { unwrapPayload, parsePaginatedResponse, getErrorMessage } from '@/api/utils'
import { formatDateLocal, getCurrentMonthRange } from '@/lib/date'
import { useFinancialAccountsStore } from '@/stores/financialAccounts'
import type { FinancialTransaction } from '@/types'
import type { PaginatedPayload } from '@/types'

export interface FinancialTransactionsPayload extends PaginatedPayload<FinancialTransaction> {
  account_balance?: number
}

/** صفحة سجل كامل، أو إيرادات، أو مصروفات — حالة منفصلة لكل واحد */
export type FinancialPageScope = 'all' | 'income' | 'expense'

export interface FinancialFiltersState {
  financial_account_id: number | null
  /** يُستخدم في نطاق `all` فقط؛ الإيرادات/المصروفات يُحدَّد النوع من النطاق */
  type: 'income' | 'expense' | null
  dateRange: [Date, Date] | null
}

export interface FinancialScopeSlice {
  items: FinancialTransaction[]
  meta: PaginatedPayload<FinancialTransaction>['meta'] | null
  accountBalance: number
  loading: boolean
  filters: FinancialFiltersState
}

function defaultFilters(_scope: FinancialPageScope): FinancialFiltersState {
  return {
    financial_account_id: null,
    type: null,
    dateRange: getCurrentMonthRange() as [Date, Date],
  }
}

function createSlice(scope: FinancialPageScope): FinancialScopeSlice {
  return {
    items: [],
    meta: null,
    accountBalance: 0,
    loading: false,
    filters: defaultFilters(scope),
  }
}

function apiTypeForScope(scope: FinancialPageScope, filters: FinancialFiltersState) {
  if (scope === 'income') return 'income' as const
  if (scope === 'expense') return 'expense' as const
  return filters.type ?? undefined
}

function buildParamsFromSlice(scope: FinancialPageScope, s: FinancialScopeSlice) {
  const [date_from, date_to] = s.filters.dateRange
    ? [s.filters.dateRange[0], s.filters.dateRange[1]]
    : [undefined, undefined]
  return {
    financial_account_id: s.filters.financial_account_id || undefined,
    type: apiTypeForScope(scope, s.filters),
    date_from: date_from ? formatDateLocal(date_from) : undefined,
    date_to: date_to ? formatDateLocal(date_to) : undefined,
  }
}

/** يقرأ account_balance من أشكال الاستجابة المختلفة؛ undefined = غير موجود في JSON */
function pickAccountBalanceFromResponse(raw: unknown): number | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const read = (v: unknown): number | undefined => {
    if (v === null || v === undefined) return 0
    const n = Number(v)
    return Number.isNaN(n) ? undefined : n
  }
  if ('account_balance' in o) {
    const b = read(o.account_balance)
    if (b !== undefined) return b
  }
  const payload = o.payload
  if (payload && typeof payload === 'object' && 'account_balance' in (payload as object)) {
    const b = read((payload as Record<string, unknown>).account_balance)
    if (b !== undefined) return b
  }
  return undefined
}

function resolveDisplayAccountBalance(
  apiBalance: number | undefined,
  financialAccountId: number | null,
): number {
  if (apiBalance !== undefined) return apiBalance
  if (financialAccountId == null) return 0
  const accounts = useFinancialAccountsStore()
  const acc = accounts.items.find((a) => a.id === financialAccountId)
  return Number(acc?.computed_balance ?? 0)
}

export const useFinancialTransactionsStore = defineStore('financialTransactions', () => {
  const stateByScope = reactive({
    all: createSlice('all'),
    income: createSlice('income'),
    expense: createSlice('expense'),
  })

  const overviewByScope = reactive({
    income: {
      items: [] as FinancialTransaction[],
      totalCount: 0,
      loading: false,
    },
    expense: {
      items: [] as FinancialTransaction[],
      totalCount: 0,
      loading: false,
    },
  })

  const error = ref<string | null>(null)

  async function fetchPage(
    scope: FinancialPageScope,
    page = 1,
    perPageCount?: number,
    mergeFilters?: Partial<FinancialFiltersState>,
  ) {
    const s = stateByScope[scope]
    if (mergeFilters) {
      Object.assign(s.filters, mergeFilters)
    }
    const per = perPageCount ?? s.meta?.per_page ?? 15
    s.loading = true
    error.value = null
    try {
      const p = buildParamsFromSlice(scope, s)
      const params: Record<string, number | string> = { page, per_page: per }
      if (p.financial_account_id) params.financial_account_id = p.financial_account_id
      if (p.type) params.type = p.type
      if (p.date_from) params.date_from = p.date_from
      if (p.date_to) params.date_to = p.date_to

      const { data } = await apiClient.get('/api/financial-transactions', { params })
      const fromApi = pickAccountBalanceFromResponse(data)
      s.accountBalance = resolveDisplayAccountBalance(fromApi, s.filters.financial_account_id)
      const payload = parsePaginatedResponse<FinancialTransaction>(data)
      s.items = payload.data ?? []
      s.meta = payload.meta
      return payload
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحميل المعاملات المالية')
      throw e
    } finally {
      s.loading = false
    }
  }

  async function loadOverview(scope: 'income' | 'expense') {
    const o = overviewByScope[scope]
    const s = stateByScope[scope]
    o.loading = true
    try {
      const p = buildParamsFromSlice(scope, s)
      const params: Record<string, number | string> = { page: 1, per_page: 500 }
      if (p.financial_account_id) params.financial_account_id = p.financial_account_id
      if (p.type) params.type = p.type
      if (p.date_from) params.date_from = p.date_from
      if (p.date_to) params.date_to = p.date_to
      const { data } = await apiClient.get('/api/financial-transactions', { params })
      const payload = parsePaginatedResponse<FinancialTransaction>(data)
      o.items = payload.data ?? []
      o.totalCount = payload.meta?.total ?? o.items.length
    } catch {
      o.items = []
      o.totalCount = 0
    } finally {
      o.loading = false
    }
  }

  function setFilters(scope: FinancialPageScope, partial: Partial<FinancialFiltersState>) {
    Object.assign(stateByScope[scope].filters, partial)
  }

  async function create(
    transaction: {
      financial_account_id: number
      type: 'income' | 'expense'
      amount: number
      date: string
      description?: string
      /** Required by API for manual `expense` rows. */
      expense_type?: string
      /** Required by API for manual `income` rows. */
      income_type?: string
    },
    scope: FinancialPageScope,
  ) {
    const s = stateByScope[scope]
    s.loading = true
    error.value = null
    try {
      const { data } = await apiClient.post('/api/financial-transactions', { ...transaction })
      const created = unwrapPayload<FinancialTransaction>(data)
      const per = s.meta?.per_page ?? 15
      await fetchPage(scope, 1, per)
      if (scope === 'income' || scope === 'expense') await loadOverview(scope)
      return created
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل إضافة المعاملة')
      throw e
    } finally {
      s.loading = false
    }
  }

  async function update(
    id: number,
    transaction: Partial<FinancialTransaction>,
    scope: FinancialPageScope,
  ) {
    const s = stateByScope[scope]
    s.loading = true
    error.value = null
    try {
      const body: Record<string, unknown> = {}
      if (transaction.type !== undefined) body.type = transaction.type
      if (transaction.amount !== undefined) body.amount = transaction.amount
      if (transaction.date !== undefined) body.date = transaction.date
      if (transaction.description !== undefined) body.description = transaction.description
      if (transaction.expense_type !== undefined) body.expense_type = transaction.expense_type
      if (transaction.income_type !== undefined) body.income_type = transaction.income_type
      const { data } = await apiClient.put(`/api/financial-transactions/${id}`, body)
      const updated = unwrapPayload<FinancialTransaction>(data)
      const page = s.meta?.current_page ?? 1
      const per = s.meta?.per_page ?? 15
      await fetchPage(scope, page, per)
      if (scope === 'income' || scope === 'expense') await loadOverview(scope)
      return updated
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل تحديث المعاملة')
      throw e
    } finally {
      s.loading = false
    }
  }

  async function remove(id: number, scope: FinancialPageScope) {
    const s = stateByScope[scope]
    s.loading = true
    error.value = null
    try {
      await apiClient.delete(`/api/financial-transactions/${id}`)
      const page = s.meta?.current_page ?? 1
      const per = s.meta?.per_page ?? 15
      await fetchPage(scope, page, per)
      if (scope === 'income' || scope === 'expense') await loadOverview(scope)
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'فشل حذف المعاملة')
      throw e
    } finally {
      s.loading = false
    }
  }

  function clearError() {
    error.value = null
  }

  /**
   * Loads all pages matching current filters (for Excel export). Caps at 200 pages × 500 rows.
   */
  async function fetchAllForExport(scope: 'income' | 'expense'): Promise<FinancialTransaction[]> {
    const s = stateByScope[scope]
    const all: FinancialTransaction[] = []
    let page = 1
    const per = 500
    while (page <= 200) {
      const p = buildParamsFromSlice(scope, s)
      const params: Record<string, number | string> = { page, per_page: per }
      if (p.financial_account_id) params.financial_account_id = p.financial_account_id
      if (p.type) params.type = p.type
      if (p.date_from) params.date_from = p.date_from
      if (p.date_to) params.date_to = p.date_to
      const { data } = await apiClient.get('/api/financial-transactions', { params })
      const payload = parsePaginatedResponse<FinancialTransaction>(data)
      const batch = payload.data ?? []
      all.push(...batch)
      const lastPage = payload.meta?.last_page ?? 1
      if (page >= lastPage || batch.length === 0) break
      page += 1
    }
    return all
  }

  return {
    stateByScope,
    overviewByScope,
    error,
    fetchPage,
    loadOverview,
    fetchAllForExport,
    setFilters,
    create,
    update,
    remove,
    clearError,
  }
})
