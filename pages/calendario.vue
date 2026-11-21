<template>
  <AuthGate>
    <div class="flex min-h-0 flex-1 flex-col">
      <!-- Toolbar -->
      <header class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--eg-border)] px-3 py-2.5 sm:px-4 bg-black/60 backdrop-blur sticky top-0 z-20">
        <div class="flex items-center gap-2 shrink-0">
          <button
            class="eg-btn-ghost !px-2.5 !py-1.5 rounded-lg"
            aria-label="Previous month"
            :disabled="navDisabled(-1)"
            @click="shift(-1)"
          >
            ‹
          </button>
          <button
            class="eg-btn-ghost !px-2.5 !py-1.5 rounded-lg"
            aria-label="Next month"
            :disabled="navDisabled(1)"
            @click="shift(1)"
          >
            ›
          </button>
          <button class="eg-btn-ghost !px-2.5 !py-1.5 text-xs font-medium" @click="goToday">
            Today
          </button>
        </div>

        <h1 class="flex-1 text-center text-sm font-semibold text-white sm:text-base">
          {{ monthLabel(cursorYear, cursorMonth) }}
        </h1>

        <div class="flex items-center gap-2">
          <label class="text-[11px] text-zinc-500 shrink-0">View</label>
          <div class="inline-flex border border-[var(--eg-border)] rounded-lg bg-[var(--eg-panel-2)]">
            <button
              class="px-2.5 py-1 text-xs text-sm text-zinc-400 hover:text-white transition"
              :class="{ 'bg-white/20 text-white': view === 'month' }"
              @click="view = 'month'"
            >
              Month
            </button>
            <button
              class="px-2.5 py-1 text-xs text-sm text-zinc-400 hover:text-white transition"
              :class="{ 'bg-white/20 text-white': view === 'week' }"
              @click="view = 'week'"
            >
              Week
            </button>
          </div>

          <button
            class="eg-btn-primary !px-3 !py-1.5 text-xs shrink-0"
            :disabled="!isManager"
            @click="openEditor()"
          >
            + New post
          </button>

          <NuxtLink
            to="/newsletters"
            class="eg-btn-ghost !px-2.5 !py-1.5 text-xs shrink-0"
            :class="{ 'bg-white/10': $route.path.startsWith('/newsletters') }"
          >
            Newsletters
          </NuxtLink>

          <NuxtLink
            to="/site-updates"
            class="eg-btn-ghost !px-2.5 !py-1.5 text-xs shrink-0"
            :class="{ 'bg-white/10': $route.path.startsWith('/site-updates') }"
          >
            Site updates
          </NuxtLink>

          <button
            class="eg-btn-ghost !px-2.5 !py-1.5 text-xs shrink-0"
            :class="{ 'bg-white/10': panelMode === 'topics' }"
            @click="toggleTopics"
          >
            Topics
          </button>

          <button class="eg-btn-ghost !px-2.5 !py-1.5 text-xs shrink-0" @click="onSignOut">
            Sign out
          </button>
        </div>
      </header>

      <!-- Body -->
      <div class="flex flex-1 overflow-hidden relative">
        <div
          class="min-w-0 flex-1 overflow-y-auto p-3 sm:p-4"
          :class="{ 'px-6': isDesktop }"
        >
          <div
            v-if="loadError"
            class="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2"
          >
            <p class="text-sm text-red-300">Could not load the calendar: {{ loadError }}</p>
            <button class="eg-btn-ghost !px-2.5 !py-1 text-xs text-red-200" @click="loadAll(true)">
              Retry
            </button>
          </div>
          <div
            v-else-if="loading"
            class="mb-3 flex items-center gap-2 text-xs text-zinc-500"
            role="status"
          >
            <span
              class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--eg-accent)] border-t-transparent"
              aria-hidden="true"
            />
            Syncing calendar…
          </div>

          <CalendarMonth
            v-if="view === 'month'"
            :cursor="cursor"
            :selected="cursor"
            :items-by-day="itemsByDay"
            :topics="topics"
            @select="setCursor"
            @cursor="onChildCursor"
            @new-post="onNewPost"
            @edit-item="openItemEditor"
            @view-week="onViewWeek"
          />
          <CalendarWeek
            v-else
            :week="weekDays"
            :items-by-day="itemsByDay"
            :topics="topics"
            :selected="cursor"
            @select="setCursor"
            @edit-item="openItemEditor"
            @new-post="onNewPost"
            @view-month="onViewMonth"
          />
        </div>

        <!-- Desktop side panel -->
        <aside v-if="isDesktop" class="hidden lg:flex lg:w-[360px] shrink-0 flex-col border-l border-[var(--eg-border)]">
          <div class="flex-1 overflow-y-auto p-4">
            <TopicsPanel
              v-if="panelMode === 'topics'"
              :topics="topics"
              @save="saveTopic"
              @delete="deleteTopic"
              @reorder="reorderTopics"
              @set-attention="setAttention"
            />
            <DayPanel
              v-else
              :day="cursor"
              :items="dayItems"
              :topics="topics"
              @add="openEditor"
              @edit-item="openItemEditor"
              @delete="deletePost"
              @save="savePost"
            />
          </div>
          <div class="border-t border-[var(--eg-border)] p-3 text-center">
            <p class="text-[11px] text-zinc-500">
              {{ itemStats.total }} items · {{ itemStats.days }} days · v{{ version }}
            </p>
          </div>
        </aside>

        <!-- Mobile bottom sheet -->
        <div
          v-if="!isDesktop && showSheet"
          class="fixed inset-x-0 bottom-0 z-40 flex flex-col"
          @click.self="closeSheet"
        >
          <div class="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" />
          <div
            class="relative z-10 flex h-[55vh] flex-col bg-[var(--eg-panel)] border-t border-[var(--eg-border)] shadow-2xl"
          >
            <div class="flex items-center justify-between gap-2 px-4 py-3 border-b border-[var(--eg-border)]">
              <button
                class="eg-btn-ghost !px-2 !py-1.5 text-xs shrink-0"
                aria-label="Close"
                @click="closeSheet"
              >
                ✕
              </button>
              <h2 class="text-sm font-semibold text-white truncate flex-1">
                {{ dayLabel(cursor) }}
              </h2>
              <button
                class="eg-btn-primary !px-3 !py-1.5 text-xs shrink-0"
                :disabled="!isManager"
                @click="openEditor()"
              >
                + Add post
              </button>
            </div>
            <div class="flex-1 overflow-y-auto p-3">
              <DayPanel
                :day="cursor"
                :items="dayItems"
                :topics="topics"
                @add="openEditor"
                @edit-item="openItemEditor"
                @delete="deletePost"
                @save="savePost"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Post editor modal -->
      <PostEditor
        v-model:open="editorOpen"
        :post="editorPost"
        :topics="topics"
        :day="cursor"
        @save="savePost"
        @delete="deletePost"
        @cancel="editorOpen = false"
      />

      <!-- Newsletter editor modal -->
      <NewsletterEditor
        v-model:open="newsletterEditorOpen"
        :newsletter="editorNewsletter"
        @save="saveNewsletter"
        @delete="deleteNewsletter"
        @cancel="newsletterEditorOpen = false"
      />

      <!-- Site update editor modal -->
      <SiteUpdateEditor
        v-model:open="siteUpdateEditorOpen"
        :siteUpdate="editorSiteUpdate"
        @save="saveSiteUpdate"
        @delete="deleteSiteUpdate"
        @cancel="siteUpdateEditorOpen = false"
      />
    </div>
  </AuthGate>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useWindowSize } from '@vueuse/core'
import { parseIsoDay, todayIso, weekOf, monthLabel, dayLabel, daysInMonth } from '~/lib/calendar'
import type { CalendarItem, CalendarPost } from '~/lib/types'
import { makeCalendarItem } from '~/lib/types'

import AuthGate from '~/components/AuthGate.vue'
import CalendarMonth from '~/components/CalendarMonth.vue'
import CalendarWeek from '~/components/CalendarWeek.vue'
import DayPanel from '~/components/DayPanel.vue'
import TopicsPanel from '~/components/TopicsPanel.vue'
import PostEditor from '~/components/PostEditor.vue'
import NewsletterEditor from '~/components/NewsletterEditor.vue'
import SiteUpdateEditor from '~/components/SiteUpdateEditor.vue'

const { width } = useWindowSize()
const isDesktop = computed(() => width.value >= 1024)

const calendar = useCalendar()
const newsletters = useNewsletters()
const siteUpdates = useSiteUpdates()
const auth = useSupabaseAuth()
const toast = useToast()

const {
  topics,
  posts,
  settings,
  version,
  loadError: calendarLoadError,
  load: loadCalendar,
  save,
  deletePost,
  connectRealtime: connectCalendarRealtime,
  init: initCalendar,
} = calendar

const {
  newsletters: newslettersList,
  loading: nlLoading,
  loadError: nlLoadError,
  save: saveNewsletterStore,
  deleteNewsletter: deleteNewsletterStore,
  connectRealtime: connectNlRealtime,
  init: initNewsletters,
} = newsletters

const {
  siteUpdates: siteUpdatesList,
  loading: suLoading,
  loadError: suLoadError,
  save: saveSiteUpdateStore,
  deleteSiteUpdate: deleteSiteUpdateStore,
  connectRealtime: connectSuRealtime,
  init: initSiteUpdates,
} = siteUpdates

const { manager } = auth
const isManager = computed(() => auth.phase.value === 'manager')

// ---- cursor / view state ----
const cursor = ref(todayIso())
const view = ref<'month' | 'week'>('month')
const showSheet = ref(false)
const panelMode = ref<'day' | 'topics'>('day')

// editors
const editorOpen = ref(false)
const editorPost = ref<CalendarPost | null>(null)
const newsletterEditorOpen = ref(false)
const editorNewsletter = ref<import('~/lib/types').Newsletter | null>(null)
const siteUpdateEditorOpen = ref(false)
const editorSiteUpdate = ref<import('~/lib/types').SiteUpdate | null>(null)

const cursorYear = computed(() => parseIsoDay(cursor.value).year)
const cursorMonth = computed(() => parseIsoDay(cursor.value).month)

const weekDays = computed(() => weekOf(cursor.value))

const dayItems = computed(() => itemsByDay.value.get(cursor.value) || [])

const loading = computed(() => calendar.loading.value || nlLoading.value || suLoading.value)
const loadError = computed(() => calendarLoadError.value || nlLoadError.value || suLoadError.value)

/** Unified map: day -> CalendarItem[] (posts + newsletters + site updates). */
const itemsByDay = computed(() => {
  const map = new Map<string, CalendarItem[]>()
  const add = (item: CalendarItem) => {
    const list = map.get(item.day) || []
    list.push(item)
    map.set(item.day, list)
  }
  for (const p of posts.value) add(makeCalendarItem(p, 'post'))
  for (const n of newslettersList.value) {
    const day = n.scheduled_at ? String(n.scheduled_at).slice(0, 10) : String(n.created_at ?? '').slice(0, 10)
    add(makeCalendarItem({ ...n, day } as any, 'newsletter'))
  }
  for (const u of siteUpdatesList.value) {
    const day = u.published_at ? String(u.published_at).slice(0, 10) : String(u.created_at ?? '').slice(0, 10)
    add(makeCalendarItem({ ...u, day } as any, 'site_update'))
  }
  for (const list of map.values()) {
    list.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '') || a.title.localeCompare(b.title))
  }
  return map
})

const itemStats = computed(() => {
  const all = [...posts.value, ...newslettersList.value, ...siteUpdatesList.value]
  const days = new Set(all.map((x) => 'day' in x ? x.day : (x as any).scheduled_at ?? (x as any).published_at ?? x.created_at).map((d: any) => String(d).slice(0, 10))).size
  return { total: all.length, days }
})

function setCursor(day: string) {
  cursor.value = day
  if (!isDesktop.value) showSheet.value = true
}

function onChildCursor(iso: string) {
  cursor.value = iso
}

function onNewPost(day: string) {
  cursor.value = day
  openEditor()
}

function onViewWeek(day: string) {
  cursor.value = day
  view.value = 'week'
}

function onViewMonth(day: string) {
  cursor.value = day
  view.value = 'month'
}

/** Open the matching editor for a calendar item kind. */
function openItemEditor(item: CalendarItem) {
  if (item.kind === 'post') {
    editorPost.value = item.post
    editorOpen.value = true
    return
  }
  if (item.kind === 'newsletter') {
    editorNewsletter.value = item.newsletter
    newsletterEditorOpen.value = true
    return
  }
  editorSiteUpdate.value = item.site_update
  siteUpdateEditorOpen.value = true
}

async function onSignOut() {
  await auth.signOut()
  toast.info('Signed out.')
  await navigateTo('/login')
}

function closeSheet() {
  showSheet.value = false
}

function toggleTopics() {
  panelMode.value = 'topics'
  if (!isDesktop.value) showSheet.value = true
}

function shift(delta: number) {
  const p = parseIsoDay(cursor.value)
  let m = p.month + delta
  let y = p.year
  while (m < 1) { m += 12; y -= 1 }
  while (m > 12) { m -= 12; y += 1 }
  const d = Math.min(p.day, daysInMonth(y, m))
  cursor.value = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function goToday() {
  cursor.value = todayIso()
  if (!isDesktop.value) showSheet.value = true
}

function navDisabled(delta: number): boolean {
  const p = parseIsoDay(cursor.value)
  let m = p.month + delta
  let y = p.year
  while (m < 1) { m += 12; y -= 1 }
  while (m > 12) { m -= 12; y += 1 }
  const lo = new Date().getFullYear() - 2
  const hi = lo + 8
  return y < lo || y > hi
}

function openEditor(post?: CalendarPost) {
  editorPost.value = post ?? null
  editorOpen.value = true
}

async function savePost(draft: any) {
  try {
    await calendar.save({ action: 'upsert_post', post: draft })
    toast.success('Post saved.')
    editorOpen.value = false
  } catch (err: any) {
    toast.error(err?.message || 'Could not save post.')
  }
}

async function saveTopic(topic: any) {
  try {
    await calendar.save({ action: 'upsert_topic', topic })
    toast.success('Topic saved.')
  } catch (err: any) {
    toast.error(err?.message || 'Could not save topic.')
  }
}

async function deleteTopic(key: string) {
  try {
    await calendar.save({ action: 'delete_topic', key })
    toast.success('Topic deleted.')
  } catch (err: any) {
    toast.error(err?.message || 'Could not delete topic.')
  }
}

async function reorderTopics(items: any[]) {
  try {
    await calendar.save({ action: 'reorder_topics', items })
    toast.success('Topics reordered.')
  } catch (err: any) {
    toast.error(err?.message || 'Could not reorder topics.')
  }
}

async function setAttention(items: any[]) {
  try {
    await calendar.save({ action: 'set_attention', items })
    toast.success('Attention list updated.')
  } catch (err: any) {
    toast.error(err?.message || 'Could not update attention list.')
  }
}

async function saveNewsletter(draft: any) {
  try {
    await saveNewsletterStore({ action: 'upsert_newsletter', newsletter: draft })
    toast.success('Newsletter saved.')
    newsletterEditorOpen.value = false
  } catch (err: any) {
    toast.error(err?.message || 'Could not save newsletter.')
  }
}

async function deleteNewsletter(id: string) {
  try {
    await deleteNewsletterStore(id)
    toast.success('Newsletter deleted.')
  } catch (err: any) {
    toast.error(err?.message || 'Could not delete newsletter.')
  }
}

async function saveSiteUpdate(draft: any) {
  try {
    await saveSiteUpdateStore({ action: 'upsert_site_update', site_update: draft })
    toast.success('Site update saved.')
    siteUpdateEditorOpen.value = false
  } catch (err: any) {
    toast.error(err?.message || 'Could not save site update.')
  }
}

async function deleteSiteUpdate(id: string) {
  try {
    await deleteSiteUpdateStore(id)
    toast.success('Site update deleted.')
  } catch (err: any) {
    toast.error(err?.message || 'Could not delete site update.')
  }
}

async function loadAll(force = false) {
  await loadCalendar(force)
  await newsletters.load(force)
  await siteUpdates.load(force)
}

async function initApp() {
  await initCalendar()
  if (auth.isManager.value) {
    connectCalendarRealtime()
  }
  await initNewsletters()
  if (auth.isManager.value) {
    connectNlRealtime()
  }
  await initSiteUpdates()
  if (auth.isManager.value) {
    connectSuRealtime()
  }
}

onMounted(initApp)

watch(
  () => auth.phase.value,
  (phase) => {
    if (phase === 'manager') void initApp()
  },
)
</script>
