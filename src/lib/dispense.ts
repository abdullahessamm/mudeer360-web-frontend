import type { SaleInvoiceItem } from '@/types'

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

export function getDispenseStats(items: SaleInvoiceItem[] | undefined): DispenseStats {
  const list = items ?? []
  let dispensedAmount = 0
  let remainingAmount = 0
  let dispensedCount = 0

  for (const item of list) {
    const amt = itemAmount(item)
    if (item.is_dispensed) {
      dispensedAmount += amt
      dispensedCount++
    } else {
      remainingAmount += amt
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

export const DISPENSE_STATUS_SEVERITY: Record<DispenseStatus, 'success' | 'warn' | 'secondary'> = {
  full: 'success',
  partial: 'warn',
  none: 'secondary',
}
