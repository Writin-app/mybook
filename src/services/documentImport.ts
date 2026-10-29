const supportedExtensions = ['.markdown', '.mybook.md', '.html', '.htm', '.docx', '.rtf', '.md', '.txt']

export function isSupportedDocumentImport(file: Pick<File, 'name'>) {
  const name = file.name.toLocaleLowerCase()
  return supportedExtensions.some((extension) => name.endsWith(extension))
}

export function documentImportTitle(filename: string) {
  const extension = supportedExtensions.find((candidate) => filename.toLocaleLowerCase().endsWith(candidate))
  return (extension ? filename.slice(0, -extension.length) : filename).trim() || 'Imported document'
}

const pendingImports = new Map<string, File>()

export function queueDocumentImport(documentId: string, file: File) {
  pendingImports.set(documentId, file)
}

export function takeDocumentImport(documentId: string) {
  const file = pendingImports.get(documentId)
  pendingImports.delete(documentId)
  return file
}

export function clearDocumentImport(documentId: string) {
  pendingImports.delete(documentId)
}

export function plainTextToHtml(text: string) {
  const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!)

  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

export function normalizeInlineFormatting(html: string) {
  if (typeof DOMParser === 'undefined') return html
  const doc = new DOMParser().parseFromString(html, 'text/html')

  doc.body.querySelectorAll('[style]').forEach((element) => {
    const style = element.getAttribute('style')?.toLocaleLowerCase() ?? ''
    const marks = [
      /font-weight\s*:\s*(?:bold|[6-9]00)/i.test(style) ? 'strong' : '',
      /font-style\s*:\s*italic/i.test(style) ? 'em' : '',
      /text-decoration(?:-line)?\s*:[^;]*underline/i.test(style) ? 'u' : '',
      /text-decoration(?:-line)?\s*:[^;]*line-through/i.test(style) ? 's' : '',
    ].filter(Boolean)

    let content: Node = doc.createDocumentFragment()
    while (element.firstChild) content.appendChild(element.firstChild)
    for (const tag of marks.reverse()) {
      const wrapper = doc.createElement(tag)
      wrapper.appendChild(content)
      content = wrapper
    }
    element.appendChild(content)
    element.removeAttribute('style')
  })

  return doc.body.innerHTML
}

export async function convertRtfToHtml(contents: ArrayBuffer) {
  const { RTFJS } = await import('rtf.js')
  const [html] = await new RTFJS.Document(contents, {}).render()
  if (!html) throw new Error('The RTF file did not contain any readable content.')
  return html.outerHTML
}

export async function convertDocxToHtml(arrayBuffer: ArrayBuffer): Promise<{ html: string; messages: string[] }> {
  const mammoth = (await import('mammoth')).default
  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      convertImage: mammoth.images.imgElement(async (image: { contentType: string; read: (format: string) => Promise<string> }) => {
        const cleanType = ((image.contentType || '').trim().toLowerCase().split(';')[0] || '').trim()
        const isWebCompatible = Boolean(cleanType && /^(?:image\/(?:png|x-png|jpeg|pjpeg|jpg|gif|webp|svg\+xml|avif|bmp|ico|vnd\.microsoft\.icon))$/i.test(cleanType))
        if (!isWebCompatible) {
          return {
            src: '',
            alt: `[Unsupported format: ${cleanType.replace('image/', '') || 'vector drawing'}]`,
          }
        }
        try {
          const base64 = await image.read('base64')
          return {
            src: `data:${cleanType};base64,${base64}`,
          }
        } catch {
          return {
            src: '',
            alt: '[Could not read embedded image]',
          }
        }
      }),
    }
  )
  return {
    html: normalizeInlineFormatting(result.value),
    messages: result.messages.map((m) => m.message),
  }
}

export type EmbeddableFileType = 'pdf' | 'docx' | 'html' | 'csv' | null

export function getEmbeddableFileType(fileName: string, mimeType?: string): EmbeddableFileType {
  const lowerName = (fileName || '').toLowerCase()
  const lowerMime = (mimeType || '').toLowerCase()
  if (lowerName.endsWith('.pdf') || lowerMime === 'application/pdf') return 'pdf'
  if (
    lowerName.endsWith('.docx') ||
    lowerName.endsWith('.doc') ||
    lowerMime.includes('wordprocessingml') ||
    lowerMime.includes('msword')
  ) {
    return 'docx'
  }
  if (lowerName.endsWith('.html') || lowerName.endsWith('.htm') || lowerMime === 'text/html') return 'html'
  if (lowerName.endsWith('.csv') || lowerMime === 'text/csv' || lowerMime === 'application/csv') return 'csv'
  return null
}

export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false
  let i = 0

  const firstLine = text.split(/\r\n|\r|\n/)[0] || ''
  const commaCount = (firstLine.match(/,/g) || []).length
  const tabCount = (firstLine.match(/\t/g) || []).length
  const semiCount = (firstLine.match(/;/g) || []).length
  let delimiter = ','
  if (tabCount > commaCount && tabCount > semiCount) delimiter = '\t'
  else if (semiCount > commaCount && semiCount > tabCount) delimiter = ';'

  while (i < text.length) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          currentField += '"'
          i += 2
          continue
        } else {
          inQuotes = false
          i++
          continue
        }
      } else {
        currentField += char
        i++
        continue
      }
    } else {
      if (char === '"') {
        inQuotes = true
        i++
        continue
      }
      if (char === delimiter) {
        currentRow.push(currentField)
        currentField = ''
        i++
        continue
      }
      if (char === '\r') {
        if (i + 1 < text.length && text[i + 1] === '\n') {
          i++
        }
        currentRow.push(currentField)
        rows.push(currentRow)
        currentRow = []
        currentField = ''
        i++
        continue
      }
      if (char === '\n') {
        currentRow.push(currentField)
        rows.push(currentRow)
        currentRow = []
        currentField = ''
        i++
        continue
      }
      currentField += char
      i++
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField)
    rows.push(currentRow)
  }

  return rows.filter((r) => r.some((cell) => cell.trim().length > 0))
}

export function csvToHtmlTable(csvText: string): string {
  const rows = parseCsvRows(csvText)
  if (rows.length === 0) return '<p></p>'

  const escapeHtml = (val: string) =>
    val.replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]!)

  const maxCols = Math.max(...rows.map((r) => r.length), 1)

  const htmlRows = rows.map((row, rowIndex) => {
    const cellTag = rowIndex === 0 ? 'th' : 'td'
    const paddedRow = [...row]
    while (paddedRow.length < maxCols) {
      paddedRow.push('')
    }
    const cells = paddedRow
      .map((cell) => `<${cellTag}><p>${escapeHtml(cell.trim())}</p></${cellTag}>`)
      .join('')
    return `<tr>${cells}</tr>`
  })

  return `<table><tbody>${htmlRows.join('')}</tbody></table>`
}
