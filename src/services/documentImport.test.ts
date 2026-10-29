// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import {
  convertRtfToHtml,
  csvToHtmlTable,
  documentImportTitle,
  getEmbeddableFileType,
  isSupportedDocumentImport,
  normalizeInlineFormatting,
  parseCsvRows,
  plainTextToHtml,
} from './documentImport'

describe('document import helpers', () => {
  it.each(['notes.md', 'notes.markdown', 'notes.txt', 'notes.docx', 'notes.html', 'notes.htm', 'notes.rtf', 'notes.mybook.md'])(
    'accepts %s',
    (name) => expect(isSupportedDocumentImport({ name })).toBe(true),
  )

  it('rejects unsupported formats', () => {
    expect(isSupportedDocumentImport({ name: 'report.pdf' })).toBe(false)
    expect(isSupportedDocumentImport({ name: 'sheet.xlsx' })).toBe(false)
  })

  it('identifies embeddable file types accurately', () => {
    expect(getEmbeddableFileType('doc.pdf')).toBe('pdf')
    expect(getEmbeddableFileType('file.bin', 'application/pdf')).toBe('pdf')
    expect(getEmbeddableFileType('contract.docx')).toBe('docx')
    expect(getEmbeddableFileType('page.html')).toBe('html')
    expect(getEmbeddableFileType('data.csv')).toBe('csv')
    expect(getEmbeddableFileType('data.txt')).toBeNull()
    expect(getEmbeddableFileType('archive.zip')).toBeNull()
  })

  it('parses standard and quoted CSV text into rows', () => {
    const csv = 'Name,Role,"Salary, USD"\nAlice,Engineer,"120,000"\nBob,"Senior ""Lead"" Designer",95000'
    const rows = parseCsvRows(csv)
    expect(rows).toEqual([
      ['Name', 'Role', 'Salary, USD'],
      ['Alice', 'Engineer', '120,000'],
      ['Bob', 'Senior "Lead" Designer', '95000'],
    ])
  })

  it('parses tab-delimited and semicolon-delimited tabular data', () => {
    const tsv = 'Item\tCount\tPrice\nApple\t10\t1.50'
    expect(parseCsvRows(tsv)).toEqual([
      ['Item', 'Count', 'Price'],
      ['Apple', '10', '1.50'],
    ])

    const semi = 'Col1;Col2\nVal1;Val2'
    expect(parseCsvRows(semi)).toEqual([
      ['Col1', 'Col2'],
      ['Val1', 'Val2'],
    ])
  })

  it('converts CSV text to an HTML table with header and cells', () => {
    const csv = 'City,Country\nParis,France\nTokyo,Japan'
    const tableHtml = csvToHtmlTable(csv)
    expect(tableHtml).toContain('<table><tbody>')
    expect(tableHtml).toContain('<th><p>City</p></th><th><p>Country</p></th>')
    expect(tableHtml).toContain('<td><p>Paris</p></td><td><p>France</p></td>')
    expect(tableHtml).toContain('<td><p>Tokyo</p></td><td><p>Japan</p></td>')
  })

  it('removes the complete recognized extension from the new document title', () => {
    expect(documentImportTitle('Project Notes.mybook.md')).toBe('Project Notes')
    expect(documentImportTitle('Project Notes.markdown')).toBe('Project Notes')
  })

  it('converts plain text paragraphs and line breaks into escaped HTML', () => {
    expect(plainTextToHtml('First <line>\ncontinued\n\nSecond & final')).toBe(
      '<p>First &lt;line&gt;<br>continued</p><p>Second &amp; final</p>',
    )
  })

  it('keeps inline rich text marks when source HTML uses inline styles', () => {
    expect(normalizeInlineFormatting('<p><span style="font-weight: 700; font-style: italic; text-decoration: underline">Keep this</span></p>'))
      .toContain('<strong><em><u>Keep this</u></em></strong>')
  })

  it('converts RTF content to HTML in the browser', async () => {
    const rtf = String.raw`{\rtf1\ansi\deff0 {\fonttbl {\f0 Calibri;}}\f0\fs24 Hello \b bold\b0 world.\par}`
    const bytes = new TextEncoder().encode(rtf)
    const html = await convertRtfToHtml(bytes.buffer)

    expect(html).toContain('Hello')
    expect(html).toContain('bold')
    expect(normalizeInlineFormatting(html)).toMatch(/<strong>bold<\/strong>/)
  })
})
