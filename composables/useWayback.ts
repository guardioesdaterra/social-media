import { ref } from 'vue'
import { useSupabase, edgeFunctionUrl } from '~/lib/supabase'
import { isMock } from '~/lib/mock'

export interface WaybackSnapshot {
  timestamp: string
  url: string
  digest: string
  statuscode: number
  mimetype: string
  original: string
}

export interface WaybackDiff {
  from: string
  to: string
  additions: DiffChunk[]
  deletions: DiffChunk[]
  unchanged: number
}

export interface DiffChunk {
  value: string
  count: number
}

export interface WaybackSnapshotWithContent extends WaybackSnapshot {
  content: string
  textContent: string
}

/**
 * Wayback Machine integration for site updates.
 *
 * All archive.org calls are proxied through the `wayback-cdx` Supabase edge
 * function because web.archive.org does not send
 * `Access-Control-Allow-Origin`, which blocks direct browser fetch from
 * GitHub Pages (CORS). The edge function runs server-side and returns
 * CORS-safe JSON.
 */
export function useWayback() {
  const loading = ref(false)
  const snapshots = ref<WaybackSnapshot[]>([])
  const error = ref<string | null>(null)

  const supabase = useSupabase()

  /** Bearer token from the current Supabase session. */
  async function authHeaders(): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) {
      throw new Error('Your session expired. Please sign in again.')
    }
    return {
      Authorization: `Bearer ${token}`,
    }
  }

  /** Call the wayback-cdx edge function with the given op + query params. */
  async function cdxRequest(
    op: string,
    params: Record<string, string>,
  ): Promise<Response> {
    const base = edgeFunctionUrl('wayback-cdx')
    const url = new URL(base)
    url.searchParams.set('op', op)
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value)
    }

    const res = await fetch(url.toString(), {
      headers: {
        ...(await authHeaders()),
      },
    })
    return res
  }

  /** Parse a JSON edge-function response, throwing a descriptive error on failure. */
  async function jsonResponse(res: Response): Promise<unknown> {
    const text = await res.text()
    if (!res.ok) {
      throw new Error(`Wayback proxy error: ${res.status} ${text.slice(0, 300)}`)
    }
    if (!text) return null
    try {
      return JSON.parse(text)
    } catch {
      throw new Error(`Invalid JSON from wayback proxy (HTTP ${res.status})`)
    }
  }

  /**
   * Query CDX for snapshots with digest collapsing via the edge function.
   * Returns only snapshots where content actually changed.
   */
  async function getSnapshots(
    url: string,
    options: {
      limit?: number
      from?: string
      to?: string
    } = {}
  ): Promise<WaybackSnapshot[]> {
    loading.value = true
    error.value = null

    if (isMock()) {
      snapshots.value = []
      return []
    }

    try {
      const res = await cdxRequest('cdx', {
        url,
        ...(options.limit ? { limit: String(options.limit) } : {}),
        ...(options.from ? { from: options.from } : {}),
        ...(options.to ? { to: options.to } : {}),
      })

      const data = (await jsonResponse(res)) as {
        snapshots?: WaybackSnapshot[]
        count?: number
      } | null

      snapshots.value = data?.snapshots ?? []
      return snapshots.value
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch snapshots'
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * Get snapshot content using id_ modifier (no archive toolbar).
   */
  async function getSnapshotContent(url: string, timestamp: string): Promise<string> {
    if (isMock()) return ''

    const res = await cdxRequest('snapshot', { url, timestamp })
    const data = (await jsonResponse(res)) as {
      content?: string
    } | null
    return data?.content ?? ''
  }

  /**
   * Extract readable text from HTML, stripping scripts, styles, nav.
   */
  function extractText(html: string): string {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    
    // Remove unwanted elements
    const removeSelectors = ['script', 'style', 'nav', 'footer', 'header', 'aside', 'iframe', 'noscript']
    removeSelectors.forEach(sel => {
      doc.querySelectorAll(sel).forEach(el => el.remove())
    })

    // Get text content
    return doc.body.textContent?.trim() || ''
  }

  /**
   * Compute text diff between two snapshots.
   */
  function computeTextDiff(oldText: string, newText: string): WaybackDiff {
    const oldLines = oldText.split('\n').filter(l => l.trim())
    const newLines = newText.split('\n').filter(l => l.trim())
    
    const lcs = longestCommonSubsequence(oldLines, newLines)
    
    const deletions: DiffChunk[] = []
    const additions: DiffChunk[] = []
    let unchanged = 0
    
    // This is a simplified diff - could use 'diff' library for more sophisticated results
    let i = 0, j = 0, k = 0
    
    while (i < oldLines.length || j < newLines.length) {
      const oldLine = oldLines[i]
      const newLine = newLines[j]
      const lcsLine = lcs[k]
      if (
        k < lcs.length &&
        oldLine !== undefined && oldLine === lcsLine &&
        newLine !== undefined && newLine === lcsLine
      ) {
        unchanged++
        i++
        j++
        k++
      } else if (oldLine !== undefined && (k >= lcs.length || oldLine !== lcsLine)) {
        const chunk: DiffChunk = { value: oldLine, count: 1 }
        const last = deletions[deletions.length - 1]
        if (last && last.value === oldLine) {
          last.count++
        } else {
          deletions.push(chunk)
        }
        i++
      } else if (newLine !== undefined && (k >= lcs.length || newLine !== lcsLine)) {
        const chunk: DiffChunk = { value: newLine, count: 1 }
        const last = additions[additions.length - 1]
        if (last && last.value === newLine) {
          last.count++
        } else {
          additions.push(chunk)
        }
        j++
      }
    }

    return {
      from: '',
      to: '',
      deletions,
      additions,
      unchanged,
    }
  }

  /**
   * LCS for diff computation.
   */
  function longestCommonSubsequence(a: string[], b: string[]): string[] {
    const m = a.length, n = b.length
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))
    
    for (let i = 1; i <= m; i++) {
      const row = dp[i]
      const prevRow = dp[i - 1]
      if (!row || !prevRow) continue
      for (let j = 1; j <= n; j++) {
        if (a[i - 1] === b[j - 1]) {
          row[j] = (prevRow[j - 1] ?? 0) + 1
        } else {
          row[j] = Math.max(prevRow[j] ?? 0, row[j - 1] ?? 0)
        }
      }
    }
    
    // Backtrack to find the sequence
    const result: string[] = []
    let i = m, j = n
    while (i > 0 && j > 0) {
      const ai = a[i - 1]
      const bj = b[j - 1]
      if (ai !== undefined && ai === bj) {
        result.unshift(ai)
        i--
        j--
      } else if ((dp[i - 1]?.[j] ?? 0) > (dp[i]?.[j - 1] ?? 0)) {
        i--
      } else {
        j--
      }
    }
    
    return result
  }

  /**
   * Get diff between two snapshots.
   */
  async function getDiff(url: string, timestamp1: string, timestamp2: string): Promise<WaybackDiff> {
    const [content1, content2] = await Promise.all([
      getSnapshotContent(url, timestamp1),
      getSnapshotContent(url, timestamp2),
    ])

    const text1 = extractText(content1)
    const text2 = extractText(content2)

    return {
      ...computeTextDiff(text1, text2),
      from: timestamp1,
      to: timestamp2,
    }
  }

  /**
   * Get nearest snapshot to a specific date.
   */
  async function getNearestSnapshot(url: string, targetDate: string): Promise<WaybackSnapshot | null> {
    if (isMock()) return null

    const res = await cdxRequest('available', { url, timestamp: targetDate })
    const data = (await jsonResponse(res)) as {
      snapshot?: {
        timestamp: string
        url: string
        original: string
        statuscode: number
        mimetype: string
        digest: string
      } | null
    } | null

    if (!data?.snapshot) return null

    const snap = data.snapshot
    return {
      timestamp: snap.timestamp,
      url: snap.url,
      digest: snap.digest,
      statuscode: snap.statuscode,
      mimetype: snap.mimetype,
      original: snap.original,
    }
  }

  /**
   * Get Wayback replay URL (for human viewing with toolbar).
   */
  function getReplayUrl(url: string, timestamp?: string): string {
    if (timestamp) {
      return `https://web.archive.org/web/${timestamp}/${url}`
    }
    return `https://web.archive.org/web/2/${url}`
  }

  return {
    loading,
    snapshots,
    error,
    getSnapshots,
    getSnapshotContent,
    getDiff,
    getNearestSnapshot,
    getReplayUrl,
    extractText,
    computeTextDiff,
  }
}