/**
 * Shared CORS helpers for every edge function of the Social Media panel.
 *
 * Origin policy:
 *  - exact matches from `ALLOWED_ORIGINS`
 *  - plus ANY subdomain of `earthguardians.org` (https only)
 */

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:8777',
  'https://guardioesdaterra.github.io',
  'https://earthguardians.org',
]

const FALLBACK_ORIGIN = 'https://guardioesdaterra.github.io'

export function isAllowedOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false
  if (ALLOWED_ORIGINS.includes(origin)) return true
  try {
    const url = new URL(origin)
    if (url.protocol !== 'https:') return false
    const host = url.hostname.toLowerCase()
    return host === 'earthguardians.org' || host.endsWith('.earthguardians.org')
  } catch {
    return false
  }
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || ''
  const allow = isAllowedOrigin(origin) ? origin : FALLBACK_ORIGIN
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, origin',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

/** Returns a ready-to-send response for `OPTIONS` preflight, or `null`. */
export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) })
  }
  return null
}

export function json(data: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(req ? corsHeaders(req) : {}),
    },
  })
}

export function fail(message: string, status = 400, req?: Request): Response {
  return json({ error: message, ok: false }, status, req)
}

/** Parses the JSON body, failing cleanly on garbage / empty payloads. */
export async function readJsonBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const text = await req.text()
    if (!text) return null
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}
