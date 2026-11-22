import { ref } from 'vue'

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
 * Uses CDX API with digest collapsing to find changed snapshots.
 * Uses id_ modifier for programmatic fetching without archive toolbar.
 */
export function useWayback() {
  const loading = ref(false)
  const snapshots = ref<WaybackSnapshot[]>([])
  const error = ref<string | null>(null)

  const CDX_BASE = 'https://web.archive.org/cdx/search/cdx'
  const DELAY_MS = 600 // Respect rate limits

  /**
   * Query CDX for snapshots with digest collapsing.
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

    const params = new URLSearchParams({
      url: url,
      output: 'json',
      fl: 'timestamp,original,statuscode,mimetype,digest',
      filter: 'statuscode:200',
      collapse: 'digest', // Only return snapshots with unique content
      ...(options.limit && { limit: String(options.limit) }),
      ...(options.from && { from: options.from }),
      ...(options.to && { to: options.to }),
    })

    try {
      const res = await fetch(`${CDX_BASE}?${params}`, {
        headers: {
          'User-Agent': 'EarthGuardians-Editorial-Calendar/1.0 (Site Update Manager)',
        },
      })

      if (!res.ok) {
        throw new Error(`CDX API error: ${res.status}`)
      }

      const data = await res.json()
      
      // CDX returns header row, parse snapshots
      if (!Array.isArray(data) || data.length < 2) {
        snapshots.value = []
        return []
      }

      // First row is headers, skip it
      const [, ...rows] = data as unknown[][]
      
      snapshots.value = rows.map((row: unknown[]) => ({
        timestamp: String(row[0] || ''),
        original: String(row[1] || ''),
        statuscode: Number(row[2]) || 0,
        mimetype: String(row[3] || ''),
        digest: String(row[4] || ''),
        url: `https://web.archive.org/web/${row[0]}/${url}`,
      }))

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
    // Use id_ for raw content without archive modifications
    const archiveUrl = `https://web.archive.org/web/${timestamp}id_/${url}`
    
    const res = await fetch(archiveUrl, {
      headers: {
        'User-Agent': 'EarthGuardians-Editorial-Calendar/1.0 (Site Update Manager)',
      },
    })

    if (!res.ok) {
      throw new Error(`Failed to fetch snapshot: ${res.status}`)
    }

    return res.text()
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
      if (k < lcs.length && i < oldLines.length && oldLines[i] === lcs[k] && j < newLines.length && newLines[j] === lcs[k]) {
        unchanged++
        i++
        j++
        k++
      } else if (i < oldLines.length && (k >= lcs.length || oldLines[i] !== lcs[k])) {
        const chunk: DiffChunk = { value: oldLines[i], count: 1 }
        const last = deletions[deletions.length - 1]
        if (last && last.value === oldLines[i]) {
          last.count++
        } else {
          deletions.push(chunk)
        }
        i++
      } else if (j < newLines.length && (k >= lcs.length || newLines[j] !== lcs[k])) {
        const chunk: DiffChunk = { value: newLines[j], count: 1 }
        const last = additions[additions.length - 1]
        if (last && last.value === newLines[j]) {
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
      for (let j = 1; j <= n; j++) {
        if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
        }
      }
    }
    
    // Backtrack to find the sequence
    const result: string[] = []
    let i = m, j = n
    while (i > 0 && j > 0) {
      if (a[i - 1] === b[j - 1]) {
        result.unshift(a[i - 1])
        i--
        j--
      } else if (dp[i - 1][j] > dp[i][j - 1]) {
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
      from: timestamp1,
      to: timestamp2,
      ...computeTextDiff(text1, text2),
    }
  }

  /**
   * Get nearest snapshot to a specific date.
   */
  async function getNearestSnapshot(url: string, targetDate: string): Promise<WaybackSnapshot | null> {
    const res = await fetch(
      `https://web.archive.org/wayback/available?url=${encodeURIComponent(url)}&timestamp=${targetDate}`,
      {
        headers: {
          'User-Agent': 'EarthGuardians-Editorial-Calendar/1.0 (Site Update Manager)',
        },
      }
    )

    if (!res.ok) return null

    const data = await res.json()
    
    if (data.archived_snapshots?.closest) {
      const snap = data.archived_snapshots.closest
      return {
        timestamp: snap.timestamp,
        url: snap.url,
        digest: '',
        statuscode: 200,
        mimetype: 'text/html',
        original: url,
      }
    }
    
    return null
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