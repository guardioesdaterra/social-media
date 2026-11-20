<template>
  <div class="mx-auto flex max-w-md flex-col items-center py-16 text-center">
    <span
      class="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--eg-accent)] text-lg font-black text-black"
      aria-hidden="true"
    >EG</span>
    <h1 class="mt-5 text-2xl font-semibold text-white">Social Media</h1>
    <p class="mt-1.5 text-sm text-zinc-400">Editorial calendar for @earthguardians</p>

    <div class="eg-card mt-8 w-full p-6 text-left">
      <p class="text-sm text-zinc-300">
        Sign in with your Earth Guardians account to open the calendar.
      </p>
      <p class="mt-1 text-xs text-zinc-500">
        Access is limited to <span class="text-zinc-300">{{ MANAGER_DOMAIN }}</span> addresses.
      </p>

      <button
        class="eg-btn-primary mt-5 w-full !py-2.5"
        :disabled="busy"
        @click="onSignIn"
      >
        <svg viewBox="0 0 24 24" class="h-4 w-4" aria-hidden="true">
          <path
            fill="currentColor"
            d="M21.35 11.1h-9.17v2.98h5.27c-.23 1.4-1.63 4.12-5.27 4.12-3.17 0-5.76-2.62-5.76-5.85s2.59-5.85 5.76-5.85c1.8 0 3.01.77 3.7 1.43l2.52-2.43C16.79 3.9 14.68 3 12.18 3 7.03 3 2.86 7.17 2.86 12.35S7.03 21.7 12.18 21.7c5.3 0 8.8-3.72 8.8-8.96 0-.6-.07-1.06-.16-1.52z"
          />
        </svg>
        Continue with Google
      </button>

      <p v-if="authError" class="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
        {{ authError }}
      </p>
      <p v-if="status" class="mt-4 text-xs text-zinc-500">{{ status }}</p>
    </div>

    <NuxtLink to="/" class="mt-6 text-xs text-zinc-600 hover:text-zinc-400">← Back</NuxtLink>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { MANAGER_DOMAIN } from '~/lib/constants'
import { useSupabaseAuth } from '~/composables/useSupabaseAuth'
const { authError, signInWithGoogle, bootstrap, phase } = useSupabaseAuth()
const router = useRouter()

const busy = ref(false)
const status = ref('')

onMounted(async () => {
  await bootstrap()
  if (phase.value === 'manager') await router.replace('/calendario')
})

async function onSignIn() {
  busy.value = true
  status.value = 'Redirecting to Google…'
  try {
    const err = await signInWithGoogle()
    if (err) status.value = ''
    // Navigation happens via OAuth redirect.
  } finally {
    busy.value = false
  }
}
</script>
