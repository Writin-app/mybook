import { describe, expect, it } from 'vitest'

import { normalizeLinkUrl } from './linkUrl'

describe('normalizeLinkUrl', () => {
  it('keeps allowed absolute urls', () => {
    expect(normalizeLinkUrl(' https://example.com/a ')).toBe('https://example.com/a')
    expect(normalizeLinkUrl('mailto:a@b.co')).toBe('mailto:a@b.co')
  })

  it('adds https to bare domains, including ones with a port', () => {
    expect(normalizeLinkUrl('example.com')).toBe('https://example.com')
    expect(normalizeLinkUrl('localhost:3000/x')).toBe('https://localhost:3000/x')
  })

  it('keeps in-app paths and anchors', () => {
    expect(normalizeLinkUrl('/document/abc')).toBe('/document/abc')
    expect(normalizeLinkUrl('#section')).toBe('#section')
  })

  it('rejects empty input and unsafe schemes', () => {
    expect(normalizeLinkUrl('   ')).toBeNull()
    expect(normalizeLinkUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeLinkUrl('data:text/html,hi')).toBeNull()
  })
})
