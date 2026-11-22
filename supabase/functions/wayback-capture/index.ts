/**
 * supabase/functions/wayback-capture/index.ts
 * @why Trigger Wayback Machine Save Page Now capture via API.
 *  The API key is stored in server-side env vars, never exposed to client.
 *
 * POST /functions/v1/wayback-capture
 * Auth: Bearer <access token of an @earthguardians.org account>
 * Body: { url: "https://..." }
 */
import { corsHeaders, fail, json, readJsonBody } from '../_shared/cors.ts'
import { requireManager, type AuthedUser } from '../_shared/auth.ts'

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return fail('Method not allowed', 405, req)

  const { user, error } = await requireManager(req)
  if (error || !user) return fail(error || 'Forbidden', 403, req)

  const body = await readJsonBody(req)
  if (!body) return fail('Invalid JSON body', 400, req)

  const url = typeof body.url === 'string' ? body.url.trim() : ''
  if (!url) return fail('Missing url', 400, req)

  const urlError = validateCaptureUrl(url)
  if (urlError) return fail(urlError, 400, req)

  try {
    const result = await triggerCapture(url)
    return json({ ok: true, ...result }, 200, req)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Capture failed'
    console.error('[wayback-capture]', message)
    return fail(message, 500, req)
  }
})

/**
 * SSRF guard for the user-supplied capture target.
 * Returns an error message, or null when the URL is safe to fetch.
 */
function validateCaptureUrl(raw: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return 'Invalid URL'
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'Only http and https URLs are allowed'
  }
  if (parsed.username || parsed.password) {
    return 'URLs containing credentials are not allowed'
  }

  // URL parser lowercases host and normalizes IPv4 (incl. hex/octal) to dotted form.
  const host = parsed.hostname.toLowerCase()

  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === '0.0.0.0' ||
    host === '0' ||
    host === 'metadata.google.internal'
  ) {
    return 'Requests to internal hosts are not allowed'
  }

  // IPv4 literal (already normalized by the URL parser).
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (v4) {
    const a = Number(v4[1])
    const b = Number(v4[2])
    if (a === 0 || a === 10 || a === 127) return 'Requests to private addresses are not allowed'
    if (a === 169 && b === 254) return 'Requests to link-local addresses are not allowed'
    if (a === 172 && b >= 16 && b <= 31) return 'Requests to private addresses are not allowed'
    if (a === 192 && b === 168) return 'Requests to private addresses are not allowed'
    if (a === 100 && b >= 64 && b <= 127) return 'Requests to private addresses are not allowed'
    if (a >= 224) return 'Requests to multicast or reserved addresses are not allowed'
  }

  // IPv6 literal — hostname keeps surrounding brackets (e.g. "[::1]").
  if (host.startsWith('[') && host.endsWith(']')) {
    const inner = host.slice(1, -1)
    if (inner === '::' || inner === '::1') return 'Requests to loopback addresses are not allowed'
    if (inner.startsWith('::ffff:')) {
      const mapped = inner.slice('::ffff:'.length)
      const m = mapped.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
      if (m) {
        const a = Number(m[1])
        const b = Number(m[2])
        if (a === 0 || a === 10 || a === 127) return 'Requests to private addresses are not allowed'
        if (a === 169 && b === 254) return 'Requests to link-local addresses are not allowed'
        if (a === 172 && b >= 16 && b <= 31) return 'Requests to private addresses are not allowed'
        if (a === 192 && b === 168) return 'Requests to private addresses are not allowed'
      }
    }
    if (/^f[cd]/.test(inner)) return 'Requests to private addresses are not allowed'
    if (/^fe[89ab]/.test(inner)) return 'Requests to link-local addresses are not allowed'
  }

  return null
}

async function triggerCapture(url: string): Promise<Record<string, unknown>> {
  const apiKey = Deno.env.get('WAYBACK_API_KEY')
  if (!apiKey) {
    throw new Error('Wayback API key not configured')
  }

  // Use Save Page Now v2 API
  const saveUrl = `https://web.archive.org/save/${url}`
  
  const res = await fetch(saveUrl, {
    method: 'POST',
    headers: {
      'Authorization': `LOW ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      url,
      // Skip if captured in last 7 days
      'if_not_archived_within': '7',
      // Capture 4xx/5xx pages too
      'capture_all': '1',
    }),
  })

  if (!res.ok) {
    const status = res.status
    const text = await res.text()
    throw new Error(`Wayback API error: ${status} - ${text.slice(0, 200)}`)
  }

  // Parse the response to get the new snapshot URL
  const contentType = res.headers.get('content-type') || ''
  
  if (contentType.includes('application/json')) {
    const data = await res.json()
    return {
      message: 'Capture queued',
      url: data.url || `https://web.archive.org/web/2/${url}`,
      job_id: data.job_id || null,
    }
  }

  // HTML response means capture started, redirect to the snapshot
  return {
    message: 'Capture started',
    url: `https://web.archive.org/web/2/${url}`,
  }
}