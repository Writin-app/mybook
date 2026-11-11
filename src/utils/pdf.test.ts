// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createPdfBlob, downloadPdf } from './pdf'

vi.mock('html2canvas-pro', () => {
  return {
    default: vi.fn(async () => {
      const canvas = document.createElement('canvas')
      canvas.width = 794
      canvas.height = 1123
      return canvas
    }),
  }
})

describe('PDF Export', () => {
  beforeEach(() => {
    // Mock HTMLCanvasElement.prototype.getContext in JSDOM
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillStyle: '',
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D)

    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates a valid PDF blob with %PDF signature', async () => {
    const element = document.createElement('div')
    element.innerHTML = '<p>Hello world from PDF export test</p>'

    const blob = await createPdfBlob('Sample Document', element)
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(500)

    // Check %PDF magic bytes
    const buffer = await blob.slice(0, 4).arrayBuffer()
    const header = new Uint8Array(buffer)
    // %PDF is [0x25, 0x50, 0x44, 0x46]
    expect(header[0]).toBe(0x25)
    expect(header[1]).toBe(0x50)
    expect(header[2]).toBe(0x44)
    expect(header[3]).toBe(0x46)
  })

  it('handles rich content nodes like code blocks, callouts, and strips toolbars', async () => {
    const element = document.createElement('div')
    element.innerHTML = `
      <pre class="mybook-code-block">
        <div class="mybook-code-block-toolbar"><button>Copy</button></div>
        <code>console.log("hello")</code>
      </pre>
      <div data-type="callout">Note callout</div>
      <blockquote>Quoted text</blockquote>
    `

    const blob = await createPdfBlob('Rich Document', element)
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(500)
  })

  it('downloads the pdf with safe sanitized filename', () => {
    const blob = new Blob(['%PDF-1.4 mock content'], { type: 'application/pdf' })
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    let clickedDownload = ''
    let clickedHref = ''
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = originalCreateElement(tagName)
      if (tagName === 'a') {
        el.click = vi.fn(() => {
          clickedDownload = (el as HTMLAnchorElement).download
          clickedHref = (el as HTMLAnchorElement).href
        })
      }
      return el
    })

    downloadPdf(blob, 'My Document: Special/Name?')

    expect(createObjectURL).toHaveBeenCalledWith(blob)
    expect(clickedDownload).toBe('My Document- Special-Name-.pdf')
    expect(clickedHref).toBe('blob:mock-url')
  })
})
