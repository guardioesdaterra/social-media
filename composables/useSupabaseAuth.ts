import type { Session } from '@supabase/supabase-js'
import type { ManagerUser } from '~/lib/types'
import { MANAGER_DOMAIN } from '~/lib/constants'
import { useSupabase, edgeFunctionUrl } from '~/lib/supabase'
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

  async function evaluateGate(): Promise<void> {
    phase.value = 'checking'
    authError.value = null

    const token = session.value?.access_token
    if (!token) {
      phase.value = 'anonymous'
      manager.value = null
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
      console.error('[auth] is-manager failed', err)
      phase.value = 'denied'
      manager.value = null
      authError.value = 'Could not verify your access. Check your connection and try again.'
    }
  }

  function subscribe() {
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
    const cfg = useRuntimeConfig()
    const base = cfg.app.baseURL || import.meta.env.BASE_URL || '/'
    return `${window.location.origin}${base.replace(/\/$/, '')}/auth/callback`
  }

  async function signInWithGoogle(): Promise<string | null> {
    authError.value = null
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl(),
          queryParams: {
            prompt: 'select_account',
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
      const { error } = await supabase.auth.exchangeCodeForSession(window.location.href)
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
    bootstrap,
    signInWithGoogle,
    exchangeCode,
    signOut,
    evaluateGate,
    isManager: computed(() => phase.value === 'manager'),
  }
}
