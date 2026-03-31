import type { AssetStatusValue } from '@/types'

export const ASSET_STATUS_OPTIONS: { label: string; value: AssetStatusValue }[] = [
  { label: 'يعمل', value: 'working' },
  { label: 'معطل', value: 'disabled' },
  { label: 'تحت الصيانة', value: 'under_maintenance' },
  { label: 'مستبعد', value: 'excluded' },
]

export function assetStatusLabel(value: string | null | undefined): string {
  if (value == null || value === '') return '—'
  return ASSET_STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value
}
