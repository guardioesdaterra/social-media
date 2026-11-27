/**
 * composables/useHistory.ts
 * @why Atomic command history for undo/redo across any UI action
 * (button clicks, text field fills, post approvals, ...).
 *
 * Every action is a Command with `execute()`, `undo()` and `redo()`. A linear
 * stack keeps executed commands so the user can step back and forward without
 * breaking the rest of the application state. New commits after an undo drop
 * the forward history (classic linear undo/redo).
 */

import { ref, computed, readonly } from 'vue'

export interface HistoryCommand {
  id: string
  label: string
  execute: () => void
  undo: () => void
  redo: () => void
}

interface HistoryState {
  stack: HistoryCommand[]
  index: number
  maxSize: number
}

const state = ref<HistoryState>({ stack: [], index: -1, maxSize: 200 })

const canUndo = computed(() => state.value.index >= 0)
const canRedo = computed(() => state.value.index < state.value.stack.length - 1)
const current = computed(() => state.value.stack[state.value.index] ?? null)

function run(command: HistoryCommand) {
  command.execute()
  // Drop anything ahead of the current pointer (classic linear history).
  state.value.stack = state.value.stack.slice(0, state.value.index + 1)
  state.value.stack.push(command)
  state.value.index += 1
  if (state.value.stack.length > state.value.maxSize) {
    state.value.stack.shift()
    state.value.index = state.value.maxSize - 1
  }
}

function undo() {
  if (!canUndo.value) return
  const command = state.value.stack[state.value.index]
  if (!command) return
  command.undo()
  state.value.index -= 1
}

function redo() {
  if (!canRedo.value) return
  state.value.index += 1
  const command = state.value.stack[state.value.index]
  if (!command) return
  command.redo()
}

export function useHistory() {
  return {
    state: readonly(state),
    canUndo,
    canRedo,
    current,
    run,
    undo,
    redo,
    clear: () => {
      state.value = { stack: [], index: -1, maxSize: state.value.maxSize }
    },
  }
}
