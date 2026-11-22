/**
 * supabase/functions/workspace-save/index.ts
 *
 * POST /functions/v1/workspace-save
 * Auth: Bearer <access_token>
 *
 * Actions:
 *   upsert_workspace   – create or update a workspace
 *   delete_workspace   – archive (soft-delete) a workspace
 *   pin_workspace      – toggle pinned flag
 *   upsert_thread      – create or update an email thread
 *   delete_thread      – remove an email thread row
 */
import { handleCors, json, fail, readJsonBody } from '../_shared/cors.ts'
import { requireManager, getAdminClient, sanitizeText, capText } from '../_shared/auth.ts'
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

interface AuthedUser { id: string; email: string }

function httpError(message: string, status = 400): never {
  const e = new Error(message) as Error & { status?: number }
  e.status = status
  throw e
}

// ---------------------------------------------------------------- dispatch --
async function dispatch(
  admin: SupabaseClient,
  user: AuthedUser,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const action = String(body.action ?? '')
  const now = new Date().toISOString()

  switch (action) {
    case 'upsert_workspace': {
      const raw = body.workspace as Record<string, unknown> | null
      if (!raw) httpError('Missing workspace payload')

      const id: string | undefined = raw.id ? String(raw.id) : undefined
      const title = sanitizeText(raw.title, 300)
      if (!title) httpError('title is required')

      const row = {
        title,
        description: capText(raw.description, 2000),
        item_kind: raw.item_kind ?? null,
        item_id: raw.item_id ?? null,
        status: (raw.status as string) === 'archived' ? 'archived' : 'active',
        pinned: Boolean(raw.pinned),
        updated_at: now,
        updated_by: user.email,
        ...(id ? {} : { created_by: user.email }),
      }

      const { data, error } = id
        ? await admin.from('workspaces').update(row).eq('id', id).select().single()
        : await admin.from('workspaces').insert({ ...row, created_by: user.email }).select().single()

      if (error) httpError(error.message)
      return { workspace: data }
    }

    case 'delete_workspace': {
      const id = String(body.id ?? '')
      if (!id) httpError('id is required')
      const { error } = await admin
        .from('workspaces')
        .update({ status: 'archived', updated_at: now, updated_by: user.email })
        .eq('id', id)
      if (error) httpError(error.message)
      return { deleted_id: id }
    }

    case 'pin_workspace': {
      const id = String(body.id ?? '')
      const pinned = Boolean(body.pinned)
      if (!id) httpError('id is required')
      const { data, error } = await admin
        .from('workspaces')
        .update({ pinned, updated_at: now, updated_by: user.email })
        .eq('id', id)
        .select()
        .single()
      if (error) httpError(error.message)
      return { workspace: data }
    }

    case 'upsert_thread': {
      const raw = body.thread as Record<string, unknown> | null
      if (!raw) httpError('Missing thread payload')

      const id: string | undefined = raw.id ? String(raw.id) : undefined
      const workspaceId = String(raw.workspace_id ?? '')
      if (!workspaceId) httpError('workspace_id is required')

      // Verify workspace exists
      const { data: ws } = await admin.from('workspaces').select('id').eq('id', workspaceId).single()
      if (!ws) httpError('Workspace not found', 404)

      const row = {
        workspace_id: workspaceId,
        parent_id: raw.parent_id ?? null,
        thread_type: (raw.thread_type as string) === 'attached' ? 'attached' : 'initiator',
        subject: sanitizeText(raw.subject, 300) || '(no subject)',
        body: capText(raw.body, 50000),
        from_address: user.email,
        to_addresses: capText(raw.to_addresses, 2000),
        cc_addresses: capText(raw.cc_addresses, 1000),
        external_message_id: raw.external_message_id ?? null,
        sent_at: raw.sent_at ?? null,
        status: (['draft', 'sent', 'received', 'archived'] as const).includes(raw.status as 'draft')
          ? (raw.status as string)
          : 'draft',
        updated_at: now,
        ...(id ? {} : { created_by: user.email }),
      }

      const { data, error } = id
        ? await admin.from('email_threads').update(row).eq('id', id).select().single()
        : await admin
            .from('email_threads')
            .insert({ ...row, created_by: user.email })
            .select()
            .single()

      if (error) httpError(error.message)
      return { thread: data }
    }

    case 'delete_thread': {
      const id = String(body.id ?? '')
      if (!id) httpError('id is required')
      const { error } = await admin.from('email_threads').delete().eq('id', id)
      if (error) httpError(error.message)
      return { deleted_id: id }
    }

    default:
      httpError(`Unknown action: ${action}`)
  }
  // unreachable
  return {}
}

// ------------------------------------------------------------------ server --
Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') return fail('Method not allowed', 405, req)

  const { user, error } = await requireManager(req)
  if (error || !user) return fail(error || 'Forbidden', 403, req)

  const body = await readJsonBody(req)
  if (!body) return fail('Invalid JSON body', 400, req)

  const admin = getAdminClient()

  try {
    const result = await dispatch(admin, user, body)
    return json({ ok: true, ...result }, 200, req)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Save failed'
    const status = (err as { status?: number }).status ?? 400
    console.error('[workspace-save]', message)
    return fail(message, status, req)
  }
})
