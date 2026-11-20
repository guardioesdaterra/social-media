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
const { exchangeCode, bootstrap, isManager, phase } = useSupabaseAuth()
const router = useRouter()
const route = useRoute()

const message = ref('')
const ok = ref(false)

onMounted(async () => {
  await bootstrap()

  if (isManager.value) {
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
