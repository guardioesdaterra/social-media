/**
 * supabase/functions/comment-save/index.ts
 *
 * POST /functions/v1/comment-save
 * Auth: Bearer <access_token>
 *
 * Handles all commentary writes.  After saving, it:
 *   1. Extracts @email mentions from the body.
 *   2. Inserts rows into `commentary_tags`.
 *   3. Enqueues in-app notifications.
 *   4. Calls the `tag-notify` function (async, best-effort) to send emails.
 *
 * Actions:
 *   add_comment      – create a new commentary (top-level or reply)
 *   update_comment   – edit body of an existing comment
 *   resolve_comment  – mark a comment as resolved / unresolved
 *   delete_comment   – hard-delete a comment and its children
 */
import { handleCors, json, fail, readJsonBody } from '../_shared/cors.ts'
import { requireManager, getAdminClient, capText } from '../_shared/auth.ts'
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

interface AuthedUser { id: string; email: string }

function httpError(message: string, status = 400): never {
  const e = new Error(message) as Error & { status?: number }
  e.status = status
  throw e
}

// ------------------------------------------------------------------ helpers --

/** Extract all @-mentioned email addresses from comment body text. */
function extractMentions(body: string): string[] {
  // Matches patterns like @email@domain.org or @email (without domain also captured)
  // We specifically look for @word@domain.tld pattern for emails
  const emailMentionRe = /@([\w.+-]+@[\w.-]+\.[a-z]{2,})/gi
  const matches = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = emailMentionRe.exec(body)) !== null) {
    matches.add(m[1]!.toLowerCase())
  }
  return [...matches]
}

/** Build a human-readable target label for notification copy. */
function targetLabel(targetType: string, targetPath: string): string {
  const path = targetPath ? ` › ${targetPath}` : ''
  const typeLabel: Record<string, string> = {
    post: 'Post',
    newsletter: 'Newsletter',
    site_update: 'Site update',
    workspace: 'Workspace',
    image: 'Image',
    general: 'Page',
  }
  return (typeLabel[targetType] ?? 'Item') + path
}

// ----------------------------------------------------------------- dispatch --

async function dispatch(
  admin: SupabaseClient,
  user: AuthedUser,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const action = String(body.action ?? '')
  const now = new Date().toISOString()

  switch (action) {
    case 'add_comment': {
      const rawBody = capText(body.body, 10000)
      if (!rawBody.trim()) httpError('body is required')

      const targetType = String(body.target_type ?? 'general')
      const targetId = body.target_id ? String(body.target_id) : null
      const targetPath = String(body.target_path ?? '')
      const parentId = body.parent_id ? String(body.parent_id) : null

      const { data: comment, error: insertErr } = await admin
        .from('commentaries')
        .insert({
          target_type: targetType,
          target_id: targetId,
          target_path: targetPath,
          parent_id: parentId,
          body: rawBody,
          author_email: user.email,
          author_name: String(body.author_name ?? user.email),
          resolved: false,
        })
        .select()
        .single()

      if (insertErr || !comment) httpError(insertErr?.message ?? 'Insert failed')

      // ----- extract mentions & dispatch notifications -----
      const mentions = extractMentions(rawBody)
      if (mentions.length > 0) {
        const tagRows = mentions.map((email) => ({
          commentary_id: comment.id,
          tagged_email: email,
        }))
        await admin.from('commentary_tags').insert(tagRows)

        // In-app notifications for tagged users
        const notifRows = mentions.map((email) => ({
          recipient_email: email,
          event_type: 'tag',
          title: `${user.email} mentioned you`,
          body: `${user.email} tagged you in a comment on ${targetLabel(targetType, targetPath)}:\n\n"${rawBody.slice(0, 200)}${rawBody.length > 200 ? '…' : ''}"`,
          link_path: buildLinkPath(targetType, targetId, comment.id),
          source_type: 'commentary',
          source_id: comment.id,
        }))
        await admin.from('notifications').insert(notifRows)

        // Trigger email sending (async, non-blocking)
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        if (supabaseUrl && serviceKey) {
          const authToken = serviceKey
          fetch(`${supabaseUrl}/functions/v1/tag-notify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({
              commentary_id: comment.id,
              author_email: user.email,
              author_user_id: user.id,  // used to look up Gmail provider_token
              body: rawBody,
              target_type: targetType,
              target_path: targetPath,
              target_id: targetId,
              mentions,
            }),
          }).catch((err: Error) => console.error('[comment-save] tag-notify dispatch failed', err.message))
        }
      }

      // If this is a reply, notify the parent author too (unless they are the replier)
      if (parentId) {
        const { data: parent } = await admin
          .from('commentaries')
          .select('author_email, body')
          .eq('id', parentId)
          .single()

        if (parent && parent.author_email !== user.email) {
          await admin.from('notifications').insert({
            recipient_email: parent.author_email,
            event_type: 'comment_reply',
            title: `${user.email} replied to your comment`,
            body: rawBody.slice(0, 300),
            link_path: buildLinkPath(targetType, targetId, comment.id),
            source_type: 'commentary',
            source_id: comment.id,
          })
        }
      }

      return { comment }
    }

    case 'update_comment': {
      const id = String(body.id ?? '')
      if (!id) httpError('id is required')
      const rawBody = capText(body.body, 10000)
      if (!rawBody.trim()) httpError('body is required')

      // Only the author can edit their comment
      const { data: existing } = await admin
        .from('commentaries')
        .select('author_email')
        .eq('id', id)
        .single()
      if (!existing) httpError('Comment not found', 404)
      if (existing.author_email !== user.email) httpError('Not authorized to edit this comment', 403)

      const { data: comment, error: updateErr } = await admin
        .from('commentaries')
        .update({ body: rawBody, updated_at: now })
        .eq('id', id)
        .select()
        .single()
      if (updateErr) httpError(updateErr.message)
      return { comment }
    }

    case 'resolve_comment': {
      const id = String(body.id ?? '')
      if (!id) httpError('id is required')
      const resolved = Boolean(body.resolved)

      const { data: comment, error: resolveErr } = await admin
        .from('commentaries')
        .update({
          resolved,
          resolved_by: resolved ? user.email : null,
          resolved_at: resolved ? now : null,
          updated_at: now,
        })
        .eq('id', id)
        .select()
        .single()
      if (resolveErr) httpError(resolveErr.message)
      return { comment }
    }

    case 'delete_comment': {
      const id = String(body.id ?? '')
      if (!id) httpError('id is required')

      const { data: existing } = await admin
        .from('commentaries')
        .select('author_email')
        .eq('id', id)
        .single()
      if (!existing) httpError('Comment not found', 404)
      if (existing.author_email !== user.email) httpError('Not authorized to delete this comment', 403)

      const { error: delErr } = await admin.from('commentaries').delete().eq('id', id)
      if (delErr) httpError(delErr.message)
      return { deleted_id: id }
    }

    default:
      httpError(`Unknown action: ${action}`)
  }

  return {}
}

/** Build a deep-link path the client-side router understands. */
function buildLinkPath(targetType: string, targetId: string | null, commentId: string): string {
  if (!targetId) return `/?comment=${commentId}`
  if (targetType === 'post') return `/calendario?post=${targetId}&comment=${commentId}`
  if (targetType === 'newsletter') return `/newsletters?id=${targetId}&comment=${commentId}`
  if (targetType === 'site_update') return `/site-updates?id=${targetId}&comment=${commentId}`
  if (targetType === 'workspace') return `/workspace?id=${targetId}&comment=${commentId}`
  return `/?comment=${commentId}`
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
    console.error('[comment-save]', message)
    return fail(message, status, req)
  }
})
