/**
 * supabase/functions/site-update-save/index.ts
 * @why Single write path for site updates. Validates (manager gate + domain
 *  rules) and executes with the service role, so the browser never needs
 *  INSERT/UPDATE/DELETE grants.
 *
 * POST /functions/v1/site-update-save
 * Auth: Bearer <access token of an @earthguardians.org account>
 * Body: { action: 'upsert_site_update' | 'delete_site_update', site_update?: ..., id?: ... }
 */
import { fail, json, readJsonBody } from '../_shared/cors.ts'
import {
  requireManager,
  sanitizeText,
  capText,
  type AuthedUser,
} from '../_shared/auth.ts'
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

const MAX_TITLE = 200
const MAX_SLUG = 200
const MAX_CONTENT = 100000
const MAX_URL = 500

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,198}[a-z0-9]$/

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) })
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
    console.error('[site-update-save]', message)
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
    case 'upsert_site_update':
      return await upsertSiteUpdate(admin, user, body.site_update)
    case 'delete_site_update':
      return await deleteSiteUpdate(admin, user, String(body.id ?? ''))
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
  return typeof value === 'string' && ['draft', 'published', 'archived'].includes(value)
    ? value
    : 'draft'
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG)
}

async function upsertSiteUpdate(
  admin: SupabaseClient,
  user: AuthedUser,
  raw: unknown,
): Promise<Record<string, unknown>> {
  const u = asRecord(raw, 'site_update')

  const title = capText(sanitizeText(u.title, MAX_TITLE), MAX_TITLE)
  if (!title) return httpError('Site update title is required.')

  let slug = typeof u.slug === 'string' && u.slug.trim() ? u.slug.trim() : slugify(title)
  if (!SLUG_RE.test(slug)) return httpError('Slug must be lowercase letters, digits and hyphens.')

  const content = typeof u.content === 'string' ? u.content.slice(0, MAX_CONTENT) : ''
  if (!content) return httpError('Site update content is required.')
  const status = validateStatus(u.status)
  const publishedAt =
    u.published_at === null || u.published_at === undefined || u.published_at === ''
      ? null
      : String(u.published_at)
  const url = capText(typeof u.url === 'string' ? u.url : '', MAX_URL) || null

  const patch: Record<string, unknown> = {
    title,
    slug,
    content,
    status,
    published_at: publishedAt,
    url,
    // Wayback integration fields
    wayback_url: typeof u.wayback_url === 'string' ? u.wayback_url.slice(0, MAX_URL) : null,
    snapshot_timestamps: Array.isArray(u.snapshot_timestamps) ? u.snapshot_timestamps : null,
    last_diff: typeof u.last_diff === 'string' ? u.last_diff.slice(0, 5000) : null,
    updated_at: new Date().toISOString(),
    updated_by: user.email,
  }

  const id = typeof u.id === 'string' && u.id ? u.id : null

  if (id) {
    const { data: existing, error: findErr } = await admin
      .from('site_updates')
      .select('id, slug')
      .eq('id', id)
      .maybeSingle()
    if (findErr) httpError(findErr.message, 500)
    if (!existing) return httpError('Site update not found.', 404)

    // Slug uniqueness: only clash if a *different* row already owns it.
    if (existing.slug !== slug) {
      const { data: clash } = await admin
        .from('site_updates')
        .select('id')
        .eq('slug', slug)
        .maybeSingle()
      if (clash) return httpError(`Slug "${slug}" is already in use.`, 409)
    }

    const { data, error } = await admin
      .from('site_updates')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) httpError(error.message, 500)
    return { action: 'upsert_site_update', site_update: data }
  }

  // Ensure slug is unique on insert.
  const { data: clash } = await admin.from('site_updates').select('id').eq('slug', slug).maybeSingle()
  if (clash) return httpError(`Slug "${slug}" is already in use.`, 409)

  patch.created_at = new Date().toISOString()

  const { data, error } = await admin.from('site_updates').insert(patch).select().single()
  if (error) httpError(error.message, 500)
  return { action: 'upsert_site_update', site_update: data }
}

async function deleteSiteUpdate(
  admin: SupabaseClient,
  user: AuthedUser,
  id: string,
): Promise<Record<string, unknown>> {
  if (!id) return httpError('Missing site update id')
  const { data, error } = await admin
    .from('site_updates')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle()
  if (error) httpError(error.message, 500)
  if (!data) return httpError('Site update not found.', 404)
  void user
  return { action: 'delete_site_update', id }
}

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || ''
  return {
    'Access-Control-Allow-Origin': origin || 'https://guardioesdaterra.github.io',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

async function adminClient(): Promise<SupabaseClient | null> {
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!url || !key) return null
  const { createClient } = await import('jsr:@supabase/supabase-js@2')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
