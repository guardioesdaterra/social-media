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

  if (isManager.value) {
    await storeProviderToken()
    await router.replace('/calendario')
    return
  }

  const error = route.query.error_description || route.query.error
  if (typeof error === 'string' && error) {
    message.value = decodeURIComponent(error)
    return
  }

  const code = route.query.code
  if (typeof code === 'string' && code) {
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
