/** قيم مخزّنة في الـ API — العناوين للعرض بالعربية */
export const FINANCIAL_ACCOUNT_TYPE_OPTIONS = [
  { value: 'cash', label: 'نقدي' },
  { value: 'bank', label: 'بنك' },
  { value: 'electronic_wallet', label: 'محفظة إلكترونية' },
  { value: 'check', label: 'شيكات' },
  { value: 'other', label: 'أخرى' },
] as const

const labelByValue = Object.fromEntries(
  FINANCIAL_ACCOUNT_TYPE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<string, string>

/** ترجمة نوع الحساب للعرض في الجداول */
export function financialAccountTypeLabel(type: string | undefined | null): string {
  if (type == null || type === '') return '—'
  const key = type.trim().toLowerCase()
  return labelByValue[key] ?? type
}
