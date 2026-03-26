/**
 * Matches backend `FinancialExpenseTypeEnum` (manual + system-linked).
 */
export const MANUAL_EXPENSE_TYPE_OPTIONS = [
  { label: 'إيجار', value: 'rent' },
  { label: 'مرافق (كهرباء، ماء، …)', value: 'utilities' },
  { label: 'مستلزمات', value: 'supplies' },
  { label: 'رواتب', value: 'salaries' },
  { label: 'تسويق/إعلان', value: 'marketing' },
  { label: 'أخرى', value: 'other' },
] as const

export type ManualExpenseTypeValue = (typeof MANUAL_EXPENSE_TYPE_OPTIONS)[number]['value']

const EXPENSE_TYPE_LABELS: Record<string, string> = {
  rent: 'إيجار',
  utilities: 'مرافق',
  supplies: 'مستلزمات',
  salaries: 'رواتب',
  marketing: 'تسويق',
  other: 'أخرى',
  purchase_invoice: 'فاتورة شراء',
  payroll: 'رواتب (موظفين)',
  employee: 'موظف (سلفة/…)',
  customer_balance: 'رصيد عميل',
}

/** Arabic label for display in tables; falls back to raw value when unknown. */
export function expenseTypeLabel(value: string | null | undefined): string {
  if (value == null || value === '') return '—'
  return EXPENSE_TYPE_LABELS[value] ?? value
}
