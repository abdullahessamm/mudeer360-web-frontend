/**
 * Matches backend `FinancialIncomeTypeEnum` (manual + system-linked).
 */
export const MANUAL_INCOME_TYPE_OPTIONS = [
  { label: 'بيع مفرق', value: 'retail' },
  { label: 'خدمات', value: 'services' },
  { label: 'بيع جملة', value: 'wholesale' },
  { label: 'اشتراك / متكرر', value: 'subscription' },
  { label: 'أخرى', value: 'other' },
] as const

/** فواتير وربط نظامي — يطابق `FinancialIncomeTypeEnum` غير اليدوي */
export const LINKED_INCOME_TYPE_OPTIONS = [
  { label: 'فاتورة بيع', value: 'sale_invoice' },
  { label: 'رصيد عميل', value: 'customer_balance' },
  { label: 'إيداع شريك (جاري)', value: 'partner_deposit' },
] as const

export type ManualIncomeTypeValue = (typeof MANUAL_INCOME_TYPE_OPTIONS)[number]['value']

const INCOME_TYPE_LABELS: Record<string, string> = {
  retail: 'بيع مفرق',
  services: 'خدمات',
  wholesale: 'بيع جملة',
  subscription: 'اشتراك',
  other: 'أخرى',
  sale_invoice: 'فاتورة بيع',
  customer_balance: 'رصيد عميل',
  partner_deposit: 'إيداع شريك (جاري)',
}

export function incomeTypeLabel(value: string | null | undefined): string {
  if (value == null || value === '') return '—'
  return INCOME_TYPE_LABELS[value] ?? value
}
