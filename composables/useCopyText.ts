export function useCopyText() {
  const toast = useToast()

  /** Copies text to the clipboard with a toast fallback for insecure contexts. */
  async function copyText(text: string, successMessage = 'Copied to clipboard.'): Promise<boolean> {
    if (!text) {
      toast.info('Nothing to copy.')
      return false
    }
    try {
      await navigator.clipboard.writeText(text)
      toast.success(successMessage)
      return true
    } catch {
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.setAttribute('readonly', '')
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        ta.remove()
        toast.success(successMessage)
        return true
      } catch {
        toast.error('Could not copy to the clipboard.')
        return false
      }
    }
  }

  return { copyText }
}
