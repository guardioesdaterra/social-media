<template>
  <!-- Invisible backdrop: catches outside clicks, scroll, wheel and stray right-clicks -->
  <div
    v-if="menu"
    class="fixed inset-0 z-[100]"
    @contextmenu.prevent="close"
    @pointerdown.capture="onOutsidePointer"
    @wheel.capture="close"
    @touchstart.capture="close"
    @keydown="onKeydown"
  >
    <div
      ref="el"
      role="menu"
      tabindex="-1"
      class="fixed min-w-[220px] max-w-[min(300px,calc(100vw-16px))] rounded-xl border border-[var(--eg-border)] bg-[var(--eg-panel)]/95 py-1 shadow-2xl shadow-black/60 backdrop-blur-md outline-none"
      :style="{ left: pos.x + 'px', top: pos.y + 'px' }"
      :aria-label="menuLabel"
    >
      <template v-for="(item, i) in menu.items" :key="i">
        <div v-if="isSeparator(item)" class="my-1 h-px bg-white/10" role="separator" />
        <button
          v-else
          type="button"
          role="menuitem"
          class="flex w-full items-center justify-between gap-6 px-3 py-1.5 text-left text-sm transition hover:bg-white/10 focus:bg-white/10 focus:outline-none"
          :class="item.danger ? 'text-red-400 hover:text-red-300' : 'text-zinc-200'"
          @click="run(item)"
        >
          <span class="truncate">{{ item.label }}</span>
          <span v-if="item.hint" class="shrink-0 text-[10px] text-zinc-500">{{ item.hint }}</span>
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { ContextMenuItem, ContextMenuSeparator } from '~/composables/useContextMenu'
import { useContextMenu } from '~/composables/useContextMenu'

const { menu, close } = useContextMenu()

const el = ref<HTMLElement | null>(null)
const pos = ref({ x: 0, y: 0 })

const menuLabel = computed(() => 'Context menu')

let lastFocused: HTMLElement | null = null

function isSeparator(item: unknown): item is ContextMenuSeparator {
  return (item as ContextMenuSeparator)?.type === 'separator'
}

function menuButtons(): HTMLButtonElement[] {
  if (!el.value) return []
  return Array.from(el.value.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
}

function run(item: ContextMenuItem) {
  const action = item.onSelect
  close()
  action?.()
}

function onOutsidePointer(e: PointerEvent) {
  if (el.value?.contains(e.target as Node)) return
  close()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    close()
    return
  }
  const btns = menuButtons()
  if (btns.length === 0) return
  const idx = btns.indexOf(document.activeElement as HTMLButtonElement)
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    btns[(idx + 1 + btns.length) % btns.length]!.focus()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    btns[(idx - 1 + btns.length) % btns.length]!.focus()
  } else if (e.key === 'Home') {
    e.preventDefault()
    btns[0]!.focus()
  } else if (e.key === 'End') {
    e.preventDefault()
    btns[btns.length - 1]!.focus()
  } else if (e.key === 'Tab') {
    close()
  }
}

/** Clamp the menu inside the viewport (flip up / left near the edges). */
function place(x: number, y: number) {
  const node = el.value
  if (!node) return
  const r = node.getBoundingClientRect()
  const pad = 8
  let nx = x
  let ny = y
  if (nx + r.width > window.innerWidth - pad) nx = Math.max(pad, window.innerWidth - r.width - pad)
  if (ny + r.height > window.innerHeight - pad) ny = y - r.height
  if (ny < pad) ny = pad
  if (nx < pad) nx = pad
  pos.value = { x: nx, y: ny }
}

watch(
  menu,
  (m) => {
    if (m) {
      lastFocused = document.activeElement as HTMLElement | null
      pos.value = { x: m.x, y: m.y }
      void nextTick(() => {
        place(m.x, m.y)
        menuButtons()[0]?.focus()
      })
      return
    }
    // Restore focus to the element that opened the menu (keyboard users).
    const active = document.activeElement
    const menuStillMounted = el.value?.contains(active)
    if (lastFocused?.isConnected && (!active || active === document.body || menuStillMounted)) {
      lastFocused.focus()
    }
    lastFocused = null
  },
  { flush: 'post' },
)
</script>
