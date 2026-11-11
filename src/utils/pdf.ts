import html2canvas from 'html2canvas-pro'
import { jsPDF } from 'jspdf'

export interface PdfExportOptions {
  marginMm?: number
  scale?: number
}

export async function createPdfBlob(
  title: string,
  contentElement: HTMLElement,
  options: PdfExportOptions = {}
): Promise<Blob> {
  const { marginMm = 15, scale = 2 } = options

  // Clean wrapper container for high-fidelity export positioned safely in DOM bounds
  const wrapper = document.createElement('div')
  wrapper.className = 'mybook-pdf-export'
  wrapper.style.position = 'absolute'
  wrapper.style.left = '0'
  wrapper.style.top = '0'
  wrapper.style.zIndex = '-9999'
  wrapper.style.width = '794px' // Standard A4 width at 96 DPI (~210mm)
  wrapper.style.backgroundColor = '#ffffff'
  wrapper.style.color = '#111827'
  wrapper.style.padding = '36px 40px'
  wrapper.style.fontFamily = 'Figtree, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  wrapper.style.boxSizing = 'border-box'

  // Document title heading
  const titleEl = document.createElement('h1')
  titleEl.textContent = title.trim() || 'Untitled'
  titleEl.style.fontSize = '34px'
  titleEl.style.fontWeight = '800'
  titleEl.style.lineHeight = '40px'
  titleEl.style.color = '#111827'
  titleEl.style.margin = '0 0 20px 0'
  wrapper.appendChild(titleEl)

  // Clone document content and strip interactive UI controls
  const clone = contentElement.cloneNode(true) as HTMLElement
  clone
    .querySelectorAll(
      '.mybook-block-actions, .mybook-block-controls, .mybook-block-drag-handle, .mybook-code-block-toolbar, .mybook-image-block-toolbar, .mybook-table-actions, .mybook-callout-emoji-button, .mybook-hover-actions, [role="toolbar"], .no-print'
    )
    .forEach((el) => el.remove())

  clone
    .querySelectorAll('.mybook-empty-block-placeholder, .mybook-picker-placeholder')
    .forEach((el) => {
      el.classList.remove('mybook-empty-block-placeholder', 'mybook-picker-placeholder')
    })

  // Normalize code blocks with solid backgrounds and borders
  clone.querySelectorAll('pre, pre.mybook-code-block').forEach((pre) => {
    const el = pre as HTMLElement
    el.style.backgroundColor = '#f4f4f5'
    el.style.border = '1px solid #e4e4e7'
    el.style.borderRadius = '8px'
    el.style.padding = '14px 16px'
    el.style.margin = '14px 0'
    el.style.color = '#18181b'
    el.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
    el.style.overflow = 'visible'
    el.style.whiteSpace = 'pre-wrap'
    el.style.wordBreak = 'break-word'

    el.querySelectorAll('code').forEach((code) => {
      const codeEl = code as HTMLElement
      codeEl.style.backgroundColor = 'transparent'
      codeEl.style.border = 'none'
      codeEl.style.padding = '0'
      codeEl.style.color = '#18181b'
      codeEl.style.fontFamily = 'inherit'
      codeEl.style.fontSize = '13px'
      codeEl.style.lineHeight = '1.6'
    })
  })

  // Normalize inline code
  clone.querySelectorAll('code:not(pre code)').forEach((code) => {
    const el = code as HTMLElement
    el.style.backgroundColor = '#f4f4f5'
    el.style.border = '1px solid #e4e4e7'
    el.style.borderRadius = '4px'
    el.style.padding = '2px 6px'
    el.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
    el.style.fontSize = '0.9em'
    el.style.color = '#0f172a'
  })

  // Normalize blockquotes
  clone.querySelectorAll('blockquote').forEach((bq) => {
    const el = bq as HTMLElement
    el.style.backgroundColor = '#f8fafc'
    el.style.borderLeft = '4px solid #94a3b8'
    el.style.borderRadius = '0 6px 6px 0'
    el.style.padding = '10px 16px'
    el.style.margin = '12px 0'
    el.style.color = '#334155'
    el.style.fontStyle = 'italic'
  })

  // Normalize callouts
  clone.querySelectorAll('.mybook-callout, [data-type="callout"]').forEach((co) => {
    const el = co as HTMLElement
    const kind = el.getAttribute('data-kind') || 'info'
    const borderColor = kind === 'warning' ? '#d97706' : kind === 'success' ? '#16a34a' : '#2563eb'
    const bgColor = kind === 'warning' ? '#fffbeb' : kind === 'success' ? '#f0fdf4' : '#eff6ff'
    el.style.backgroundColor = bgColor
    el.style.border = '1px solid #e2e8f0'
    el.style.borderLeft = `4px solid ${borderColor}`
    el.style.borderRadius = '8px'
    el.style.padding = '12px 16px'
    el.style.margin = '12px 0'
    el.style.color = '#1e293b'
  })

  // Normalize tables
  clone.querySelectorAll('table').forEach((table) => {
    const el = table as HTMLElement
    el.style.borderCollapse = 'collapse'
    el.style.width = '100%'
    el.style.margin = '14px 0'
    el.querySelectorAll('th').forEach((th) => {
      const header = th as HTMLElement
      header.style.border = '1px solid #d1d5db'
      header.style.padding = '8px 12px'
      header.style.backgroundColor = '#f3f4f6'
      header.style.color = '#111827'
      header.style.fontWeight = '600'
    })
    el.querySelectorAll('td').forEach((td) => {
      const cell = td as HTMLElement
      cell.style.border = '1px solid #d1d5db'
      cell.style.padding = '8px 12px'
      cell.style.backgroundColor = '#ffffff'
      cell.style.color = '#111827'
    })
  })

  // Normalize horizontal rules
  clone.querySelectorAll('hr').forEach((hr) => {
    const el = hr as HTMLElement
    el.style.border = '0'
    el.style.borderTop = '1px solid #e5e7eb'
    el.style.margin = '20px 0'
  })

  // Normalize typography
  clone.querySelectorAll('h1').forEach((h1) => {
    const el = h1 as HTMLElement
    el.style.fontSize = '30px'
    el.style.lineHeight = '36px'
    el.style.fontWeight = '700'
    el.style.color = '#111827'
    el.style.margin = '20px 0 10px 0'
  })
  clone.querySelectorAll('h2').forEach((h2) => {
    const el = h2 as HTMLElement
    el.style.fontSize = '24px'
    el.style.lineHeight = '32px'
    el.style.fontWeight = '700'
    el.style.color = '#111827'
    el.style.margin = '18px 0 8px 0'
  })
  clone.querySelectorAll('h3').forEach((h3) => {
    const el = h3 as HTMLElement
    el.style.fontSize = '22px'
    el.style.lineHeight = '28px'
    el.style.fontWeight = '700'
    el.style.color = '#111827'
    el.style.margin = '16px 0 6px 0'
  })
  clone.querySelectorAll('h4').forEach((h4) => {
    const el = h4 as HTMLElement
    el.style.fontSize = '20px'
    el.style.lineHeight = '28px'
    el.style.fontWeight = '700'
    el.style.color = '#111827'
    el.style.margin = '14px 0 6px 0'
  })
  clone.querySelectorAll('p').forEach((p) => {
    const el = p as HTMLElement
    el.style.fontSize = '16px'
    el.style.lineHeight = '24px'
    el.style.color = '#111827'
  })

  clone.style.color = '#111827'
  clone.style.backgroundColor = 'transparent'

  wrapper.appendChild(clone)
  document.body.appendChild(wrapper)

  try {
    const canvas = await html2canvas(wrapper, {
      scale,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0,
      width: 794,
      windowWidth: 794,
    })

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    const pdfPageWidth = 210
    const pdfPageHeight = 297
    const contentWidthMm = pdfPageWidth - marginMm * 2
    const pageContentHeightMm = pdfPageHeight - marginMm * 2

    const pxPerMm = canvas.width / contentWidthMm
    const canvasPageHeight = Math.floor(pageContentHeightMm * pxPerMm)

    let yOffset = 0
    let pageIndex = 0

    while (yOffset < canvas.height) {
      if (pageIndex > 0) {
        pdf.addPage()
      }

      const sliceHeight = Math.min(canvasPageHeight, canvas.height - yOffset)
      const pageCanvas = document.createElement('canvas')
      pageCanvas.width = canvas.width
      pageCanvas.height = sliceHeight

      const ctx = pageCanvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
        ctx.drawImage(
          canvas,
          0,
          yOffset,
          canvas.width,
          sliceHeight,
          0,
          0,
          canvas.width,
          sliceHeight
        )
      }

      const sliceHeightMm = (sliceHeight * contentWidthMm) / canvas.width
      pdf.addImage(
        pageCanvas.toDataURL('image/png'),
        'PNG',
        marginMm,
        marginMm,
        contentWidthMm,
        sliceHeightMm
      )

      yOffset += sliceHeight
      pageIndex += 1
    }

    return pdf.output('blob')
  } catch (error) {
    console.error('Failed to export PDF via html2canvas-pro:', error)
    throw error
  } finally {
    if (wrapper.parentNode) {
      document.body.removeChild(wrapper)
    }
  }
}

export function downloadPdf(blob: Blob, title: string) {
  const safeName = (title.trim() || 'Untitled').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 120)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${safeName}.pdf`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
