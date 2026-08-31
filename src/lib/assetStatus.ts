import type { AssetStatusValue } from '@/types'

export const ASSET_STATUS_OPTIONS: { label: string; value: AssetStatusValue }[] = [
  { label: 'يعمل', value: 'working' },
  { label: 'تحت الصيانة', value: 'under_maintenance' },
  { label: 'معطل', value: 'disabled' },
  { label: 'تخريد', value: 'scrapped' },
  { label: 'مستبعد', value: 'excluded' },
  { label: 'مباع', value: 'sold' },
]

export function assetStatusLabel(value: string | null | undefined): string {
  if (value == null || value === '') return '—'
  return ASSET_STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value
}

export function assetStatusSeverity(
  value: string | null | undefined,
): 'success' | 'warn' | 'danger' | 'info' | 'secondary' | 'contrast' {
  switch (value) {
    case 'working':
      return 'success'
    case 'under_maintenance':
      return 'warn'
    case 'disabled':
      return 'danger'
    case 'sold':
      return 'info'
    case 'scrapped':
    case 'excluded':
      return 'secondary'
    default:
      return 'secondary'
  }
}
