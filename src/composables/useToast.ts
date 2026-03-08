import ToastEventBus from 'primevue/toasteventbus'
import { useToast as usePrimeToast } from 'primevue/usetoast'
import type { ToastServiceMethods } from 'primevue/toastservice'

/**
 * Centralized toast service - uses PrimeVue Toast via ToastEventBus.
 * Works from anywhere (setup, watch callbacks, async handlers) - no inject() required.
 */
export function useToast(): ToastServiceMethods {
  return usePrimeToast()
}

function emitToast(severity: string, detail: string, summary: string) {
  ToastEventBus.emit('add', { severity, summary, detail, life: 3000 })
}

/** Show error toast (Arabic defaults) - safe to call from watch/async */
export function showError(detail: string, summary = 'خطأ') {
  emitToast('error', detail, summary)
}

/** Show success toast (Arabic defaults) */
export function showSuccess(detail: string, summary = 'تم بنجاح') {
  emitToast('success', detail, summary)
}

/** Show info toast (Arabic defaults) */
export function showInfo(detail: string, summary = 'معلومة') {
  emitToast('info', detail, summary)
}

/** Show warning toast (Arabic defaults) */
export function showWarn(detail: string, summary = 'تحذير') {
  emitToast('warn', detail, summary)
}
