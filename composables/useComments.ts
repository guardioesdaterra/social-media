/**
 * composables/useComments.ts
 *
 * Global commentary system.
 * Any UI element can be annotated with (target_type, target_id, target_path).
 *
 * @mentions in the body (format: @email@domain.com) automatically:
 *   – insert commentary_tags rows
 *   – create in-app notifications
 *   – trigger the tag-notify edge function to send emails
 */
import { ref, shallowRef, computed } from 'vue'
import { edgeFunctionUrl } from '~/lib/supabase'
import { useSupabaseAuth } from '~/composables/useSupabaseAuth'
import { useSupabase } from '~/lib/supabase'

export interface Commentary {
  id: string
  target_type: string
  target_id: string | null
  target_path: string
  parent_id: string | null
  body: string
  author_email: string
  author_name: string
  resolved: boolean
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
  commentary_tags?: CommentaryTag[]
  replies?: Commentary[]
}

export interface CommentaryTag {
  id: string
  commentary_id: string
  tagged_email: string
  notified_at: string | null
  created_at: string
}

export interface CommentTarget {
  type: string         // 'post' | 'newsletter' | 'site_update' | 'workspace' | 'image' | 'general'
  id?: string | null   // UUID of the target row
  path?: string        // sub-path label, e.g. 'image', 'caption', 'subject'
  label?: string       // human label shown in the drawer header
}

// ---- module-level state ----
// All comments loaded for the currently viewed target.
const comments = shallowRef<Commentary[]>([])
const loading = ref(false)
const saving = ref(false)
const loadError = ref<string | null>(null)
const saveError = ref<string | null>(null)

// The target that is currently "open" in the CommentaryDrawer.
const activeTarget = ref<CommentTarget | null>(null)
const drawerOpen = ref(false)

export function useComments() {
  const { session, manager } = useSupabaseAuth()
  const supabase = useSupabase()

  function authHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.value?.access_token ?? ''}`,
      Origin: import.meta.client ? window.location.origin : '',
    }
  }

  // ---- drawer control ----
  function openDrawer(target: CommentTarget) {
    activeTarget.value = target
    drawerOpen.value = true
    void loadComments(target)
  }

  function closeDrawer() {
    drawerOpen.value = false
    // Keep activeTarget so the user can re-open without a flicker.
  }

  // ---- load ----
  async function loadComments(target: CommentTarget) {
    loading.value = true
    loadError.value = null
    try {
      let query = supabase
        .from('commentaries')
        .select('*, commentary_tags(*)')
        .eq('target_type', target.type)
        .is('parent_id', null)
        .order('created_at', { ascending: true })

      if (target.id) query = query.eq('target_id', target.id)
      else query = query.is('target_id', null)

      if (target.path) query = query.eq('target_path', target.path)

      const { data, error } = await query
      if (error) throw error

      // Attach replies
      const roots = (data ?? []) as Commentary[]
      const { data: replyData } = await supabase
        .from('commentaries')
        .select('*, commentary_tags(*)')
        .in('parent_id', roots.map((c) => c.id))
        .order('created_at', { ascending: true })

      const repliesMap: Record<string, Commentary[]> = {}
      for (const r of (replyData ?? []) as Commentary[]) {
        if (r.parent_id) {
          if (!repliesMap[r.parent_id]) repliesMap[r.parent_id] = []
          repliesMap[r.parent_id]!.push(r)
        }
      }

      comments.value = roots.map((c) => ({ ...c, replies: repliesMap[c.id] ?? [] }))
    } catch (err) {
      loadError.value = err instanceof Error ? err.message : 'Failed to load comments'
    } finally {
      loading.value = false
    }
  }

  // ---- add ----
  async function addComment(opts: {
    body: string
    target: CommentTarget
    parentId?: string | null
  }): Promise<Commentary | null> {
    saving.value = true
    saveError.value = null
    try {
      const res = await fetch(edgeFunctionUrl('comment-save'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          action: 'add_comment',
          body: opts.body,
          target_type: opts.target.type,
          target_id: opts.target.id ?? null,
          target_path: opts.target.path ?? '',
          parent_id: opts.parentId ?? null,
          author_name: manager.value?.name ?? manager.value?.email ?? '',
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Failed to save comment')

      // Reload full tree for this target
      if (activeTarget.value) await loadComments(activeTarget.value)
      return data.comment as Commentary
    } catch (err) {
      saveError.value = err instanceof Error ? err.message : 'Save failed'
      return null
    } finally {
      saving.value = false
    }
  }

  // ---- resolve ----
  async function resolveComment(id: string, resolved: boolean): Promise<boolean> {
    saving.value = true
    try {
      const res = await fetch(edgeFunctionUrl('comment-save'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ action: 'resolve_comment', id, resolved }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Failed to resolve')
      if (activeTarget.value) await loadComments(activeTarget.value)
      return true
    } catch (err) {
      saveError.value = err instanceof Error ? err.message : 'Resolve failed'
      return false
    } finally {
      saving.value = false
    }
  }

  // ---- delete ----
  async function deleteComment(id: string): Promise<boolean> {
    saving.value = true
    try {
      const res = await fetch(edgeFunctionUrl('comment-save'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ action: 'delete_comment', id }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Failed to delete')
      if (activeTarget.value) await loadComments(activeTarget.value)
      return true
    } catch (err) {
      saveError.value = err instanceof Error ? err.message : 'Delete failed'
      return false
    } finally {
      saving.value = false
    }
  }

  // ---- realtime subscription ----
  let realtimeChannel: ReturnType<typeof supabase.channel> | null = null

  function subscribeRealtime(target: CommentTarget) {
    unsubscribeRealtime()
    const filter = target.id
      ? `target_type=eq.${target.type},target_id=eq.${target.id}`
      : `target_type=eq.${target.type}`
    realtimeChannel = supabase
      .channel(`comments:${target.type}:${target.id ?? 'general'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commentaries', filter }, () => {
        if (activeTarget.value) void loadComments(activeTarget.value)
      })
      .subscribe()
  }

  function unsubscribeRealtime() {
    if (realtimeChannel) {
      void supabase.removeChannel(realtimeChannel)
      realtimeChannel = null
    }
  }

  const threadedComments = computed(() => comments.value.filter((c) => !c.parent_id))
  const unresolvedCount = computed(() => comments.value.filter((c) => !c.resolved && !c.parent_id).length)

  return {
    comments,
    threadedComments,
    unresolvedCount,
    loading,
    saving,
    loadError,
    saveError,
    activeTarget,
    drawerOpen,
    openDrawer,
    closeDrawer,
    loadComments,
    addComment,
    resolveComment,
    deleteComment,
    subscribeRealtime,
    unsubscribeRealtime,
  }
}
