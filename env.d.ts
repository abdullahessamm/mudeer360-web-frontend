/// <reference types="vite/client" />

declare module 'primevue/toasteventbus' {
  const ToastEventBus: {
    emit(event: string, payload?: unknown): void
    on(event: string, handler: (...args: unknown[]) => void): void
    off(event: string, handler?: (...args: unknown[]) => void): void
  }
  export default ToastEventBus
}
