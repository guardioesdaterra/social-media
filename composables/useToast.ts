import { ref, readonly } from 'vue'

interface ToastItem {
  id: number
  text: string
  tone: 'info' | 'success' | 'error'
}

const toasts = ref<ToastItem[]>([])
let seq = 0

export function useToast() {
  function push(text: string, tone: ToastItem['tone'] = 'info', ttl = 3800) {
    const id = ++seq
    toasts.value = [...toasts.value, { id, text, tone }]
    if (import.meta.client) {
      window.setTimeout(() => dismiss(id), ttl)
    }
  }

  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  return {
    toasts: readonly(toasts),
    push,
    dismiss,
    success: (t: string) => push(t, 'success'),
    error: (t: string) => push(t, 'error', 6000),
    info: (t: string) => push(t, 'info'),
  }
}
