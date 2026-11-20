/**
 * Shared auth + validation helpers for the Social Media edge functions.
 */
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL =
  Deno.env.get('SUPABASE_URL') || Deno.env.get('NUXT_PUBLIC_SUPABASE_URL') || ''
const SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || ''

export const EG_EMAIL_DOMAIN = 'earthguardians.org'

export function getAdminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export interface AuthedUser {
  id: string
  email: string
}

/** Validates the bearer token and returns the authenticated user. */
export async function requireUser(
  req: Request,
): Promise<{ user: AuthedUser | null; error: string | null }> {
  const header = req.headers.get('Authorization')
  if (!header || !header.startsWith('Bearer ')) {
    return { user: null, error: 'Missing or invalid Authorization header' }
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('edge function misconfigured: missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
    return { user: null, error: 'Server is not configured' }
  }
  const admin = getAdminClient()
  const { data, error } = await admin.auth.getUser(header.slice(7))
  if (error || !data.user) {
    return { user: null, error: error?.message || 'Invalid token' }
  }
  return {
    user: { id: data.user.id, email: (data.user.email ?? '').toLowerCase() },
    error: null,
  }
}

export function isEarthGuardiansEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return email.toLowerCase().endsWith(`@${EG_EMAIL_DOMAIN}`)
}

/** Manager gate: authenticated AND on the EG domain. */
export async function requireManager(
  req: Request,
): Promise<{ user: AuthedUser | null; error: string | null }> {
  const { user, error } = await requireUser(req)
  if (error || !user) return { user: null, error: error || 'Invalid token' }
  if (!isEarthGuardiansEmail(user.email)) {
    return { user: null, error: `Access is restricted to @${EG_EMAIL_DOMAIN} accounts` }
  }
  return { user, error: null }
}

/** Strips markup/angle brackets and control chars, then caps the length. */
export function sanitizeText(input: unknown, maxLen = 500): string {
  if (typeof input !== 'string') return ''
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .slice(0, maxLen)
    .trim()
}

/** Keeps the string as-is but caps it (captions keep their punctuation). */
export function capText(input: unknown, maxLen: number): string {
  if (typeof input !== 'string') return ''
  return input.slice(0, maxLen)
}

export const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/

export function isValidIsoDay(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DAY_RE.test(value)) return false
  const [y, m, d] = value.split('-').map((n) => Number.parseInt(n, 10))
  if (!y || !m || !d) return false
  const dt = new Date(Date.UTC(y, m - 1, d))
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d &&
    y >= 2020 && y <= 2100
  )
}

export const FORMATS = ['Carousel', 'Photo', 'Reel', 'Story', 'Video'] as const
export const STATUSES = ['planned', 'production', 'approved', 'published'] as const

export const TOPIC_KEY_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/
export const COLOR_RE = /^#[0-9A-Fa-f]{6}$/

/** 4 MiB in bytes. */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024

/** Rough base64 length check (4/3 of the raw size, padded). */
export function base64Bytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) return 0
  const b64 = dataUrl.slice(comma + 1)
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding)
}

/** Reads the JSON body, failing cleanly on garbage / empty payloads. */
export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const text = await req.text()
    if (!text) return null
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** Bumps the monotonic snapshot version and returns the new number. */
export async function bumpVersion(admin: SupabaseClient, userId: string): Promise<number> {
  const { data: row } = await admin
    .from('calendar_settings')
    .select('value')
    .eq('key', 'version')
    .single()

  const current =
    row && typeof row.value === 'object' && row.value !== null && 'n' in (row.value as object)
      ? Number((row.value as { n: unknown }).n) || 0
      : 0
  const next = current + 1

  await admin
    .from('calendar_settings')
    .upsert(
      { key: 'version', value: { n: next }, updated_at: new Date().toISOString(), updated_by: userId },
      { onConflict: 'key' },
    )

  return next
}

export async function getVersion(admin: SupabaseClient): Promise<number> {
  const { data } = await admin.from('calendar_settings').select('value').eq('key', 'version').single()
  if (data && typeof data.value === 'object' && data.value !== null && 'n' in (data.value as object)) {
    return Number((data.value as { n: unknown }).n) || 0
  }
  return 0
}
