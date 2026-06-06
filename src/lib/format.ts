/** Arabic UI locale with Western digits (0–9). */
export const APP_LOCALE = 'ar-EG'

const LATN: Pick<Intl.NumberFormatOptions, 'numberingSystem'> = { numberingSystem: 'latn' }

export function formatNumber(
  value: number | null | undefined,
  options?: Intl.NumberFormatOptions,
): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString(APP_LOCALE, { ...LATN, ...options })
}

/** Money amounts — 2 decimal places, English digits. */
export function formatMoney(value: number | null | undefined): string {
  return formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Stock / quantity — up to 4 decimals, English digits. */
export function formatQty(value: number | null | undefined): string {
  return formatNumber(value, { minimumFractionDigits: 0, maximumFractionDigits: 4 })
}

export function formatDateTime(
  value: Date | string | number | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (value == null || value === '') return '—'
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(APP_LOCALE, { ...LATN, ...options })
}

/** Long date for print headers / statements. */
export function formatDateLong(value: Date | null | undefined): string {
  if (!value || Number.isNaN(value.getTime())) return '—'
  return value.toLocaleDateString(APP_LOCALE, { ...LATN, dateStyle: 'long' })
}

/** Long date + short time (invoice PDF / print). */
export function formatIssuedAt(value: Date | number): string {
  const d = value instanceof Date ? value : new Date(value)
  return d.toLocaleString(APP_LOCALE, {
    ...LATN,
    dateStyle: 'long',
    timeStyle: 'short',
  })
}
