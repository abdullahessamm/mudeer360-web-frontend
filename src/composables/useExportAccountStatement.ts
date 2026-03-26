import * as XLSX from 'xlsx'

export interface InvoiceForExport {
  invoice_number: string
  invoice_date: string
  type: string
  total_amount: number
  paid_amount: number
  status: string
}

const STATUS_LABELS: Record<string, string> = {
  paid: 'مدفوع',
  partial: 'مدفوع جزئياً',
  unpaid: 'غير مدفوع',
}

const TYPE_LABELS: Record<string, string> = {
  cash: 'نقدي',
  credit: 'آجل',
}

export interface ExportAccountStatementOptions {
  /** Customer or supplier name */
  accountName: string
  /** 'customer' for sale invoices, 'supplier' for purchase invoices */
  accountType: 'customer' | 'supplier'
  /** Filtered invoices to export */
  invoices: InvoiceForExport[]
  /** Summary totals */
  summary: {
    count: number
    total_amount: number
    paid_amount: number
    remaining_amount: number
  }
  /** Date range filter (for header) */
  dateRange?: { from: string; to: string } | null
}

/**
 * Export filtered invoices as Excel account statement.
 * Includes invoice list and summary (total invoices, total amount, paid, remaining).
 */
export function exportAccountStatement(options: ExportAccountStatementOptions): void {
  const {
    accountName,
    accountType,
    invoices,
    summary,
    dateRange,
  } = options

  const accountTypeLabel = accountType === 'customer' ? 'العميل' : 'المورد'
  const statementTitle =
    accountType === 'customer' ? 'كشف حساب عميل - فواتير البيع' : 'كشف حساب مورد - فواتير الشراء'

  const dateRangeStr = dateRange
    ? `من ${dateRange.from} إلى ${dateRange.to}`
    : 'الكل'

  const data: (string | number)[][] = [
    [statementTitle],
    [`${accountTypeLabel}: ${accountName}`],
    [`الفترة: ${dateRangeStr}`],
    [],
    ['رقم الفاتورة', 'التاريخ', 'النوع', 'الإجمالي', 'المدفوع', 'المتبقي', 'الحالة'],
  ]

  for (const inv of invoices) {
    const remaining = Math.max(0, inv.total_amount - inv.paid_amount)
    data.push([
      inv.invoice_number,
      inv.invoice_date,
      TYPE_LABELS[inv.type] ?? inv.type,
      inv.total_amount,
      inv.paid_amount,
      remaining,
      STATUS_LABELS[inv.status] ?? inv.status,
    ])
  }

  data.push([])
  data.push(['الإجماليات', '', '', '', '', '', ''])
  data.push(['عدد الفواتير', summary.count, '', '', '', '', ''])
  data.push(['إجمالي المبالغ', summary.total_amount, '', '', '', '', ''])
  data.push(['إجمالي المدفوع', summary.paid_amount, '', '', '', '', ''])
  data.push(['المتبقي', summary.remaining_amount, '', '', '', '', ''])

  const worksheet = XLSX.utils.aoa_to_sheet(data)

  const colWidths = [
    { wch: 16 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
  ]
  worksheet['!cols'] = colWidths

  const workbook = XLSX.utils.book_new()
  const safeName = accountName.replace(/[/\\?*\[\]]/g, '_').slice(0, 31)
  const sheetName = accountType === 'customer' ? 'كشف حساب عميل' : 'كشف حساب مورد'
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

  const datePart = dateRange ? `${dateRange.from}_${dateRange.to}` : 'الكل'
  const fileName = `كشف_حساب_${safeName}_${datePart}.xlsx`
  XLSX.writeFile(workbook, fileName)
}
