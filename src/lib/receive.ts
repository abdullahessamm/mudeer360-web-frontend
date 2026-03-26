import type { PurchaseInvoiceItem } from '@/types'

export type ReceiveStatus = 'full' | 'partial' | 'none'

export interface ReceiveStats {
  status: ReceiveStatus
  receivedAmount: number
  remainingAmount: number
  receivedCount: number
  totalCount: number
}

function itemAmount(item: PurchaseInvoiceItem): number {
  return item.total_price ?? item.quantity * item.unit_price
}

export function getReceiveStats(items: PurchaseInvoiceItem[] | undefined): ReceiveStats {
  const list = items ?? []
  let receivedAmount = 0
  let remainingAmount = 0
  let receivedCount = 0

  for (const item of list) {
    const amt = itemAmount(item)
    if (item.is_received) {
      receivedAmount += amt
      receivedCount++
    } else {
      remainingAmount += amt
    }
  }

  const totalCount = list.length
  const status: ReceiveStatus =
    receivedCount === 0 ? 'none' : receivedCount === totalCount ? 'full' : 'partial'

  return {
    status,
    receivedAmount,
    remainingAmount,
    receivedCount,
    totalCount,
  }
}

export const RECEIVE_STATUS_LABELS: Record<ReceiveStatus, string> = {
  full: 'تم الاستلام بالكامل',
  partial: 'استلام جزئي',
  none: 'لم يتم الاستلام',
}

export const RECEIVE_STATUS_SEVERITY: Record<ReceiveStatus, 'success' | 'warn' | 'secondary'> = {
  full: 'success',
  partial: 'warn',
  none: 'secondary',
}
