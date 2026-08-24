import type { SaleInvoice, SaleInvoiceItem } from '@/types'

export type DispenseStatus = 'full' | 'partial' | 'none'

export interface DispenseStats {
  status: DispenseStatus
  dispensedAmount: number
  remainingAmount: number
  dispensedCount: number
  totalCount: number
}

function itemAmount(item: SaleInvoiceItem): number {
  return item.total_price ?? item.quantity * item.unit_price
}

/** When true, line has a product and on-hand qty is below line qty (for UX warning before dispense with deduct). */
export function isDispenseStockInsufficient(
  item: SaleInvoiceItem,
  deductStock: boolean,
): boolean {
  if (!deductStock || item.is_dispensed) return false
  if (!item.product_id) return false
  const available = item.product?.quantity
  if (available == null) return false
  return available < item.quantity
}

export function getDispenseStats(items: SaleInvoiceItem[] | undefined, invoice?: SaleInvoice): DispenseStats {
  const list = items ?? []
  let dispensedAmount = 0
  let remainingAmount = 0
  let dispensedCount = 0

  const itemsCount = invoice?.items?.length || 0
  const discountPerItem = invoice && itemsCount > 0 ? invoice.discount_amount / itemsCount : 0
  const taxPerItem = invoice && itemsCount > 0 ? invoice.tax_amount / itemsCount : 0

  for (const item of list) {
    const amt = itemAmount(item)
    if (item.is_dispensed) {
      dispensedAmount += amt - discountPerItem + taxPerItem
      dispensedCount++
    } else {
      remainingAmount += amt - discountPerItem + taxPerItem
    }
  }

  const totalCount = list.length
  const status: DispenseStatus =
    dispensedCount === 0 ? 'none' : dispensedCount === totalCount ? 'full' : 'partial'

  return {
    status,
    dispensedAmount,
    remainingAmount,
    dispensedCount,
    totalCount,
  }
}

export const DISPENSE_STATUS_LABELS: Record<DispenseStatus, string> = {
  full: 'تم الصرف بالكامل',
  partial: 'صرف جزئي',
  none: 'لم يتم الصرف',
}

export const DISPENSE_STATUS_SEVERITY: Record<DispenseStatus, 'success' | 'warn' | 'danger'> = {
  full: 'success',
  partial: 'warn',
  none: 'danger',
}

export const DISPENSE_STATUS_ICONS: Record<DispenseStatus, string> = {
  full: 'pi pi-check-circle',
  partial: 'pi pi-exclamation-triangle',
  none: 'pi pi-times-circle',
}
