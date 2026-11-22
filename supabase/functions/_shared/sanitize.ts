/**
 * supabase/functions/_shared/sanitize.ts
 * @why Lightweight HTML sanitizer for user-supplied rich text (newsletter
 *  body, site update content). Runs on the server before storage so the
 *  browser never needs to trust raw HTML.
 *
 * Strategy:
 *  1. Drop <script> and <style> blocks entirely (with contents), including
 *     unclosed blocks.
 *  2. Strip event-handler attributes (onclick, onerror, onload, ...), with
 *     or without a leading slash.
 *  3. Strip javascript: / vbscript: / data: URLs from href / src, after
 *     decoding HTML entities so &#106;avascript: cannot slip through.
 *  4. Drop style attributes containing expression() or behavior:.
 *
 * This is defense-in-depth: only @earthguardians.org managers can write,
 * but sanitizing at storage protects every consumer of the HTML.
 */

const SCRIPT_STYLE_RE = /<(script|style)\b[\s\S]*?(?:<\/\1\s*>|$)/gi
const EVENT_HANDLER_RE = /\s+\/?on[a-zA-Z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi
const DANGEROUS_URL_RE = /\s(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi
const DANGEROUS_SCHEME_RE = /^(?:javascript|vbscript|data|mocha|livescript):/i
const STYLE_ATTR_RE = /\s+style\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi
const DANGEROUS_CSS_RE = /expression\s*\(|behavior\s*:/i
// eslint-disable-next-line no-control-regex -- strip control chars used to obfuscate URL schemes
const SCHEME_OBFUSCATION_RE = /[\s\x00-\x1f]+/g

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&colon;/gi, ':')
    .replace(/&Tab;/gi, '\t')
    .replace(/&NewLine;/gi, '\n')
    .replace(/&amp;/gi, '&')
}

function isDangerousUrl(value: string): boolean {
  // Decode entities and remove whitespace/control chars used to obfuscate
  // the scheme (e.g. "jav&#x09;ascript:alert(1)").
  const decoded = decodeEntities(value.trim()).replace(SCHEME_OBFUSCATION_RE, '')
  return DANGEROUS_SCHEME_RE.test(decoded)
}

export function sanitizeHtml(input: unknown): string {
  if (typeof input !== 'string') return ''
  let html = input

  // 1. Remove script/style blocks and contents (closed or unclosed).
  html = html.replace(SCRIPT_STYLE_RE, '')

  // 2. Strip event handler attributes.
  html = html.replace(EVENT_HANDLER_RE, '')

  // 3. Strip dangerous URL schemes from href/src.
  html = html.replace(DANGEROUS_URL_RE, (match, dq, sq, bare) => {
    const value = dq ?? sq ?? bare
    if (value && isDangerousUrl(value)) return ''
    return match
  })

  // 4. Drop style attributes with dangerous CSS.
  html = html.replace(STYLE_ATTR_RE, (match, dq, sq, bare) => {
    const value = dq ?? sq ?? bare
    if (value && DANGEROUS_CSS_RE.test(decodeEntities(value))) return ''
    return match
  })

  return html.trim()
}
