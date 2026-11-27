/**
 * composables/usePopupAuth.ts
 * @why Popup-based OAuth for SquareSpace embedding — avoids Google's
 *       X-Frame-Options: DENY by opening a popup window instead of
 *       redirecting the iframe parent. After successful login, the popup
 *       relays the session back to the opener via postMessage and closes.
 * @functions usePopupAuth
 */

import { ref, onMounted, onBeforeUnmount, readonly } from 'vue'
import { useSupabase } from '~/lib/supabase'
import type { Session } from '@supabase/supabase-js'

export interface PopupAuthResult {
  success: boolean
  session?: Session | null
  error?: string
}

export interface UsePopupAuthOptions {
  /** Origin allow-list for inbound postMessage (opener must match). */
  trustedOrigins?: string[]
  /** Popup width in pixels. */
  popupWidth?: number
  /** Popup height in pixels. */
  popupHeight?: number
}

const DEFAULT_TRUSTED_ORIGINS = ['https://earthguardians.org', 'https://www.earthguardians.org']
const DEFAULT_POPUP_WIDTH = 600
const DEFAULT_POPUP_HEIGHT = 700

export function usePopupAuth(opts: UsePopupAuthOptions = {}) {
  const supabase = useSupabase()
  const cfg = useRuntimeConfig()
  const appBase = cfg.app.baseURL || import.meta.env.BASE_URL || '/'
  const trusted = new Set([...DEFAULT_TRUSTED_ORIGINS, ...(opts.trustedOrigins ?? [])])
  const popupWidth = opts.popupWidth ?? DEFAULT_POPUP_WIDTH
  const popupHeight = opts.popupHeight ?? DEFAULT_POPUP_HEIGHT

  const isBusy = ref(false)
  const authResult = ref<PopupAuthResult | null>(null)

  let messageUnsubscribe: (() => void) | null = null

  function callbackUrl(): string {
    const base = appBase
    return `${window.location.origin}${base.replace(/\/$/, '')}/auth/callback`
  }

  /** Timeout for popup auth in milliseconds */
  const AUTH_TIMEOUT_MS = 120000 // 2 minutes

  /**
   * Open Google OAuth in a popup window and wait for completion.
   * Returns a promise that resolves when the popup closes or times out.
   */
  async function signInWithPopup(): Promise<PopupAuthResult> {
    if (isBusy.value) {
      return { success: false, error: 'Authentication is already in progress' }
    }

    isBusy.value = true
    authResult.value = null

    const redirectUrl = callbackUrl()
    const popupUrl = `${redirectUrl}?popup=1&next=${encodeURIComponent(window.location.origin + window.location.pathname)}`

    // Center popup on screen
    const left = (screen.width - popupWidth) / 2
    const top = (screen.height - popupHeight) / 2
    const features = [
      `width=${popupWidth}`,
      `height=${popupHeight}`,
      `left=${left}`,
      `top=${top}`,
      'toolbar=no',
      'location=no',
      'directories=no',
      'status=no',
      'menubar=no',
      'scrollbars=yes',
      'resizable=yes',
      'copyhistory=no',
    ].join(',')

    const popup = window.open(popupUrl, 'eg-social-auth', features)

    if (!popup) {
      isBusy.value = false
      return { success: false, error: 'Popup blocked. Please allow popups for this site.' }
    }

    // Focus popup window
    try {
      popup.focus()
    } catch {
      // Ignore cross-origin focus errors
    }

    // Set up message listener for session relay
    const handleMessage = async (event: MessageEvent) => {
      // Validate origin
      if (!trusted.has(event.origin) && event.origin !== window.location.origin) {
        return
      }

      // Check if this is our auth relay message
      if (event.data && event.data.source === 'eg-auth' && event.data.type === 'auth:session') {
        // Validate it's from our popup (or trusted opener)
        if (event.source !== popup) return

        const payload = event.data.payload as { access_token: string; refresh_token: string }
        
        try {
          // Set session in this window
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: payload.access_token,
            refresh_token: payload.refresh_token,
          })
          if (sessionError) throw sessionError
          
          authResult.value = {
            success: true,
            session: data.session || null,
          }
        } catch (err) {
          authResult.value = {
            success: false,
            error: err instanceof Error ? err.message : 'Failed to set session',
          }
        } finally {
          isBusy.value = false
        }
      }
    }

    // Cleanup function
    const cleanup = () => {
      window.removeEventListener('message', handleMessage as any)
      if (checkPopupClosed) clearInterval(checkPopupClosed)
      if (authTimeout) clearTimeout(authTimeout)
      if (checkResultInterval) clearInterval(checkResultInterval)
    }

    // Listen for close signal (popup closed without auth)
    const checkPopupClosed = setInterval(() => {
      if (!popup || popup.closed) {
        if (!authResult.value) {
          authResult.value = {
            success: false,
            error: 'Authentication popup closed',
          }
        }
        cleanup()
        isBusy.value = false
      }
    }, 250)

    // Fallback timeout - auto-resolve after 2 minutes
    const authTimeout = setTimeout(() => {
      if (!authResult.value) {
        authResult.value = {
          success: false,
          error: 'Authentication timed out',
        }
        // Try to close popup
        if (popup && !popup.closed) {
          popup.close()
        }
        cleanup()
        isBusy.value = false
      }
    }, AUTH_TIMEOUT_MS)

    // Poll for result
    let checkResultInterval: ReturnType<typeof setInterval> | null = null
    checkResultInterval = setInterval(() => {
      if (authResult.value) {
        cleanup()
      }
    }, 100)

    messageUnsubscribe = cleanup

    window.addEventListener('message', handleMessage as any)

    return new Promise<PopupAuthResult>((resolve) => {
      const checkResult = setInterval(() => {
        if (authResult.value) {
          clearInterval(checkResult)
          resolve(authResult.value)
        }
      }, 100)
    })
  }

  // Cleanup on unmount
  onBeforeUnmount(() => {
    if (messageUnsubscribe) {
      messageUnsubscribe()
      messageUnsubscribe = null
    }
  })

  return {
    isBusy: readonly(isBusy),
    authResult: readonly(authResult),
    signInWithPopup,
  }
}
