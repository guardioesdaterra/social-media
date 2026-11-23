import { watch, type Ref } from 'vue'

export function useModalShell(open: Ref<boolean>, onClose: () => void) {
  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && open.value) {
      e.stopPropagation()
      onClose()
    }
  }

  watch(open, (value) => {
    if (value) {
      window.addEventListener('keydown', onKeydown, true)
      document.body.style.overflow = 'hidden'
    } else {
      window.removeEventListener('keydown', onKeydown, true)
      document.body.style.overflow = ''
    }
  })

  watch(
    () => open.value,
    (value, _, onCleanup) => {
      if (!value) return
      onCleanup(() => {
        window.removeEventListener('keydown', onKeydown, true)
        document.body.style.overflow = ''
      })
    },
  )
}
