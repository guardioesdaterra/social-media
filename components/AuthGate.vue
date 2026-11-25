<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <!-- Manager → render the calendar app -->
    <slot v-if="phase === 'manager'" />

    <!-- Signed out → login screen -->
    <LoginScreen v-else-if="phase === 'anonymous'" />

    <!-- Signed in but not @earthguardians.org → denied -->
    <div v-else-if="phase === 'denied'" class="mx-auto max-w-lg py-16">
      <div class="eg-card p-7 text-center">
        <div class="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-red-500/15 text-xl text-red-300" aria-hidden="true">
          !
        </div>
        <h1 class="text-lg font-semibold text-white">Access restricted</h1>
        <p class="mt-2 text-sm text-zinc-400">
          {{ authError || `This panel is only available for ${MANAGER_DOMAIN} accounts.` }}
        </p>
        <p v-if="managerEmail" class="mt-1 text-xs text-zinc-500">Signed in as {{ managerEmail }}</p>
        <div class="mt-6 flex flex-wrap justify-center gap-2">
          <button class="eg-btn-ghost" @click="switchAccount">Use another account</button>
          <button class="eg-btn-primary" @click="onSignOut">Sign out</button>
        </div>
      </div>
    </div>

    <!-- Boot / checking → static shell (no hydration mismatch) -->
    <div v-else class="grid min-h-[52vh] place-items-center">
      <div class="flex flex-col items-center gap-3 text-center">
        <span class="h-8 w-8 animate-spin rounded-full border-2 border-[var(--eg-accent)] border-t-transparent" />
        <p class="text-sm text-zinc-400">
          {{ phase === 'boot' ? 'Starting…' : 'Verifying your access…' }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { MANAGER_DOMAIN } from '~/lib/constants'

const { phase, authError, signOut, signInWithGoogle, session } = useSupabaseAuth()
const router = useRouter()
const toast = useToast()

const managerEmail = computed(() => session.value?.user?.email || '')

// Detect if we're embedded
const isEmbedded = computed(() => {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
})

onMounted(async () => {
  const { bootstrap } = useSupabaseAuth()
  await bootstrap()
})

async function onSignOut() {
  await signOut()
  toast.info('Signed out.')
}

async function switchAccount() {
  await signOut()
  
  if (isEmbedded) {
    // In embedded mode, use popup
    const { signInWithPopup } = usePopupAuth()
    const result = await signInWithPopup()
    if (result.success) {
      toast.success('Authentication successful!')
      await router.push('/login')
    } else {
      toast.error(result.error || 'Authentication failed')
    }
  } else {
    // In direct access, use redirect
    const err = await signInWithGoogle()
    if (err) toast.error(err)
    else await router.push('/login')
  }
}
</script>
