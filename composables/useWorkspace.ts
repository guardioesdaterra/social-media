/**
 * composables/useWorkspace.ts
 *
 * Manages workspaces and their email threads.
 * Each workspace is a collaboration container linked to a calendar item.
 */
import { ref, shallowRef, computed } from 'vue'
import { edgeFunctionUrl } from '~/lib/supabase'
import { useSupabaseAuth } from '~/composables/useSupabaseAuth'

export interface Workspace {
  id: string
  title: string
  description: string
  item_kind: 'post' | 'newsletter' | 'site_update' | null
  item_id: string | null
  status: 'active' | 'archived'
  pinned: boolean
  created_by: string
  created_at: string
  updated_at: string
  updated_by: string | null
  email_threads?: EmailThreadSummary[]
}

export interface EmailThreadSummary {
  id: string
  subject: string
  status: string
  created_at: string
  thread_type: 'initiator' | 'attached'
}

export interface EmailThread {
  id: string
  workspace_id: string
  parent_id: string | null
  thread_type: 'initiator' | 'attached'
  subject: string
  body: string
  from_address: string
  to_addresses: string
  cc_addresses: string
  external_message_id: string | null
  sent_at: string | null
  status: 'draft' | 'sent' | 'received' | 'archived'
  created_by: string
  created_at: string
  updated_at: string
}

export interface WorkspaceDraft {
  id?: string
  title: string
  description?: string
  item_kind?: string | null
  item_id?: string | null
  status?: 'active' | 'archived'
  pinned?: boolean
}

export interface ThreadDraft {
  id?: string
  workspace_id: string
  parent_id?: string | null
  thread_type?: 'initiator' | 'attached'
  subject: string
  body: string
  to_addresses?: string
  cc_addresses?: string
  external_message_id?: string | null
  sent_at?: string | null
  status?: 'draft' | 'sent' | 'received' | 'archived'
}

// ---- module-level shared state ----
const workspaces = shallowRef<Workspace[]>([])
const loading = ref(false)
const saving = ref(false)
const loadError = ref<string | null>(null)
const saveError = ref<string | null>(null)

export function useWorkspace() {
  const { session } = useSupabaseAuth()

  function authHeaders(): HeadersInit {
    const token = session.value?.access_token
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token ?? ''}`,
      Origin: import.meta.client ? window.location.origin : '',
    }
  }

  async function load(itemKind?: string, itemId?: string) {
    loading.value = true
    loadError.value = null
    try {
      let url = edgeFunctionUrl('workspace-get')
      if (itemKind && itemId) url += `?item_kind=${encodeURIComponent(itemKind)}&item_id=${encodeURIComponent(itemId)}`

      const res = await fetch(url, { method: 'GET', headers: authHeaders() })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Failed to load workspaces')
      workspaces.value = data.workspaces
    } catch (err) {
      loadError.value = err instanceof Error ? err.message : 'Unknown error'
    } finally {
      loading.value = false
    }
  }

  async function loadOne(id: string): Promise<{ workspace: Workspace; threads: EmailThread[]; comments: unknown[] } | null> {
    try {
      const url = edgeFunctionUrl(`workspace-get?workspace_id=${encodeURIComponent(id)}`)
      const res = await fetch(url, { method: 'GET', headers: authHeaders() })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Failed to load workspace')
      return { workspace: data.workspace, threads: data.threads, comments: data.comments }
    } catch (err) {
      loadError.value = err instanceof Error ? err.message : 'Unknown error'
      return null
    }
  }

  async function saveWorkspace(draft: WorkspaceDraft): Promise<Workspace | null> {
    saving.value = true
    saveError.value = null
    try {
      const res = await fetch(edgeFunctionUrl('workspace-save'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ action: 'upsert_workspace', workspace: draft }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Save failed')
      const ws: Workspace = data.workspace
      workspaces.value = draft.id
        ? workspaces.value.map((w) => (w.id === ws.id ? ws : w))
        : [ws, ...workspaces.value]
      return ws
    } catch (err) {
      saveError.value = err instanceof Error ? err.message : 'Save failed'
      return null
    } finally {
      saving.value = false
    }
  }

  async function archiveWorkspace(id: string): Promise<boolean> {
    saving.value = true
    try {
      const res = await fetch(edgeFunctionUrl('workspace-save'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ action: 'delete_workspace', id }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Archive failed')
      workspaces.value = workspaces.value.filter((w) => w.id !== id)
      return true
    } catch (err) {
      saveError.value = err instanceof Error ? err.message : 'Archive failed'
      return false
    } finally {
      saving.value = false
    }
  }

  async function pinWorkspace(id: string, pinned: boolean): Promise<boolean> {
    try {
      const res = await fetch(edgeFunctionUrl('workspace-save'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ action: 'pin_workspace', id, pinned }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Pin failed')
      workspaces.value = workspaces.value.map((w) =>
        w.id === id ? { ...w, pinned } : w,
      )
      return true
    } catch (err) {
      saveError.value = err instanceof Error ? err.message : 'Pin failed'
      return false
    }
  }

  async function saveThread(draft: ThreadDraft): Promise<EmailThread | null> {
    saving.value = true
    saveError.value = null
    try {
      const res = await fetch(edgeFunctionUrl('workspace-save'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ action: 'upsert_thread', thread: draft }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Thread save failed')
      return data.thread as EmailThread
    } catch (err) {
      saveError.value = err instanceof Error ? err.message : 'Thread save failed'
      return null
    } finally {
      saving.value = false
    }
  }

  async function deleteThread(id: string): Promise<boolean> {
    try {
      const res = await fetch(edgeFunctionUrl('workspace-save'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ action: 'delete_thread', id }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Delete failed')
      return true
    } catch (err) {
      saveError.value = err instanceof Error ? err.message : 'Delete failed'
      return false
    }
  }

  const activeWorkspaces = computed(() => workspaces.value.filter((w) => w.status === 'active'))
  const pinnedWorkspaces = computed(() => workspaces.value.filter((w) => w.pinned && w.status === 'active'))

  return {
    workspaces,
    activeWorkspaces,
    pinnedWorkspaces,
    loading,
    saving,
    loadError,
    saveError,
    load,
    loadOne,
    saveWorkspace,
    archiveWorkspace,
    pinWorkspace,
    saveThread,
    deleteThread,
  }
}
