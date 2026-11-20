import { MAX_IMAGE_BYTES } from '~/lib/constants'

export interface ImagePayload {
  base64: string
  mime: string
  name: string
  bytes: number
}

/** Lê um `File` como data URL **sem recompressão** (qualidade integral). */
export function fileToDataUrl(file: File): Promise<ImagePayload> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selecione um arquivo de imagem.'))
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      reject(
        new Error(
          `Imagem muito grande (${formatBytes(file.size)}). Limite: ${formatBytes(MAX_IMAGE_BYTES)}.`,
        ),
      )
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'))
    reader.onload = () =>
      resolve({
        base64: String(reader.result || ''),
        mime: file.type,
        name: file.name,
        bytes: file.size,
      })
    reader.readAsDataURL(file)
  })
}

export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) return 0
  const b64 = dataUrl.slice(comma + 1)
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
  return Math.floor((b64.length * 3) / 4) - padding
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  const v = n / 1024 ** i
  return `${v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`
}

/** Baixa uma data URL como arquivo (download em qualidade integral). */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const blob = dataUrlToBlob(dataUrl)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, body] = dataUrl.split(',')
  const mime = /data:(.*?);/.exec(header || '')?.[1] || 'application/octet-stream'
  const bin = atob(body || '')
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

/** Slug simples p/ nome de arquivo de download. */
export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'imagem'
}
