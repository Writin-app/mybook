export interface ParsedFileInfo {
  src: string
  name: string
  extension?: string
}

/**
 * Derives a human-readable file name and extension from a file URL or path.
 */
export function parseFileUrl(candidate: string): ParsedFileInfo | null {
  const trimmed = (candidate || '').trim()
  if (!trimmed) return null

  try {
    let fileName = ''
    if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
      return {
        src: trimmed,
        name: 'Attachment',
      }
    }

    const urlObj = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
    const pathname = urlObj.pathname
    const lastSlash = pathname.lastIndexOf('/')
    const candidateName = lastSlash >= 0 ? pathname.substring(lastSlash + 1) : pathname
    if (candidateName) {
      fileName = decodeURIComponent(candidateName)
    } else {
      fileName = urlObj.hostname
    }

    return {
      src: urlObj.href,
      name: fileName || 'File',
    }
  } catch {
    return {
      src: trimmed,
      name: 'File',
    }
  }
}

/**
 * Downloads a file locally from blob/data URL or external URL.
 */
export async function downloadFile(src: string, fileName = 'attachment'): Promise<void> {
  if (!src) return

  const cleanFileName = fileName.trim() || 'attachment'

  try {
    if (src.startsWith('data:') || src.startsWith('blob:')) {
      const anchor = document.createElement('a')
      anchor.href = src
      anchor.download = cleanFileName
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      return
    }

    const response = await fetch(src, { mode: 'cors' })
    if (!response.ok) throw new Error(`HTTP error ${response.status}`)
    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)

    const anchor = document.createElement('a')
    anchor.href = blobUrl
    anchor.download = cleanFileName
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
  } catch {
    // Fallback: open URL in new window/tab
    window.open(src, '_blank', 'noopener,noreferrer')
  }
}

/**
 * Converts a data URL to a Blob.
 */
export function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const commaIndex = dataUrl.indexOf(',')
    if (commaIndex === -1) return null
    const meta = dataUrl.slice(0, commaIndex)
    const data = dataUrl.slice(commaIndex + 1)
    const mimeMatch = meta.match(/:(.*?)(?:;|$)/)
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream'
    const isBase64 = meta.includes(';base64')

    if (isBase64) {
      const binary = atob(data)
      const len = binary.length
      const buffer = new Uint8Array(len)
      for (let i = 0; i < len; i++) {
        buffer[i] = binary.charCodeAt(i)
      }
      return new Blob([buffer], { type: mime })
    }

    const decoded = decodeURIComponent(data)
    return new Blob([decoded], { type: mime })
  } catch {
    return null
  }
}

/**
 * Decodes a data URL into UTF-8 plain text.
 */
export function decodeDataUrlToText(dataUrl: string): string {
  try {
    const commaIndex = dataUrl.indexOf(',')
    if (commaIndex === -1) return ''
    const meta = dataUrl.slice(0, commaIndex)
    const data = dataUrl.slice(commaIndex + 1)
    const isBase64 = meta.includes(';base64')
    if (isBase64) {
      const binary = atob(data)
      const len = binary.length
      const bytes = new Uint8Array(len)
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i)
      }
      return new TextDecoder().decode(bytes)
    }
    return decodeURIComponent(data)
  } catch {
    return ''
  }
}

/**
 * Decodes a data URL into an ArrayBuffer.
 */
export function decodeDataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  try {
    const commaIndex = dataUrl.indexOf(',')
    if (commaIndex === -1) return new ArrayBuffer(0)
    const meta = dataUrl.slice(0, commaIndex)
    const data = dataUrl.slice(commaIndex + 1)
    const isBase64 = meta.includes(';base64')
    if (isBase64) {
      const binary = atob(data)
      const len = binary.length
      const bytes = new Uint8Array(len)
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i)
      }
      return bytes.buffer
    }
    const decoded = decodeURIComponent(data)
    return new TextEncoder().encode(decoded).buffer
  } catch {
    return new ArrayBuffer(0)
  }
}
