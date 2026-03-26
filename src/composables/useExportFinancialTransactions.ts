import * as XLSX from 'xlsx'
import { formatDateLocal } from '@/lib/date'
import { expenseTypeLabel } from '@/lib/expenseTypes'
import { incomeTypeLabel } from '@/lib/incomeTypes'
import type { FinancialTransaction } from '@/types'

export type ExportFinancialKind = 'income' | 'expense'

export interface ExportFinancialTransactionsOptions {
  kind: ExportFinancialKind
  rows: FinancialTransaction[]
  dateRange: [Date, Date] | null
  /** Selected account name or null for "all accounts" */
  accountLabel: string | null
}

/**
 * Excel (.xlsx) report for filtered revenue or expense transactions (client-side, same engine as كشف الحساب).
 */
export function exportFinancialTransactionsReport(options: ExportFinancialTransactionsOptions): void {
  const { kind, rows, dateRange, accountLabel } = options
  const title = kind === 'income' ? 'تقرير الإيرادات' : 'تقرير المصروفات'
  const periodStr = dateRange
    ? `من ${formatDateLocal(dateRange[0])} إلى ${formatDateLocal(dateRange[1])}`
    : 'الكل'
  const accountStr = accountLabel ?? 'كل الحسابات'

  const data: (string | number)[][] = [[title], [`الحساب: ${accountStr}`], [`الفترة: ${periodStr}`], []]

  const filtered =
    kind === 'income' ? rows.filter((t) => t.type === 'income') : rows.filter((t) => t.type === 'expense')

  if (kind === 'income') {
    data.push([
      'التاريخ',
      'الحساب',
      'المبلغ',
      'الوصف',
      'تصنيف الإيراد',
      'العميل',
      'رقم فاتورة البيع',
      'يدوي',
    ])
    for (const t of filtered) {
      data.push([
        t.date,
        t.account?.name ?? '—',
        t.amount,
        t.description ?? '',
        incomeTypeLabel(t.income_type),
        t.customer_name ?? '—',
        t.invoice_number ?? '—',
        t.is_manual ? 'نعم' : 'لا',
      ])
    }
  } else {
    data.push([
      'التاريخ',
      'الحساب',
      'المبلغ',
      'الوصف',
      'تصنيف المصروف',
      'المورد',
      'رقم فاتورة الشراء',
      'يدوي',
    ])
    for (const t of filtered) {
      data.push([
        t.date,
        t.account?.name ?? '—',
        t.amount,
        t.description ?? '',
        expenseTypeLabel(t.expense_type),
        t.supplier_name ?? '—',
        t.invoice_number ?? '—',
        t.is_manual ? 'نعم' : 'لا',
      ])
    }
  }

  const sum = filtered.reduce((s, t) => s + (Number(t.amount) || 0), 0)
  data.push([])
  data.push(['عدد الحركات', filtered.length])
  data.push(['المجموع', sum])

  const worksheet = XLSX.utils.aoa_to_sheet(data)
  worksheet['!cols'] = [
    { wch: 12 },
    { wch: 22 },
    { wch: 14 },
    { wch: 40 },
    { wch: 18 },
    { wch: 22 },
    { wch: 18 },
    { wch: 8 },
  ]

  const workbook = XLSX.utils.book_new()
  const sheetName = kind === 'income' ? 'إيرادات' : 'مصروفات'
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

  const datePart = dateRange
    ? `${formatDateLocal(dateRange[0])}_${formatDateLocal(dateRange[1])}`
    : 'all'
  const fileName =
    kind === 'income' ? `تقرير_الإيرادات_${datePart}.xlsx` : `تقرير_المصروفات_${datePart}.xlsx`
  XLSX.writeFile(workbook, fileName)
}
