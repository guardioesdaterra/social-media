import { ref } from 'vue'
import { useSupabase, edgeFunctionUrl } from '~/lib/supabase'

export interface CaptureResult {
  message: string
  url: string
  job_id?: string | null
}

/**
 * Trigger Wayback Machine capture via our edge function.
 * Keeps API key server-side.
 */
export function useWaybackCapture() {
  const capturing = ref(false)
  const error = ref<string | null>(null)
  const lastResult = ref<CaptureResult | null>(null)

  async function capture(url: string): Promise<CaptureResult | null> {
    const supabase = useSupabase()
    capturing.value = true
    error.value = null
    lastResult.value = null

    try {
      const { data, error: fnError } = await supabase.functions.invoke('wayback-capture', {
        body: { url },
      })

      if (fnError) {
        throw new Error(fnError.message)
      }

      lastResult.value = data as CaptureResult
      return data as CaptureResult
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Capture failed'
      return null
    } finally {
      capturing.value = false
    }
  }

  return {
    capturing,
    error,
    lastResult,
    capture,
  }
}