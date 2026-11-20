/**
 * supabase/functions/calendar-save/index.ts
 * @why Single write path for the editorial calendar. Every mutation is
 *  validated here (manager gate + domain + schema rules) and executed with the
 *  service role, so the browser never needs INSERT/UPDATE/DELETE grants.
 *
 * POST /functions/v1/calendar-save
 * Auth: Bearer <access token of an @earthguardians.org account>
 * Body: a SaveAction (see lib/types.ts on the client)
 */
import { fail, json, readJsonBody } from '../_shared/cors.ts'
import {
  COLOR_RE,
  FORMATS,
  MAX_IMAGE_BYTES,
  STATUSES,
  TOPIC_KEY_RE,
  base64Bytes,
  bumpVersion,
  capText,
  isValidIsoDay,
  requireManager,
  sanitizeText,
  type AuthedUser,
} from '../_shared/auth.ts'
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

const MAX_CAPTION = 10000
const MAX_HASHTAGS = 2000
const MAX_TITLE = 300
const MAX_SETTING_KEY = 64
const MAX_SETTING_VALUE_BYTES = 256 * 1024

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
    const version = await bumpVersion(admin, user.email)
    return json({ ok: true, version, ...result }, 200, req)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Save failed'
    const status = (err as { status?: number }).status ?? 400
    console.error('[calendar-save]', message)
    return fail(message, status, req)
  }
})

/* ------------------------------------------------------------------ */
/* Dispatch                                                            */
/* ------------------------------------------------------------------ */

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
    case 'upsert_post':
      return await upsertPost(admin, user, body.post)
    case 'delete_post':
      return await deletePost(admin, user, String(body.id ?? ''))
    case 'reorder_posts':
      return await reorderPosts(admin, user, body.items)
    case 'upsert_topic':
      return await upsertTopic(admin, user, body.topic)
    case 'delete_topic':
      return await deleteTopic(admin, user, String(body.key ?? ''))
    case 'reorder_topics':
      return await reorderTopics(admin, user, body.items)
    case 'set_attention':
      return await setAttention(admin, user, body.items)
    case 'upsert_setting':
      return await upsertSetting(admin, user, body.key, body.value)
    default:
      return httpError(`Unknown action: ${String(action)}`)
  }
}

/* ------------------------------------------------------------------ */
/* Posts (multiple per day are allowed)                                */
/* ------------------------------------------------------------------ */

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return httpError(`Missing or invalid "${label}"`)
  }
  return value as Record<string, unknown>
}

async function assertTopicExists(admin: SupabaseClient, key: string): Promise<void> {
  if (!TOPIC_KEY_RE.test(key)) return httpError(`Invalid topic key: ${key}`)
  const { data, error } = await admin.from('calendar_topics').select('key').eq('key', key).maybeSingle()
  if (error) return httpError(error.message, 500)
  if (!data) return httpError(`Topic "${key}" does not exist. Create it first.`, 409)
}

async function nextSortOrder(admin: SupabaseClient, day: string): Promise<number> {
  const { data, error } = await admin
    .from('calendar_posts')
    .select('sort_order')
    .eq('day', day)
    .order('sort_order', { ascending: false })
    .limit(1)
  if (error) httpError(error.message, 500)
  if (!data || data.length === 0) return 0
  return (data[0].sort_order ?? -1) + 1
}

function validateDay(value: unknown): string {
  if (!isValidIsoDay(value)) return httpError('Invalid "day". Expected YYYY-MM-DD between 2020 and 2100.')
  return value
}

function validateFormat(value: unknown): string {
  const v = typeof value === 'string' && (FORMATS as readonly string[]).includes(value) ? value : 'Carousel'
  return v
}

function validateStatus(value: unknown): string {
  return typeof value === 'string' && (STATUSES as readonly string[]).includes(value) ? value : 'planned'
}

interface ImagePatch {
  image_base64: string | null
  image_mime: string | null
  image_name: string | null
  image_bytes: number | null
}

function validateImage(draft: Record<string, unknown>): ImagePatch | null {
  if (!('image_base64' in draft)) return null

  const raw = draft.image_base64
  if (raw === null || raw === undefined || raw === '') {
    return { image_base64: null, image_mime: null, image_name: null, image_bytes: null }
  }
  if (typeof raw !== 'string') return httpError('"image_base64" must be a string data URL or null.')

  const match = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(raw)
  if (!match) return httpError('Image must be a base64 data URL (data:image/...;base64,...).')

  const bytes = base64Bytes(raw)
  if (bytes > MAX_IMAGE_BYTES) {
    return httpError(
      `Image is ${Math.round(bytes / 1024 / 1024 * 10) / 10} MB — the limit is ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`,
      413,
    )
  }

  const mime = match[1] as string
  const name = sanitizeText(draft.image_name, 200) || 'image'
  return { image_base64: raw, image_mime: mime, image_name: name, image_bytes: bytes }
}

async function upsertPost(
  admin: SupabaseClient,
  user: AuthedUser,
  rawPost: unknown,
): Promise<Record<string, unknown>> {
  const draft = asRecord(rawPost, 'post')
  const day = validateDay(draft.day)
  const topicKey = typeof draft.topic_key === 'string' ? draft.topic_key.trim() : ''
  if (!topicKey) return httpError('"topic_key" is required — every post must be linked to a topic.')
  await assertTopicExists(admin, topicKey)

  const patch: Record<string, unknown> = {
    day,
    topic_key: topicKey,
    format: validateFormat(draft.format),
    title: capText(sanitizeTextKeep(draft.title), MAX_TITLE),
    caption: capText(typeof draft.caption === 'string' ? draft.caption.replace(/<[^>]*>/g, '') : '', MAX_CAPTION),
    hashtags: capText(typeof draft.hashtags === 'string' ? draft.hashtags.replace(/<[^>]*>/g, '') : '', MAX_HASHTAGS),
    status: validateStatus(draft.status),
    updated_at: new Date().toISOString(),
    updated_by: user.email,
  }

  const image = validateImage(draft)
  if (image) Object.assign(patch, image)

  const id = typeof draft.id === 'string' && draft.id ? draft.id : null

  if (id) {
    const { data: existing, error: findErr } = await admin
      .from('calendar_posts')
      .select('id, day, sort_order')
      .eq('id', id)
      .maybeSingle()
    if (findErr) httpError(findErr.message, 500)
    if (!existing) return httpError('Post not found.', 404)

    const dayChanged = existing.day !== day
    if (dayChanged || draft.sort_order === undefined || draft.sort_order === null) {
      patch.sort_order = await nextSortOrder(admin, day)
    } else {
      patch.sort_order = clampSort(draft.sort_order)
    }

    const { data, error } = await admin
      .from('calendar_posts')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) httpError(error.message, 500)
    return { action: 'upsert_post', post: data }
  }

  patch.sort_order =
    draft.sort_order === undefined || draft.sort_order === null
      ? await nextSortOrder(admin, day)
      : clampSort(draft.sort_order)
  patch.created_at = new Date().toISOString()

  const { data, error } = await admin.from('calendar_posts').insert(patch).select().single()
  if (error) httpError(error.message, 500)
  return { action: 'upsert_post', post: data }
}

function sanitizeTextKeep(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim()
}

function clampSort(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100000, Math.trunc(n)))
}

async function deletePost(
  admin: SupabaseClient,
  user: AuthedUser,
  id: string,
): Promise<Record<string, unknown>> {
  if (!id) return httpError('Missing post id')
  const { data, error } = await admin
    .from('calendar_posts')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle()
  if (error) httpError(error.message, 500)
  if (!data) return httpError('Post not found.', 404)
  void user
  return { action: 'delete_post', id }
}

async function reorderPosts(
  admin: SupabaseClient,
  user: AuthedUser,
  rawItems: unknown,
): Promise<Record<string, unknown>> {
  if (!Array.isArray(rawItems)) return httpError('"items" must be an array')
  if (rawItems.length === 0) return { action: 'reorder_posts', posts: [] }

  const seen = new Set<string>()
  const rows: { id: string; day: string; sort_order: number }[] = []

  for (const entry of rawItems) {
    const item = asRecord(entry, 'item')
    const id = typeof item.id === 'string' ? item.id : ''
    if (!id || seen.has(id)) return httpError('Duplicate or missing item id in reorder list.')
    seen.add(id)
    rows.push({ id, day: validateDay(item.day), sort_order: clampSort(item.sort_order) })
  }

  const updated: unknown[] = []
  for (const row of rows) {
    const { data, error } = await admin
      .from('calendar_posts')
      .update({
        day: row.day,
        sort_order: row.sort_order,
        updated_at: new Date().toISOString(),
        updated_by: user.email,
      })
      .eq('id', row.id)
      .select()
      .single()
    if (error) httpError(error.message, 500)
    updated.push(data)
  }

  return { action: 'reorder_posts', posts: updated }
}

/* ------------------------------------------------------------------ */
/* Topics                                                              */
/* ------------------------------------------------------------------ */

function normalizeTopic(rawTopic: unknown): Record<string, unknown> {
  const t = asRecord(rawTopic, 'topic')
  const key = typeof t.key === 'string' ? t.key.trim().toLowerCase() : ''
  if (!TOPIC_KEY_RE.test(key)) {
    return httpError('Topic key must be 3–40 chars: lowercase letters, digits and hyphens.')
  }
  const label = sanitizeText(t.label, 80)
  if (!label) return httpError('Topic label is required.')

  const needsAttention = t.needs_attention === true
  let rank: number | null = null
  if (needsAttention) {
    const n = Number(t.attention_rank)
    if (!Number.isFinite(n) || n < 1) return httpError('attention_rank must be >= 1 when needs_attention is true.')
    rank = Math.trunc(n)
  }

  return {
    key,
    label,
    description: capText(typeof t.description === 'string' ? t.description.replace(/<[^>]*>/g, '') : '', 400),
    color: typeof t.color === 'string' && COLOR_RE.test(t.color) ? t.color.toUpperCase() : '#22C55E',
    emoji: typeof t.emoji === 'string' && t.emoji.length <= 8 ? t.emoji : '•',
    sort: clampSort(t.sort),
    needs_attention: needsAttention,
    attention_rank: rank,
    updated_at: new Date().toISOString(),
    updated_by: 'x',
  }
}

async function upsertTopic(
  admin: SupabaseClient,
  user: AuthedUser,
  rawTopic: unknown,
): Promise<Record<string, unknown>> {
  const row = normalizeTopic(rawTopic)
  row.updated_by = user.email

  const { data, error } = await admin
    .from('calendar_topics')
    .upsert(row, { onConflict: 'key' })
    .select()
    .single()
  if (error) httpError(error.message, 500)
  return { action: 'upsert_topic', topic: data }
}

async function deleteTopic(
  admin: SupabaseClient,
  user: AuthedUser,
  key: string,
): Promise<Record<string, unknown>> {
  if (!key) return httpError('Missing topic key')

  const { count, error: countErr } = await admin
    .from('calendar_posts')
    .select('id', { count: 'exact', head: true })
    .eq('topic_key', key)
  if (countErr) httpError(countErr.message, 500)
  if (count && count > 0) {
    return httpError(
      `This topic is linked to ${count} scheduled post${count > 1 ? 's' : ''}. Re-link them before deleting.`,
      409,
    )
  }

  const { data, error } = await admin.from('calendar_topics').delete().eq('key', key).select('key').maybeSingle()
  if (error) httpError(error.message, 500)
  if (!data) return httpError('Topic not found.', 404)
  void user
  return { action: 'delete_topic', key }
}

async function reorderTopics(
  admin: SupabaseClient,
  user: AuthedUser,
  rawItems: unknown,
): Promise<Record<string, unknown>> {
  if (!Array.isArray(rawItems) || rawItems.length === 0) return httpError('"items" must be a non-empty array')

  const topics: unknown[] = []
  for (const entry of rawItems) {
    const item = asRecord(entry, 'item')
    const key = typeof item.key === 'string' ? item.key : ''
    if (!TOPIC_KEY_RE.test(key)) return httpError(`Invalid topic key: ${key}`)
    const { data, error } = await admin
      .from('calendar_topics')
      .update({ sort: clampSort(item.sort), updated_at: new Date().toISOString(), updated_by: user.email })
      .eq('key', key)
      .select()
      .single()
    if (error) httpError(error.message, 500)
    topics.push(data)
  }
  return { action: 'reorder_topics', topics }
}

async function setAttention(
  admin: SupabaseClient,
  user: AuthedUser,
  rawItems: unknown,
): Promise<Record<string, unknown>> {
  if (!Array.isArray(rawItems)) return httpError('"items" must be an array')

  // `attention_rank: null` removes the topic from the priority list.
  const keys = new Set<string>()
  for (const entry of rawItems) {
    const item = asRecord(entry, 'item')
    const key = typeof item.key === 'string' ? item.key : ''
    if (!TOPIC_KEY_RE.test(key)) return httpError(`Invalid topic key: ${key}`)
    if (keys.has(key)) return httpError('Duplicate topic in attention list.')
    keys.add(key)
  }

  // Everything not mentioned in the payload leaves the list.
  const { data: all, error: allErr } = await admin.from('calendar_topics').select('key')
  if (allErr) httpError(allErr.message, 500)

  const now = new Date().toISOString()
  const updates: { key: string; needs_attention: boolean; attention_rank: number | null }[] = []

  for (const topic of all ?? []) {
    const match = rawItems.find((e) => asRecord(e, 'item').key === topic.key) as
      | Record<string, unknown>
      | undefined
    if (!match) {
      if (keys.has(topic.key)) continue
      updates.push({ key: topic.key, needs_attention: false, attention_rank: null })
      continue
    }
    const rankRaw = match.attention_rank
    if (rankRaw === null || rankRaw === undefined) {
      updates.push({ key: topic.key, needs_attention: false, attention_rank: null })
    } else {
      const n = Number(rankRaw)
      if (!Number.isFinite(n) || n < 1) return httpError(`Invalid attention_rank for "${topic.key}".`)
      updates.push({ key: topic.key, needs_attention: true, attention_rank: Math.trunc(n) })
    }
  }

  // Ranks must be unique among active topics.
  const active = updates.filter((u) => u.needs_attention).map((u) => u.attention_rank as number)
  if (new Set(active).size !== active.length) {
    return httpError('Attention ranks must be unique (#1, #2, …).', 409)
  }

  const topics: unknown[] = []
  for (const u of updates) {
    const { data, error } = await admin
      .from('calendar_topics')
      .update({ ...u, updated_at: now, updated_by: user.email })
      .eq('key', u.key)
      .select()
      .single()
    if (error) httpError(error.message, 500)
    topics.push(data)
  }

  return { action: 'set_attention', topics }
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

async function upsertSetting(
  admin: SupabaseClient,
  user: AuthedUser,
  rawKey: unknown,
  value: unknown,
): Promise<Record<string, unknown>> {
  const key = typeof rawKey === 'string' ? rawKey.trim() : ''
  if (!key || key.length > MAX_SETTING_KEY) return httpError('Invalid setting key.')
  if (key === 'version') return httpError('The "version" key is managed by the server.', 403)
  if (value === undefined) return httpError('Missing setting value.')

  const encoded = JSON.stringify(value)
  if (encoded.length > MAX_SETTING_VALUE_BYTES) return httpError('Setting value is too large.', 413)

  const { data, error } = await admin
    .from('calendar_settings')
    .upsert(
      { key, value, updated_at: new Date().toISOString(), updated_by: user.email },
      { onConflict: 'key' },
    )
    .select('key,value,updated_at')
    .single()
  if (error) httpError(error.message, 500)
  return { action: 'upsert_setting', settings: [data] }
}

/* ------------------------------------------------------------------ */

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
