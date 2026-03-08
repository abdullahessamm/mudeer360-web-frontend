import type { ApiResponse, PaginatedPayload } from '@/types'

type PaginatedMeta = PaginatedPayload<unknown>['meta']
type PaginatedLinks = PaginatedPayload<unknown>['links']

/** Extract payload from API response. Throws with message/errors on non-success. */
export function unwrapPayload<T>(data: unknown): T {
  const res = data as ApiResponse<T>
  if (res?.success && res.payload !== undefined) {
    return res.payload
  }
  // Backend returns object directly (no wrapper)
  if (data && typeof data === 'object' && !('success' in (data as object))) {
    const obj = data as Record<string, unknown>
    if (!obj.message && !obj.errors) {
      return data as T
    }
  }
  const err = data as { message?: string; errors?: Record<string, string[]> }
  const msg = err?.message ?? 'حدث خطأ غير متوقع'
  const errors = err?.errors
  if (errors && Object.keys(errors).length > 0) {
    const firstField = Object.keys(errors)[0]
    if (firstField) {
      const firstMsg = errors[firstField]?.[0]
      throw new Error(firstMsg ?? msg)
    }
  }
  throw new Error(msg)
}

/**
 * Parse paginated suppliers response. Handles both:
 * - New schema: { success, payload: { data, meta, links } }
 * - Laravel default: { data, meta, links }
 * - Plain array: [...]
 */
export function parsePaginatedResponse<T>(data: unknown): PaginatedPayload<T> {
  if (!data) return { data: [], meta: defaultMeta(), links: defaultLinks() }

  // Plain array (Laravel returns array directly)
  if (Array.isArray(data)) {
    return {
      data: data as T[],
      meta: defaultMeta((data as unknown[]).length),
      links: defaultLinks(),
    }
  }

  const res = data as Record<string, unknown>

  // New schema: { success, payload: { data, meta, links } }
  if (res.success && res.payload && typeof res.payload === 'object') {
    const p = res.payload as PaginatedPayload<T>
    return {
      data: Array.isArray(p.data) ? p.data : [],
      meta: p.meta ?? defaultMeta(),
      links: p.links ?? defaultLinks(),
    }
  }

  // Laravel default: { data, meta, links }
  if (Array.isArray(res.data)) {
    return {
      data: res.data as T[],
      meta: (res.meta as PaginatedMeta) ?? defaultMeta(),
      links: (res.links as PaginatedLinks) ?? defaultLinks(),
    }
  }

  return { data: [], meta: defaultMeta(), links: defaultLinks() }
}

function defaultMeta(total = 0) {
  return {
    current_page: 1,
    last_page: 1,
    per_page: 15,
    total,
    from: total > 0 ? 1 : null,
    to: total > 0 ? total : null,
  }
}

function defaultLinks() {
  return { first: '', last: '', prev: null, next: null }
}

/** Get error message from axios error response */
export function getErrorMessage(e: unknown, fallback: string): string {
  const err = e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }
  const data = err?.response?.data
  if (!data) return fallback
  if (data.message) return data.message
  if (data.errors && Object.keys(data.errors).length > 0) {
    const first = Object.values(data.errors)[0]
    const msg = Array.isArray(first) ? first[0] : first
    return msg ?? fallback
  }
  return fallback
}
