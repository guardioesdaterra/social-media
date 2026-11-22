/**
 * supabase/functions/tag-notify/index.ts
 *
 * POST /functions/v1/tag-notify
 * Internal only – called by comment-save (service-role Bearer).
 *
 * Sends a tag-notification email to each @-mentioned address.
 *
 * Email delivery strategy (tried in order):
 *   1. Gmail API  – uses the signed-in manager's stored provider_token to send
 *      from their real @earthguardians.org Gmail address. This is the most
 *      native path: the email appears in Sent, threads work naturally, and
 *      replies come back to the manager's inbox.
 *      Requires: `gmail.send` scope was granted at sign-in and the
 *      provider_token (or refresh_token) is stored in manager_provider_tokens.
 *
 *   2. Resend API  – fallback when Gmail tokens are absent or expired and a
 *      refresh fails. Requires RESEND_API_KEY env secret.
 *      Emails come from SMTP_FROM (default noreply@earthguardians.org).
 *
 * Required env secrets (set in Supabase dashboard → Edge Function Secrets):
 *   SUPABASE_URL               (injected automatically)
 *   SUPABASE_SERVICE_ROLE_KEY  (injected automatically)
 *   RESEND_API_KEY             (optional fallback)
 *   GOOGLE_CLIENT_ID           (needed to refresh provider tokens)
 *   GOOGLE_CLIENT_SECRET       (needed to refresh provider tokens)
 *   APP_URL                    (e.g. https://guardioesdaterra.github.io/social-media)
 *   SMTP_FROM                  (e.g. noreply@earthguardians.org)
 */
import { handleCors, json, fail, readJsonBody } from '../_shared/cors.ts'
import { getAdminClient } from '../_shared/auth.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') || ''
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') || ''
const APP_URL = Deno.env.get('APP_URL') || 'https://guardioesdaterra.github.io/social-media'
const SMTP_FROM = Deno.env.get('SMTP_FROM') || 'noreply@earthguardians.org'

// ------------------------------------------------------------------ helpers --

function buildEmailHtml(opts: {
  authorEmail: string
  body: string
  targetLabel: string
  linkPath: string
}): string {
  const link = `${APP_URL}${opts.linkPath}`
  const escaped = opts.body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,sans-serif;background:#0a0a0a;color:#e4e4e7;margin:0;padding:24px">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;margin:0 auto">
    <tr><td>
      <div style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:28px 32px">
        <div style="margin-bottom:20px">
          <span style="font-size:16px;font-weight:700;color:#22c55e">Earth Guardians</span>
          <span style="margin-left:8px;font-size:12px;color:#71717a">Social Media Director Control</span>
        </div>
        <h2 style="margin:0 0 8px;font-size:18px;font-weight:600;color:#f4f4f5">
          You were tagged in a comment
        </h2>
        <p style="margin:0 0 16px;font-size:14px;color:#a1a1aa">
          <strong style="color:#e4e4e7">${opts.authorEmail}</strong>
          mentioned you on <strong style="color:#e4e4e7">${opts.targetLabel}</strong>:
        </p>
        <blockquote style="margin:0 0 20px;padding:12px 16px;background:#09090b;border-left:3px solid #22c55e;border-radius:0 8px 8px 0;font-size:14px;color:#d4d4d8;line-height:1.6">
          ${escaped}
        </blockquote>
        <a href="${link}"
           style="display:inline-block;padding:10px 20px;background:#22c55e;color:#000;font-weight:600;font-size:14px;text-decoration:none;border-radius:8px">
          View comment →
        </a>
        <hr style="margin:24px 0;border:none;border-top:1px solid #27272a">
        <p style="margin:0;font-size:12px;color:#52525b">
          Earth Guardians · <a href="${APP_URL}" style="color:#52525b">${APP_URL}</a><br>
          You received this because you were @mentioned in a comment.
        </p>
      </div>
    </td></tr>
  </table>
</body>
</html>`
}

// ---- Gmail API ----

/** Build RFC 2822 MIME message and base64url-encode it for the Gmail API. */
function buildMimeMessage(opts: {
  from: string
  to: string
  subject: string
  html: string
}): string {
  const mime = [
    `From: Earth Guardians <${opts.from}>`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    '',
    opts.html,
  ].join('\r\n')

  // base64url encoding (RFC 4648 §5)
  return btoa(unescape(encodeURIComponent(mime)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

interface ProviderTokenRow {
  user_id: string
  email: string
  provider_token: string | null
  provider_refresh_token: string | null
  token_expires_at: string | null
}

/** Refresh a Google OAuth2 access token using the stored refresh token. */
async function refreshGoogleToken(refreshToken: string): Promise<string | null> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return null
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })
    const data = await res.json() as { access_token?: string; expires_in?: number }
    return data.access_token ?? null
  } catch (err) {
    console.error('[tag-notify] token refresh failed', err instanceof Error ? err.message : err)
    return null
  }
}

/** Send via Gmail REST API. Returns true on success. */
async function sendViaGmail(opts: {
  accessToken: string
  from: string
  to: string
  subject: string
  html: string
}): Promise<boolean> {
  try {
    const raw = buildMimeMessage(opts)
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    })
    if (!res.ok) {
      const body = await res.text()
      console.error('[tag-notify] Gmail API error', res.status, body)
      return false
    }
    return true
  } catch (err) {
    console.error('[tag-notify] Gmail send error', err instanceof Error ? err.message : err)
    return false
  }
}

// ---- Resend fallback ----

/** Send via Resend API. Returns true on success. */
async function sendViaResend(opts: {
  to: string
  subject: string
  html: string
  from?: string
}): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('[tag-notify] RESEND_API_KEY not set, skipping email to', opts.to)
    return false
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: opts.from ?? SMTP_FROM,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      }),
    })
    if (!res.ok) {
      const body = await res.text()
      console.error('[tag-notify] Resend error', res.status, body)
      return false
    }
    return true
  } catch (err) {
    console.error('[tag-notify] Resend send error', err instanceof Error ? err.message : err)
    return false
  }
}

// ------------------------------------------------------------------ server --

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') return fail('Method not allowed', 405, req)

  const body = await readJsonBody(req)
  if (!body) return fail('Invalid JSON body', 400, req)

  const admin = getAdminClient()

  const commentaryId = String(body.commentary_id ?? '')
  const authorEmail = String(body.author_email ?? '')
  const commentBody = String(body.body ?? '')
  const targetType = String(body.target_type ?? 'general')
  const targetPath = String(body.target_path ?? '')
  const targetId = body.target_id ? String(body.target_id) : null
  const mentions: string[] = Array.isArray(body.mentions) ? (body.mentions as string[]) : []
  const authorUserId = String(body.author_user_id ?? '')

  if (!commentaryId || mentions.length === 0) {
    return json({ ok: true, sent: 0 }, 200, req)
  }

  // ---- build content ----
  const typeLabel: Record<string, string> = {
    post: 'a Post',
    newsletter: 'a Newsletter',
    site_update: 'a Site Update',
    workspace: 'a Workspace',
    image: 'an Image',
    general: 'the page',
  }
  const targetLabel = (typeLabel[targetType] ?? 'an item') + (targetPath ? ` › ${targetPath}` : '')

  const linkPath = targetId
    ? (
      targetType === 'site_update' ? `/site-updates?id=${targetId}&comment=${commentaryId}` :
      targetType === 'post'        ? `/calendario?post=${targetId}&comment=${commentaryId}` :
      targetType === 'newsletter'  ? `/newsletters?id=${targetId}&comment=${commentaryId}` :
      `/workspace?id=${targetId}&comment=${commentaryId}`
    )
    : `/?comment=${commentaryId}`

  // ---- resolve author's Gmail token ----
  let accessToken: string | null = null
  let senderEmail = SMTP_FROM

  if (authorUserId) {
    const { data: tokenRow } = await admin
      .from('manager_provider_tokens')
      .select('*')
      .eq('user_id', authorUserId)
      .single() as { data: ProviderTokenRow | null }

    if (tokenRow) {
      senderEmail = tokenRow.email
      const expiresAt = tokenRow.token_expires_at ? new Date(tokenRow.token_expires_at) : null
      const isExpired = !expiresAt || expiresAt <= new Date()

      if (!isExpired && tokenRow.provider_token) {
        accessToken = tokenRow.provider_token
      } else if (tokenRow.provider_refresh_token) {
        // Attempt refresh
        const refreshed = await refreshGoogleToken(tokenRow.provider_refresh_token)
        if (refreshed) {
          accessToken = refreshed
          // Persist the new token
          await admin
            .from('manager_provider_tokens')
            .update({
              provider_token: refreshed,
              token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', authorUserId)
        }
      }
    }
  }

  // ---- send to each mentioned address ----
  let sent = 0
  const notifiedAt = new Date().toISOString()

  for (const email of mentions) {
    const subject = `${authorEmail} mentioned you in a comment · Earth Guardians`
    const html = buildEmailHtml({ authorEmail, body: commentBody, targetLabel, linkPath })

    let ok = false

    // 1. Try Gmail API (most native — email from real manager address)
    if (accessToken) {
      ok = await sendViaGmail({ accessToken, from: senderEmail, to: email, subject, html })
    }

    // 2. Fallback to Resend
    if (!ok) {
      ok = await sendViaResend({ to: email, subject, html, from: `Earth Guardians <${SMTP_FROM}>` })
    }

    if (ok) {
      await admin
        .from('commentary_tags')
        .update({ notified_at: notifiedAt })
        .eq('commentary_id', commentaryId)
        .eq('tagged_email', email)
        .is('notified_at', null)
      sent++
    }
  }

  return json({ ok: true, sent }, 200, req)
})
