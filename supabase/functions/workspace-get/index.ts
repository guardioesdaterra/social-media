/**
 * supabase/functions/workspace-get/index.ts
 *
 * GET /functions/v1/workspace-get
 * Auth: Bearer <access_token>
 *
 * Returns all workspaces (with their email threads) visible to the manager.
 * Optional query params:
 *   ?item_kind=post&item_id=<uuid>  → filter to a specific calendar item
 *   ?workspace_id=<uuid>             → fetch a single workspace (full detail)
 */
import { handleCors, json, fail } from '../_shared/cors.ts'
import { requireManager, getAdminClient } from '../_shared/auth.ts'

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'GET') return fail('Method not allowed', 405, req)

  const { user, error } = await requireManager(req)
  if (error || !user) return fail(error || 'Forbidden', 403, req)

  const admin = getAdminClient()
  const url = new URL(req.url)
  const workspaceId = url.searchParams.get('workspace_id')
  const itemKind = url.searchParams.get('item_kind')
  const itemId = url.searchParams.get('item_id')

  try {
    if (workspaceId) {
      // ---- single workspace detail ----
      const { data: ws, error: wsErr } = await admin
        .from('workspaces')
        .select('*')
        .eq('id', workspaceId)
        .single()

      if (wsErr || !ws) return fail('Workspace not found', 404, req)

      const { data: threads } = await admin
        .from('email_threads')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true })

      const { data: comments } = await admin
        .from('commentaries')
        .select('*, commentary_tags(*)')
        .eq('target_id', workspaceId)
        .is('parent_id', null)
        .order('created_at', { ascending: true })

      return json({ ok: true, workspace: ws, threads: threads ?? [], comments: comments ?? [] }, 200, req)
    }

    // ---- list workspaces ----
    let query = admin
      .from('workspaces')
      .select('*, email_threads(id, subject, status, created_at, thread_type)')
      .eq('status', 'active')
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false })

    if (itemKind && itemId) {
      query = query.eq('item_kind', itemKind).eq('item_id', itemId)
    }

    const { data: workspaces, error: listErr } = await query
    if (listErr) throw listErr

    return json({ ok: true, workspaces: workspaces ?? [], server_time: new Date().toISOString() }, 200, req)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load workspaces'
    console.error('[workspace-get]', message)
    return fail(message, 500, req)
  }
})
