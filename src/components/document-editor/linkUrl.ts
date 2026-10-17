const allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:']

/** Returns a safe absolute URL for a link, or null when the input is empty or uses a disallowed scheme. */
export function normalizeLinkUrl(input: string): string | null {
  const value = input.trim()
  if (!value) return null
  if (/^[/#]/.test(value)) return value
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) && !/^[^/?#]*:\d+(?:[/?#]|$)/.test(value)
  const candidate = hasScheme ? value : `https://${value}`
  try {
    const url = new URL(candidate)
    return allowedProtocols.includes(url.protocol) ? candidate : null
  } catch {
    return null
  }
}
