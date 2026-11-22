/**
 * supabase/functions/newsletter-save/index.ts
 * @why Single write path for newsletters. Validates (manager gate + domain
 *  rules) and executes with the service role, so the browser never needs
 *  INSERT/UPDATE/DELETE grants.
 *
 * POST /functions/v1/newsletter-save
 * Auth: Bearer <access token of an @earthguardians.org account>
 * Body: { action: 'upsert_newsletter' | 'delete_newsletter', newsletter?: ..., id?: ... }
 */
import { corsHeaders, fail, json, readJsonBody } from '../_shared/cors.ts'
import {
  requireManager,
  sanitizeText,
  capText,
  type AuthedUser,
} from '../_shared/auth.ts'
import { sanitizeHtml } from '../_shared/sanitize.ts'
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

const MAX_TITLE = 200
const MAX_SUBJECT = 200
const MAX_BODY = 100000
const MAX_RECIPIENT_LIST = 5000

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return fail('Method not allowed', 405, req)

  const { user, error } = await requireManager(req)
  if (error || !user) return fail(error || 'Forbidden', 403, req)

  const body = await readJsonBody(req)
  if (!body) return fail('Invalid JSON body', 400, req)

  const admin = await adminClient()
  if (!admin) return fail('Server is not configured', 500, req)

  try {
    const result = await dispatch(admin, user, body)
    return json({ ok: true, ...result }, 200, req)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Save failed'
    const status = (err as { status?: number }).status ?? 400
    console.error('[newsletter-save]', message)
    return fail(message, status, req)
  }
})

function httpError(message: string, status = 400): never {
  const e = new Error(message) as Error & { status?: number }
  e.status = status
  throw e
}

async function dispatch(
  admin: SupabaseClient,
  user: AuthedUser,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const action = body.action

  switch (action) {
    case 'upsert_newsletter':
      return await upsertNewsletter(admin, user, body.newsletter)
    case 'delete_newsletter':
      return await deleteNewsletter(admin, user, String(body.id ?? ''))
    default:
      return httpError(`Unknown action: ${String(action)}`)
  }
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return httpError(`Missing or invalid "${label}"`)
  }
  return value as Record<string, unknown>
}

function validateStatus(value: unknown): string {
  return typeof value === 'string' && ['draft', 'scheduled', 'sent'].includes(value)
    ? value
    : 'draft'
}

async function upsertNewsletter(
  admin: SupabaseClient,
  user: AuthedUser,
  raw: unknown,
): Promise<Record<string, unknown>> {
  const n = asRecord(raw, 'newsletter')

  const title = capText(sanitizeText(n.title, MAX_TITLE), MAX_TITLE)
  if (!title) return httpError('Newsletter title is required.')
  const subject = capText(sanitizeText(n.subject, MAX_SUBJECT), MAX_SUBJECT)
  if (!subject) return httpError('Newsletter subject is required.')
  const body = typeof n.body === 'string' ? sanitizeHtml(n.body).slice(0, MAX_BODY) : ''
  if (!body) return httpError('Newsletter body is required.')
  const status = validateStatus(n.status)
  const scheduledAt =
    n.scheduled_at === null || n.scheduled_at === undefined || n.scheduled_at === ''
      ? null
      : String(n.scheduled_at)
  const sentAt =
    n.sent_at === null || n.sent_at === undefined || n.sent_at === ''
      ? null
      : String(n.sent_at)
  const recipientList = capText(
    typeof n.recipient_list === 'string' ? n.recipient_list : '',
    MAX_RECIPIENT_LIST,
  )

  const patch: Record<string, unknown> = {
    title,
    subject,
    body,
    status,
    scheduled_at: scheduledAt,
    sent_at: sentAt,
    recipient_list: recipientList,
    updated_at: new Date().toISOString(),
    updated_by: user.email,
  }

  const id = typeof n.id === 'string' && n.id ? n.id : null

  if (id) {
    const { data: existing, error: findErr } = await admin
      .from('newsletters')
      .select('id')
      .eq('id', id)
      .maybeSingle()
    if (findErr) httpError(findErr.message, 500)
    if (!existing) return httpError('Newsletter not found.', 404)

    const { data, error } = await admin
      .from('newsletters')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) httpError(error.message, 500)
    return { action: 'upsert_newsletter', newsletter: data }
  }

  patch.created_at = new Date().toISOString()

  const { data, error } = await admin.from('newsletters').insert(patch).select().single()
  if (error) httpError(error.message, 500)
  return { action: 'upsert_newsletter', newsletter: data }
}

async function deleteNewsletter(
  admin: SupabaseClient,
  user: AuthedUser,
  id: string,
): Promise<Record<string, unknown>> {
  if (!id) return httpError('Missing newsletter id')
  const { data, error } = await admin
    .from('newsletters')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle()
  if (error) httpError(error.message, 500)
  if (!data) return httpError('Newsletter not found.', 404)
  void user
  return { action: 'delete_newsletter', id }
}

async function adminClient(): Promise<SupabaseClient | null> {
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!url || !key) return null
  const { createClient } = await import('jsr:@supabase/supabase-js@2')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
