<template>
  <header
    class="sticky top-0 z-50 border-b border-[var(--eg-border)] bg-black/80 backdrop-blur-xl"
    @contextmenu.prevent="onHeaderContext"
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
import type { ContextMenuEntry } from '~/composables/useContextMenu'

const { phase, manager, isManager, signOut } = useSupabaseAuth()
const { now, timezone, isUtc, formatted, tzLabel, setTimezone } = useAppClock()
const router = useRouter()
const route = useRoute()
const toast = useToast()
const ctx = useContextMenu()
const { copyText } = useCopyText()

/** Timezone options offered in the header context menu. */
const TIMEZONES: string[] = ['UTC', 'America/Sao_Paulo', 'America/London', 'America/New_York', 'Asia/Tokyo', 'Australia/Sydney']

async function onSignOut() {
  await signOut()
  toast.info('Signed out.')
  await router.push('/login')
}

/** Right-click on the header → app-wide shortcuts. */
function onHeaderContext(e: MouseEvent) {
  const items: ContextMenuEntry[] = [
    { label: 'Open calendar', hint: '/calendario', onSelect: () => void router.push('/calendario') },
    { label: 'Newsletters', hint: '/newsletters', onSelect: () => void router.push('/newsletters') },
    { label: 'Site updates', hint: '/site-updates', onSelect: () => void router.push('/site-updates') },
    { type: 'separator' },
    { label: 'Copy page URL', onSelect: () => void copyText(window.location.href, 'URL copied.') },
    { type: 'separator' },
    { label: 'Clock / Timezone', hint: tzLabel.value, disabled: true },
  ]

  for (const tz of TIMEZONES) {
    items.push({
      label: tz,
      hint: tz === 'UTC' ? 'Coordinated Universal Time' : '',
      disabled: tz === timezone.value,
      onSelect: () => setTimezone(tz),
    })
  }

  items.push({ type: 'separator' })

  if (isManager.value) {
    items.push({ label: 'Refresh data', hint: 'Supabase', onSelect: refreshData })
    items.push({ type: 'separator' }, { label: 'Sign out', danger: true, onSelect: onSignOut })
  } else {
    items.push({ type: 'separator' }, { label: 'Sign in', onSelect: () => void router.push('/login') })
  }

  ctx.openFromEvent(e, items)
}

/** Reloads the snapshot of whatever page is open. */
async function refreshData() {
  try {
    if (route.path.startsWith('/newsletters')) {
      const store = useNewsletters()
      await store.load(true)
      if (!store.loadError.value) toast.success('Newsletters refreshed.')
    } else if (route.path.startsWith('/site-updates')) {
      const store = useSiteUpdates()
      await store.load(true)
      if (!store.loadError.value) toast.success('Site updates refreshed.')
    } else {
      const store = useCalendar()
      await store.load(true)
      if (!store.loadError.value) toast.success('Calendar refreshed.')
    }
  } catch (err: any) {
    toast.error(err?.message || 'Could not refresh the data.')
  }
}
</script>
