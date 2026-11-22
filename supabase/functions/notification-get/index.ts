/**
 * supabase/functions/notification-get/index.ts
 *
 * GET /functions/v1/notification-get
 * Auth: Bearer <access_token>
 *
 * Returns notifications for the authenticated user.
 * Query params:
 *   ?unread_only=1   – only unread notifications
 *   ?limit=50        – max rows (default 50, max 200)
 *
 * POST with { action: 'mark_read', ids: string[] }  – mark as read
 * POST with { action: 'mark_all_read' }              – mark all as read
 */
import { handleCors, json, fail, readJsonBody } from '../_shared/cors.ts'
import { requireManager, getAdminClient } from '../_shared/auth.ts'

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req)
  if (cors) return cors

  const { user, error } = await requireManager(req)
  if (error || !user) return fail(error || 'Forbidden', 403, req)

  const admin = getAdminClient()

  // ---- GET: fetch notifications ----
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const unreadOnly = url.searchParams.get('unread_only') === '1'
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') ?? '50', 10)))

    try {
      let query = admin
        .from('notifications')
        .select('*')
        .eq('recipient_email', user.email)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (unreadOnly) query = query.is('read_at', null)

      const { data, error: dbErr } = await query
      if (dbErr) throw dbErr

      const unreadCount = (data ?? []).filter((n: { read_at: string | null }) => !n.read_at).length

      return json({
        ok: true,
        notifications: data ?? [],
        unread_count: unreadCount,
        server_time: new Date().toISOString(),
      }, 200, req)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load notifications'
      console.error('[notification-get]', message)
      return fail(message, 500, req)
    }
  }

  // ---- POST: mark read ----
  if (req.method === 'POST') {
    const body = await readJsonBody(req)
    if (!body) return fail('Invalid JSON body', 400, req)

    const now = new Date().toISOString()

    try {
      if (body.action === 'mark_read') {
        const ids = Array.isArray(body.ids) ? (body.ids as string[]) : []
        if (ids.length === 0) return fail('ids array is required', 400, req)

        const { error: updateErr } = await admin
          .from('notifications')
          .update({ read_at: now })
          .in('id', ids)
          .eq('recipient_email', user.email)
          .is('read_at', null)

        if (updateErr) throw updateErr
        return json({ ok: true, marked: ids.length }, 200, req)
      }

      if (body.action === 'mark_all_read') {
        const { error: updateErr } = await admin
          .from('notifications')
          .update({ read_at: now })
          .eq('recipient_email', user.email)
          .is('read_at', null)

        if (updateErr) throw updateErr
        return json({ ok: true }, 200, req)
      }

      return fail(`Unknown action: ${body.action}`, 400, req)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update notifications'
      console.error('[notification-get]', message)
      return fail(message, 500, req)
    }
  }

  return fail('Method not allowed', 405, req)
})
