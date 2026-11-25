<template>
  <div class="mx-auto max-w-md py-20 text-center">
    <span
      class="mx-auto mb-4 block h-8 w-8 animate-spin rounded-full border-2 border-[var(--eg-accent)] border-t-transparent"
    />
    <h1 class="text-base font-medium text-white">Completing sign-in…</h1>
    <p class="mt-2 text-sm text-zinc-500">Exchanging the authorization code for your session.</p>

    <div v-if="message" class="mt-6">
      <p class="text-sm" :class="ok ? 'text-emerald-400' : 'text-red-400'">{{ message }}</p>
      <NuxtLink to="/login" class="eg-btn-ghost mt-4 inline-flex">Back to sign in</NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { edgeFunctionUrl } from '~/lib/supabase'

const { exchangeCode, bootstrap, isManager, phase, session } = useSupabaseAuth()
const router = useRouter()
const route = useRoute()

const message = ref('')
const ok = ref(false)

// Check if this is a popup relay flow
const isPopupRelay = computed(() => {
  const params = new URLSearchParams(window.location.search)
  return params.has('popup')
})

// Show success message in popup before closing
function showSuccessAndClose(messageText: string) {
  message.value = messageText
  ok.value = true
}

// Relay session back to opener popup and close
async function relaySessionToOpener(session: any) {
  if (!window.opener) return

  try {
    window.opener.postMessage(
      {
        source: 'eg-auth',
        type: 'auth:session',
        payload: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        },
      },
      window.location.origin,
    )
  } catch (err) {
    console.error('[callback] Failed to postMessage to opener', err)
  }
}

// Close popup after relay (2 seconds to ensure opener receives message)
async function closePopup() {
  await new Promise((resolve) => setTimeout(resolve, 2000))
  if (window.opener && !window.opener.closed) {
    window.close()
  }
}

/**
 * After a successful PKCE code exchange, Supabase embeds the Google
 * provider_token and provider_refresh_token in the session object.
 * We persist them to the edge function so tag-notify can send emails
 * via the Gmail API as the signed-in manager's real Google account.
 */
async function storeProviderToken() {
  const s = session.value
  if (!s) return
  const pt = (s as unknown as Record<string, unknown>).provider_token as string | undefined
  const prt = (s as unknown as Record<string, unknown>).provider_refresh_token as string | undefined
  if (!pt && !prt) return

  try {
    await fetch(edgeFunctionUrl('store-provider-token'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${s.access_token}`,
        Origin: window.location.origin,
      },
      body: JSON.stringify({
        provider_token: pt ?? null,
        provider_refresh_token: prt ?? null,
        expires_in: 3600,
      }),
    })
  } catch (err) {
    // Non-fatal – fallback email via Resend will still work
    console.warn('[callback] Failed to store provider token', err)
  }
}

onMounted(async () => {
  await bootstrap()

  // Use window.location for client-side URL parsing (more reliable after OAuth redirect)
  const urlParams = new URL(window.location.href).searchParams

  // Handle error from OAuth provider
  const error = urlParams.get('error_description') || urlParams.get('error')
  if (error) {
    message.value = decodeURIComponent(error)
    return
  }

  // Check for authorization code
  const code = urlParams.get('code')
  const hasCode = !!code

  // If popup mode, exchange code and relay session
  if (isPopupRelay.value) {
    if (hasCode) {
      const passed = await exchangeCode()
      if (passed && session.value) {
        showSuccessAndClose('Authentication successful! Closing…')
        await storeProviderToken()
        await relaySessionToOpener(session.value)
        await closePopup()
        return
      } else {
        message.value = 'Sign-in could not be completed.'
        return
      }
    } else if (session.value) {
      // Already have session (e.g., from redirect)
      showSuccessAndClose('Authentication successful! Closing…')
      await storeProviderToken()
      await relaySessionToOpener(session.value)
      await closePopup()
      return
    }
    message.value = 'No authorization code found. Please sign in again.'
    return
  }

  // Regular (non-popup) mode - redirect-based flow
  if (isManager.value) {
    await storeProviderToken()
    await router.replace('/calendario')
    return
  }

  if (hasCode) {
    const passed = await exchangeCode()
    if (passed) {
      ok.value = true
      message.value = 'Welcome! Opening the calendar…'
      await storeProviderToken()
      await router.replace('/calendario')
    } else {
      message.value = 'Sign-in could not be completed.'
    }
    return
  }

  if (phase.value !== 'anonymous') return
  message.value = 'No authorization code found. Please sign in again.'
})
</script>
