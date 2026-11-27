import type { Session } from '@supabase/supabase-js'
import type { ManagerUser } from '~/lib/types'
import { MANAGER_DOMAIN } from '~/lib/constants'
import { useSupabase, edgeFunctionUrl } from '~/lib/supabase'
import { isMock, MOCK_MANAGER } from '~/lib/mock'
import { shallowRef, computed, readonly } from 'vue'

export type AuthPhase = 'boot' | 'anonymous' | 'checking' | 'manager' | 'denied'

const session = shallowRef<Session | null>(null)
const phase = shallowRef<AuthPhase>('boot')
const manager = shallowRef<ManagerUser | null>(null)
const authError = shallowRef<string | null>(null)

let initialized = false

/**
 * Session + domain gate (`is-manager`).
 *
 * Any Google account can sign in; only `*@earthguardians.org` reaches
 * `phase = 'manager'`. Everyone else lands on `denied`.
 */
export function useSupabaseAuth() {
  const supabase = useSupabase()
  const mock = isMock()
  const cfg = useRuntimeConfig()
  const appBase = cfg.app.baseURL || import.meta.env.BASE_URL || '/'

  async function evaluateGate(): Promise<void> {
    // Re-verifying a session that already passed the gate must NOT flip the UI
    // back to the loading shell: AuthGate unmounts the whole calendar app for
    // `checking`, which throws away the selected day/view on every background
    // auth event (token refresh, storage sync, tab restore…).
    const wasManager = phase.value === 'manager'
    if (!wasManager) phase.value = 'checking'
    authError.value = null

    const token = session.value?.access_token
    if (!token) {
      phase.value = 'anonymous'
      manager.value = null
      return
    }

    if (mock) {
      manager.value = { ...MOCK_MANAGER }
      phase.value = 'manager'
      return
    }

    try {
    const res = await fetch(edgeFunctionUrl('is-manager'), {
      method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-client-info': 'eg-social-media/1.0',
          Origin: window.location.origin,
        },
        body: JSON.stringify({ email: session.value?.user.email ?? '' }),
      })

      if (!res.ok) {
        // Transient failure of an already-granted session: keep the app alive
        // rather than kicking a manager out to the "access restricted" screen.
        if (wasManager) {
          console.warn(`[auth] background gate re-check failed (HTTP ${res.status}); keeping session`)
          return
        }
        phase.value = 'denied'
        manager.value = null
        authError.value = `The access check rejected this session (HTTP ${res.status}).`
        return
      }

      const data = (await res.json()) as {
        is_manager?: boolean
        reason?: string
        email?: string
      }

      if (data.is_manager) {
        manager.value = {
          email: data.email || session.value?.user.email || '',
          name:
            (session.value?.user.user_metadata?.full_name as string | undefined) ||
            'Earth Guardians Manager',
          avatar: (session.value?.user.user_metadata?.avatar_url as string | undefined) || '',
        }
        phase.value = 'manager'
      } else {
        manager.value = null
        phase.value = 'denied'
        authError.value = data.reason || `Access is restricted to ${MANAGER_DOMAIN} accounts.`
      }
    } catch (err) {
      // Same principle as above: a network blip must not tear down a live app.
      if (wasManager) {
        console.warn('[auth] background gate re-check failed; keeping session', err)
        return
      }
      console.error('[auth] is-manager failed', err)
      phase.value = 'denied'
      manager.value = null
      authError.value = 'Could not verify your access. Check your connection and try again.'
    }
  }

  function subscribe() {
    if (mock) return
    supabase.auth.onAuthStateChange((_event, s) => {
      session.value = s
      if (!s) {
        phase.value = 'anonymous'
        manager.value = null
        return
      }
      void evaluateGate()
    })
  }

  /** Called once, at application boot (client-side only). */
  async function bootstrap(): Promise<void> {
    if (initialized) return
    initialized = true

    if (!import.meta.client) {
      phase.value = 'boot'
      return
    }

    subscribe()

    if (mock) {
      session.value = {
        access_token: 'mock-token',
        user: {
          email: MOCK_MANAGER.email,
          user_metadata: { full_name: MOCK_MANAGER.name, avatar_url: MOCK_MANAGER.avatar },
        } as any,
      } as Session
      manager.value = { ...MOCK_MANAGER }
      phase.value = 'manager'
      return
    }

    try {
      const { data, error } = await supabase.auth.getSession()
      if (error) throw error
      session.value = data.session
      if (data.session) {
        await evaluateGate()
      } else {
        phase.value = 'anonymous'
      }
    } catch (err) {
      console.error('[auth] bootstrap failed', err)
      phase.value = 'anonymous'
    }
  }

  function callbackUrl(): string {
    const base = appBase
    return `${window.location.origin}${base.replace(/\/$/, '')}/auth/callback`
  }

  async function signInWithGoogle(options: { redirectTo?: string } = {}): Promise<string | null> {
    authError.value = null
    if (mock) {
      manager.value = { ...MOCK_MANAGER }
      phase.value = 'manager'
      return null
    }
    try {
      // We request the gmail.send scope so the app can send tag-notification
      // emails through the signed-in manager's own @earthguardians.org Gmail
      // account via the Gmail REST API (using provider_token).
      // `access_type: 'offline'` + `prompt: 'consent'` are required to
      // receive a refresh_token so we can re-authorise after the 1-hour
      // provider_token expiry.
      // Also request drive.readonly for Google Drive file picker integration.
      const redirectTo = options.redirectTo ?? callbackUrl()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          scopes: 'openid email profile https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/drive.readonly',
          queryParams: {
            prompt: 'consent',
            access_type: 'offline',
          },
        },
      })
      if (error) throw error
      return null
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not start Google sign-in.'
      authError.value = msg
      return msg
    }
  }

  /** Exchanges the `code` in the URL for a session (Supabase PKCE flow). */
  async function exchangeCode(): Promise<boolean> {
    try {
      const code = new URL(window.location.href).searchParams.get('code')
      if (!code) {
        authError.value = 'No authorization code found in URL.'
        phase.value = 'anonymous'
        return false
      }
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) throw error
      session.value = (await supabase.auth.getSession()).data.session
      await evaluateGate()
      return phase.value === 'manager'
    } catch (err) {
      console.error('[auth] exchangeCodeForSession', err)
      authError.value = err instanceof Error ? err.message : 'Invalid authorization code.'
      phase.value = 'anonymous'
      return false
    }
  }

  async function signOut(): Promise<void> {
    if (mock) {
      session.value = null
      manager.value = null
      phase.value = 'anonymous'
      return
    }
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } finally {
      session.value = null
      manager.value = null
      phase.value = 'anonymous'
    }
  }

  return {
    session: readonly(session),
    phase: readonly(phase),
    manager: readonly(manager),
    authError: readonly(authError),
    callbackUrl,
    bootstrap,
    signInWithGoogle,
    exchangeCode,
    signOut,
    evaluateGate,
    isManager: computed(() => phase.value === 'manager'),
  }
}
