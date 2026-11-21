import { ref, type Ref } from 'vue'

/** A separator line inside a context menu. */
export interface ContextMenuSeparator {
  type: 'separator'
}

/** A clickable context-menu entry. */
export interface ContextMenuItem {
  type?: 'item'
  label: string
  /** Small right-aligned hint (e.g. an ISO date or shortcut). */
  hint?: string
  /** Red/danger styling (e.g. Delete, Sign out). */
  danger?: boolean
  /** Hidden entirely when true. */
  disabled?: boolean
  onSelect?: () => void
}

export type ContextMenuEntry = ContextMenuSeparator | ContextMenuItem

export interface ContextMenuState {
  x: number
  y: number
  items: ContextMenuEntry[]
}

/** Shared singleton state — one menu open at a time, app-wide. */
const menu: Ref<ContextMenuState | null> = ref(null)

function isSeparator(entry: ContextMenuEntry): entry is ContextMenuSeparator {
  return entry.type === 'separator'
}

/** Drop disabled items and trim/collapse separators. */
function normalize(items: ContextMenuEntry[]): ContextMenuEntry[] {
  const out: ContextMenuEntry[] = []
  for (const item of items) {
    if (isSeparator(item)) {
      if (out.length === 0 || isSeparator(out[out.length - 1]!)) continue
      out.push(item)
    } else {
      if (item.disabled) continue
      out.push(item)
    }
  }
  while (out.length > 0 && isSeparator(out[out.length - 1]!)) out.pop()
  return out
}

export function useContextMenu() {
  function open(x: number, y: number, items: ContextMenuEntry[]): void {
    const normalized = normalize(items)
    if (normalized.length === 0) {
      menu.value = null
      return
    }
    menu.value = { x, y, items: normalized }
  }

  function openFromEvent(e: { clientX: number; clientY: number }, items: ContextMenuEntry[]): void {
    open(e.clientX, e.clientY, items)
  }

  function close(): void {
    menu.value = null
  }

  return { menu, open, openFromEvent, close }
}
