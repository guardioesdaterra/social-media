<template>
  <header
    class="sticky top-0 z-50 border-b border-[var(--eg-border)] bg-black/80 backdrop-blur-xl"
  >
    <div class="mx-auto flex h-14 max-w-[1680px] items-center gap-3 px-3 sm:px-5">
      <NuxtLink to="/calendario" class="flex items-center gap-2.5 shrink-0" aria-label="Home">
        <span
          class="grid h-8 w-8 place-items-center rounded-lg bg-[var(--eg-accent)] text-sm font-black text-black"
          aria-hidden="true"
        >EG</span>
        <span class="hidden leading-tight sm:block">
          <span class="block text-sm font-semibold text-white">Social Media</span>
          <span class="block text-[11px] text-zinc-500">Editorial calendar · @earthguardians</span>
        </span>
      </NuxtLink>

      <nav class="ml-2 flex items-center gap-1" aria-label="Primary">
        <NuxtLink
          to="/calendario"
          class="rounded-lg px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
          :class="{ 'bg-white/10 text-white': $route.path.startsWith('/calendario') }"
        >
          Calendar
        </NuxtLink>
      </nav>

      <div class="flex-1" />

      <SyncStatus v-if="isManager" />

      <div v-if="isManager && manager" class="flex items-center gap-2">
        <img
          v-if="manager.avatar"
          :src="manager.avatar"
          alt=""
          class="h-7 w-7 rounded-full border border-[var(--eg-border)] object-cover"
        />
        <span
          class="hidden max-w-[190px] truncate text-xs text-zinc-400 md:inline"
          :title="manager.email"
        >
          {{ manager.email }}
        </span>
        <button class="eg-btn-ghost !px-3 !py-1.5 text-xs" @click="onSignOut">Sign out</button>
      </div>

      <NuxtLink v-else-if="phase === 'anonymous' || phase === 'denied'" to="/login" class="eg-btn-primary !py-1.5 text-xs">
        Sign in
      </NuxtLink>
    </div>
  </header>
</template>

<script setup lang="ts">
const { phase, manager, isManager, signOut } = useSupabaseAuth()
const router = useRouter()
const toast = useToast()

async function onSignOut() {
  await signOut()
  toast.info('Signed out.')
  await router.push('/login')
}
</script>
