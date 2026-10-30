import type { JSONContent } from '@tiptap/core'
import { describe, expect, it } from 'vitest'

import type { DatabaseAttrs } from '../components/document-editor/databaseModel'
import { documentToMyBookMarkdown, myBookMarkdownToDocument, parseMyBookMarkdown } from './mybookMarkdown'

const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content })
const text = (value: string, marks?: JSONContent['marks']): JSONContent => ({ type: 'text', text: value, ...(marks ? { marks } : {}) })
const paragraph = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', ...(content.length ? { content } : {}) })
const heading = (level: 1 | 2 | 3 | 4, value: string): JSONContent => ({ type: 'heading', attrs: { level }, content: [text(value)] })
const listItem = (...content: JSONContent[]): JSONContent => ({ type: 'listItem', content })
const taskItem = (checked: boolean, ...content: JSONContent[]): JSONContent => ({ type: 'taskItem', attrs: { checked }, content })
const tableCell = (...content: JSONContent[]): JSONContent => ({ type: 'tableCell', attrs: { colspan: 1, rowspan: 1, colwidth: null }, content })
const tableHeader = (...content: JSONContent[]): JSONContent => ({ type: 'tableHeader', attrs: { colspan: 1, rowspan: 1, colwidth: null }, content })
const tableRow = (...content: JSONContent[]): JSONContent => ({ type: 'tableRow', content })
const databaseAttrs = (): DatabaseAttrs => ({
  version: 1,
  id: 'db_tasks',
  title: 'Tasks 😀',
  columns: [
    { id: 'col_name', name: 'Name', type: 'text' },
    { id: 'col_number', name: 'Estimate', type: 'number' },
    {
      id: 'col_select',
      name: 'Priority',
      type: 'select',
      options: [
        { id: 'opt_high', label: 'High', color: 'red' },
        { id: 'opt_medium', label: 'Medium', color: 'yellow' },
        { id: 'opt_low', label: 'Low', color: 'green' },
      ],
    },
    {
      id: 'col_status',
      name: 'Status',
      type: 'status',
      options: [
        { id: 'opt_todo', label: 'Not started', color: 'gray' },
        { id: 'opt_progress', label: 'In progress', color: 'blue' },
        { id: 'opt_done', label: 'Done', color: 'green' },
      ],
    },
    { id: 'col_date', name: 'Due', type: 'date' },
    { id: 'col_done', name: 'Done?', type: 'checkbox' },
  ],
  rows: [
    { id: 'row_1', values: { col_name: 'Homepage', col_number: 42, col_select: 'opt_high', col_status: 'opt_done', col_date: '2026-09-04', col_done: true } },
    { id: 'row_2', values: { col_name: 'Hindi नमस्ते', col_number: -12.5, col_select: 'opt_medium', col_done: false } },
    { id: 'row_3', values: { col_name: 'Arabic مرحبا', col_status: 'opt_todo', col_date: '2026-12-31' } },
    { id: 'row_4', values: {} },
  ],
})
const databaseBlock = (attrs = databaseAttrs()): JSONContent => ({ type: 'databaseBlock', attrs })
const tableOfContentsBlock = (): JSONContent => ({ type: 'tableOfContents' })
it('preserves date and time block values in Markdown', () => {
  const block: JSONContent = { type: 'dateTimeBlock', attrs: { value: '2026-10-03T14:30:00.000Z', includeTime: true } }
  const markdown = documentToMyBookMarkdown('Date & Time', doc(block))
  expect(markdown).toContain(':::date-time')
  expect(myBookMarkdownToDocument(markdown).content?.[0]).toMatchObject(block)
})
it('round trips inline date and time mentions between paragraph text', () => {
  const dateTime = { type: 'dateTimeBlock', attrs: { value: '2026-10-03T14:30:00.000Z', includeTime: true, endDateEnabled: true, endValue: '2026-10-03T15:30:00.000Z', use24Hour: false, dateFormat: 'relative' } }
  const source = doc({ type: 'paragraph', content: [text('Meet on '), dateTime, text(' at the cafe.') ] })
  const markdown = documentToMyBookMarkdown('Inline date', source)
  const roundTrip = myBookMarkdownToDocument(markdown)
  expect(roundTrip.content?.[0]?.content).toEqual(source.content?.[0]?.content)
})
const documentLinkBlock = (targetId = 'doc_b', label = 'Project Notes'): JSONContent => ({ type: 'documentLink', attrs: { targetId, label } })
const bookmarkBlock = (): JSONContent => ({ type: 'bookmarkBlock', attrs: { href: 'https://example.com/docs/writin-links', title: 'Writin links', domain: 'example.com', description: '' } })
it('preserves bookmark preview images and the original query in Markdown', () => {
  const bookmark = bookmarkBlock()
  bookmark.attrs = { ...bookmark.attrs, href: 'https://example.com/icons?search=delete', image: 'https://example.com/preview.png' }
  const markdown = documentToMyBookMarkdown('Bookmarks', doc(bookmark))
  expect(myBookMarkdownToDocument(markdown).content?.[0]?.attrs).toMatchObject(bookmark.attrs!)
})
it('preserves website mention appearance and site name in Markdown', () => {
  const mention = bookmarkBlock()
  mention.attrs = { ...mention.attrs, appearance: 'mention', siteName: 'Example' }
  const markdown = documentToMyBookMarkdown('Mentions', doc(mention))
  expect(myBookMarkdownToDocument(markdown).content?.[0]?.attrs).toMatchObject(mention.attrs!)
})
const embedBlock = (): JSONContent => ({ type: 'embedBlock', attrs: { provider: 'youtube', url: 'https://youtu.be/dQw4w9WgXcQ', embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', title: 'YouTube video' } })
it('preserves embed descriptions in Markdown', () => {
  const embed = embedBlock()
  embed.attrs = { ...embed.attrs, description: 'Page description' }
  const markdown = documentToMyBookMarkdown('Embeds', doc(embed))
  expect(myBookMarkdownToDocument(markdown).content?.[0]?.attrs).toMatchObject(embed.attrs!)
})
const markOrder = ['underline', 'strike', 'italic', 'bold', 'link', 'code']

function normalize(value: JSONContent): JSONContent {
  const normalized: JSONContent = { type: value.type }
  if (value.text !== undefined) normalized.text = value.text
  if (value.attrs) {
    const attrs = Object.fromEntries(Object.entries(value.attrs).filter(([, attr]) => attr !== undefined))
    if (Object.keys(attrs).length) normalized.attrs = attrs
  }
  if (value.marks?.length) normalized.marks = value.marks.map((mark) => {
    const normalizedMark: NonNullable<JSONContent['marks']>[number] = { type: mark.type }
    if (mark.attrs) normalizedMark.attrs = mark.attrs
    return normalizedMark
  }).sort((left, right) => {
    const order = markOrder.indexOf(left.type) - markOrder.indexOf(right.type)
    return order || JSON.stringify(left.attrs ?? {}).localeCompare(JSON.stringify(right.attrs ?? {}))
  })
  if (value.content?.length) normalized.content = value.content.map(normalize)
  return normalized
}

function expectRoundTrip(source: JSONContent) {
  const markdown = documentToMyBookMarkdown('Round Trip', source)
  expect(normalize(myBookMarkdownToDocument(markdown))).toEqual(normalize(source))
}

describe('MyBook Markdown serialization', () => {
  it('exports frontmatter, paragraphs, and headings as standard Markdown', () => {
    expect(documentToMyBookMarkdown('Doc Title', doc(
      paragraph(text('Plain paragraph')),
      heading(1, 'Heading 1'),
      heading(2, 'Heading 2'),
      heading(3, 'Heading 3'),
      heading(4, 'Heading 4'),
    ))).toBe([
      '---',
      'mybook_version: 1',
      'type: document',
      'title: "Doc Title"',
      '---',
      '',
      'Plain paragraph',
      '',
      '# Heading 1',
      '',
      '## Heading 2',
      '',
      '### Heading 3',
      '',
      '#### Heading 4',
      '',
    ].join('\n'))
  })

  it('exports and parses portable document identity metadata without changing content', () => {
    const source = doc(paragraph(text('Hello identity')))
    const markdown = documentToMyBookMarkdown('Identity', source, { documentId: 'doc_portable_123' })

    expect(markdown).toContain('document_id: "doc_portable_123"')
    const parsed = parseMyBookMarkdown(markdown)
    expect(parsed.metadata.documentId).toBe('doc_portable_123')
    expect(normalize(parsed.document)).toEqual(normalize(source))
  })

  it('keeps legacy and invalid document identity metadata backward compatible', () => {
    expect(parseMyBookMarkdown('---\nmybook_version: 1\ntype: document\ntitle: "Legacy"\n---\n\nHello').metadata.documentId).toBeUndefined()
    expect(parseMyBookMarkdown('---\nmybook_version: 1\ntype: document\ndocument_id: " "\ntitle: "Invalid"\n---\n\nHello').metadata.documentId).toBeUndefined()
    expect(myBookMarkdownToDocument('---\nmybook_version: 1\ntype: document\ndocument_id: "doc_valid"\ntitle: "Valid"\n---\n\nHello')).toEqual(doc(paragraph(text('Hello'))))
  })

  it('keeps repeated identity round trips stable with Unicode content', () => {
    const source = doc(heading(2, 'पोर्टेबल identity 😀'), paragraph(text('مرحبا')))
    const firstMarkdown = documentToMyBookMarkdown('Unicode 😀', source, { documentId: 'doc_repeat_123' })
    const firstParsed = parseMyBookMarkdown(firstMarkdown)
    const secondMarkdown = documentToMyBookMarkdown('Unicode 😀', firstParsed.document, { documentId: firstParsed.metadata.documentId })
    const secondParsed = parseMyBookMarkdown(secondMarkdown)

    expect(secondMarkdown).toBe(firstMarkdown)
    expect(secondParsed.metadata.documentId).toBe('doc_repeat_123')
    expect(normalize(secondParsed.document)).toEqual(normalize(source))
  })

  it('exports the containing file identity rather than copying content identity', () => {
    const source = doc(paragraph(text('Duplicated content')))
    const original = documentToMyBookMarkdown('Original', source, { documentId: 'doc_original' })
    const duplicate = documentToMyBookMarkdown('Original copy', source, { documentId: 'doc_duplicate' })

    expect(original).toContain('document_id: "doc_original"')
    expect(duplicate).toContain('document_id: "doc_duplicate"')
    expect(duplicate).not.toContain('doc_original')
  })

  it('exports simple checklist items with checked state', () => {
    expect(documentToMyBookMarkdown('Tasks', doc({
      type: 'taskList',
      content: [
        taskItem(false, paragraph(text('Pending'))),
        taskItem(true, paragraph(text('Done'))),
      ],
    }))).toContain('- [ ] Pending\n- [x] Done')
  })

  it('exports inline marks without dropping mark combinations', () => {
    const markdown = documentToMyBookMarkdown('Marks', doc(paragraph(
      text('bold', [{ type: 'bold' }]),
      text(' '),
      text('italic', [{ type: 'italic' }]),
      text(' '),
      text('strike', [{ type: 'strike' }]),
      text(' '),
      text('underline', [{ type: 'underline' }]),
      text(' '),
      text('code', [{ type: 'code' }]),
      text(' '),
      text('link', [{ type: 'link', attrs: { href: 'https://example.com/a_(b)' } }]),
      text(' '),
      text('bold-link', [{ type: 'bold' }, { type: 'link', attrs: { href: 'https://example.com' } }]),
    )))

    expect(markdown).toContain('**bold**')
    expect(markdown).toContain('_italic_')
    expect(markdown).toContain('~~strike~~')
    expect(markdown).toContain('<u>underline</u>')
    expect(markdown).toContain('`code`')
    expect(markdown).toContain('[link](https://example.com/a_(b))')
    expect(markdown).toContain('[**bold\\-link**](https://example.com)')
  })

  it('round trips underline and mixed inline marks semantically', () => {
    expectRoundTrip(doc(paragraph(
      text('underline', [{ type: 'underline' }]),
      text(' '),
      text('bold underline', [{ type: 'bold' }, { type: 'underline' }]),
      text(' '),
      text('italic underline', [{ type: 'italic' }, { type: 'underline' }]),
      text(' '),
      text('bold italic', [{ type: 'bold' }, { type: 'italic' }]),
      text(' '),
      text('all three', [{ type: 'bold' }, { type: 'italic' }, { type: 'underline' }]),
      text(' '),
      text('strike bold', [{ type: 'strike' }, { type: 'bold' }]),
    )))
  })

  it('round trips links with inline formatting and parenthesized URLs', () => {
    expectRoundTrip(doc(paragraph(
      text('plain link', [{ type: 'link', attrs: { href: 'https://example.com/path' } }]),
      text(' '),
      text('bold link', [{ type: 'bold' }, { type: 'link', attrs: { href: 'https://example.com/a_(b)' } }]),
      text(' '),
      text('italic link', [{ type: 'italic' }, { type: 'link', attrs: { href: 'https://example.com/query?q=(one)&v=two' } }]),
      text(' '),
      text('underline link', [{ type: 'underline' }, { type: 'link', attrs: { href: 'https://example.com/(docs)/page' } }]),
      text(' '),
      text('bold italic link', [{ type: 'bold' }, { type: 'italic' }, { type: 'link', attrs: { href: 'https://example.com/a(b)c(d)' } }]),
    )))
  })

  it('round trips adjacent formatted spans without merging or dropping marks', () => {
    expectRoundTrip(doc(paragraph(
      text('bold', [{ type: 'bold' }]),
      text('italic', [{ type: 'italic' }]),
      text('underline', [{ type: 'underline' }]),
      text('link', [{ type: 'link', attrs: { href: 'https://example.com' } }]),
    )))
  })

  it('round trips literal Markdown-sensitive inline text without corruption', () => {
    expectRoundTrip(doc(paragraph(text('Literal * _ ** ~~ <u> # [label](url) ![alt](src) (paren) + - > \\ text'))))
  })

  it('keeps Markdown syntax inside inline code literal', () => {
    expectRoundTrip(doc(paragraph(
      text('before '),
      text('**not bold** [not link](x) <u>not underline</u> `tick`', [{ type: 'code' }]),
      text(' after'),
    )))
  })

  it('exports lists and checklists with nesting and checked state', () => {
    const markdown = documentToMyBookMarkdown('Lists', doc(
      { type: 'bulletList', content: [
        listItem(paragraph(text('Parent')), { type: 'bulletList', content: [listItem(paragraph(text('Child')))] }),
      ] },
      { type: 'orderedList', content: [
        listItem(paragraph(text('One')), { type: 'orderedList', content: [listItem(paragraph(text('One A')))] }),
      ] },
      { type: 'taskList', content: [
        taskItem(false, paragraph(text('Pending'))),
        taskItem(true, paragraph(text('Done')), { type: 'taskList', content: [taskItem(false, paragraph(text('Nested')))] }),
      ] },
    ))

    expect(markdown).toContain('- Parent\n  - Child')
    expect(markdown).toContain('1. One\n  1. One A')
    expect(markdown).toContain('- [ ] Pending')
    expect(markdown).toContain('- [x] Done\n  - [ ] Nested')
  })

  it('round trips a three-level nested bullet list', () => {
    expectRoundTrip(doc({
      type: 'bulletList',
      content: [
        listItem(
          paragraph(text('Parent')),
          { type: 'bulletList', content: [
            listItem(
              paragraph(text('Child')),
              { type: 'bulletList', content: [listItem(paragraph(text('Grandchild')))] },
            ),
          ] },
        ),
        listItem(paragraph(text('Another parent'))),
      ],
    }))
  })

  it('round trips a three-level nested ordered list', () => {
    expectRoundTrip(doc({
      type: 'orderedList',
      content: [
        listItem(
          paragraph(text('Parent')),
          { type: 'orderedList', content: [
            listItem(
              paragraph(text('Child')),
              { type: 'orderedList', content: [listItem(paragraph(text('Grandchild')))] },
            ),
          ] },
        ),
        listItem(paragraph(text('Another parent'))),
      ],
    }))
  })

  it('round trips ordered list start attributes that exist in the Tiptap schema', () => {
    expectRoundTrip(doc({
      type: 'orderedList',
      attrs: { start: 3 },
      content: [
        listItem(
          paragraph(text('Third')),
          { type: 'orderedList', attrs: { start: 7 }, content: [
            listItem(paragraph(text('Seventh'))),
            listItem(paragraph(text('Eighth'))),
          ] },
        ),
        listItem(paragraph(text('Fourth'))),
      ],
    }))
  })

  it('round trips bullet to ordered and ordered to bullet nesting', () => {
    expectRoundTrip(doc(
      { type: 'bulletList', content: [
        listItem(
          paragraph(text('Parent bullet')),
          { type: 'orderedList', content: [
            listItem(paragraph(text('Ordered child'))),
            listItem(paragraph(text('Another ordered child'))),
          ] },
        ),
        listItem(paragraph(text('Second bullet'))),
      ] },
      { type: 'orderedList', content: [
        listItem(
          paragraph(text('Parent ordered')),
          { type: 'bulletList', content: [
            listItem(paragraph(text('Bullet child'))),
            listItem(paragraph(text('Another child'))),
          ] },
        ),
        listItem(paragraph(text('Second ordered'))),
      ] },
    ))
  })

  it('round trips nested checked and unchecked task lists', () => {
    expectRoundTrip(doc({
      type: 'taskList',
      content: [
        taskItem(
          false,
          paragraph(text('Parent task')),
          { type: 'taskList', content: [
            taskItem(true, paragraph(text('Child task'))),
            taskItem(false, paragraph(text('Another child'))),
          ] },
        ),
        taskItem(true, paragraph(text('Second parent'))),
      ],
    }))
  })

  it('round trips mixed task and normal list nesting', () => {
    expectRoundTrip(doc(
      { type: 'taskList', content: [
        taskItem(
          false,
          paragraph(text('Parent task')),
          { type: 'bulletList', content: [
            listItem(paragraph(text('Normal child'))),
            listItem(paragraph(text('Another normal child'))),
          ] },
        ),
      ] },
      { type: 'bulletList', content: [
        listItem(
          paragraph(text('Parent bullet')),
          { type: 'taskList', content: [
            taskItem(false, paragraph(text('Nested task'))),
          ] },
        ),
      ] },
    ))
  })

  it('round trips sibling nested lists under the same item', () => {
    expectRoundTrip(doc({
      type: 'bulletList',
      content: [
        listItem(
          paragraph(text('Parent')),
          { type: 'bulletList', content: [listItem(paragraph(text('Bullet child')))] },
          { type: 'orderedList', content: [listItem(paragraph(text('Ordered child')))] },
          { type: 'taskList', content: [taskItem(true, paragraph(text('Task child')))] },
        ),
      ],
    }))
  })

  it('round trips nested list items with inline formatting and escaped text', () => {
    expectRoundTrip(doc({
      type: 'bulletList',
      content: [
        listItem(
          paragraph(text('Parent')),
          { type: 'bulletList', content: [
            listItem(paragraph(
              text('Bold', [{ type: 'bold' }]),
              text(' '),
              text('italic', [{ type: 'italic' }]),
              text(' '),
              text('underline', [{ type: 'underline' }]),
            )),
            listItem(paragraph(text('`literal` and * literal brackets [ ]'))),
            listItem(paragraph(text('code', [{ type: 'code' }]))),
            listItem(paragraph(text('link', [{ type: 'link', attrs: { href: 'https://example.com/a_(b)' } }]))),
          ] },
        ),
      ],
    }))
  })

  it('round trips emoji, Hindi, and Arabic inside nested lists', () => {
    expectRoundTrip(doc({
      type: 'bulletList',
      content: [
        listItem(
          paragraph(text('Parent 😀')),
          { type: 'bulletList', content: [
            listItem(paragraph(text('Hindi नमस्ते'))),
            listItem(paragraph(text('Arabic مرحبا'))),
          ] },
        ),
      ],
    }))
  })

  it('exports blockquote, code block, horizontal rule, and hard break', () => {
    const markdown = documentToMyBookMarkdown('Blocks', doc(
      { type: 'blockquote', content: [paragraph(text('Quote'))] },
      { type: 'codeBlock', attrs: { language: 'ts' }, content: [text('const value = `tick`\n  return value')] },
      { type: 'horizontalRule' },
      paragraph(text('Line one'), { type: 'hardBreak' }, text('Line two')),
    ))

    expect(markdown).toContain('> Quote')
    expect(markdown).toContain('```ts\nconst value = `tick`\n  return value\n```')
    expect(markdown).toContain('\n---\n')
    expect(markdown).toContain('Line one  \nLine two')
  })

  it('exports auto code blocks with the detected language when available', () => {
    const markdown = documentToMyBookMarkdown('Auto Code', doc(
      { type: 'codeBlock', attrs: { language: 'auto', detectedLanguage: 'javascript' }, content: [text('const value = 1')] },
      { type: 'codeBlock', attrs: { language: 'auto', detectedLanguage: 'text' }, content: [text('plain notes')] },
    ))

    expect(markdown).toContain('```javascript\nconst value = 1\n```')
    expect(markdown).toContain('```\nplain notes\n```')
    expect(markdown).not.toContain('```auto')
  })

  it('exports MyBook custom blocks with all current attributes', () => {
    const markdown = documentToMyBookMarkdown('Custom Blocks', doc(
      { type: 'callout', attrs: { kind: 'info' }, content: [paragraph(text('Info'))] },
      { type: 'callout', attrs: { kind: 'success' }, content: [paragraph(text('Success'))] },
      { type: 'callout', attrs: { kind: 'warning' }, content: [paragraph(text('Warning'))] },
      { type: 'toggleBlock', attrs: { title: 'Open toggle', open: true }, content: [paragraph(text('Open body'))] },
      { type: 'toggleBlock', attrs: { title: 'Closed toggle', open: false }, content: [paragraph(text('Closed body'))] },
      { type: 'imageBlock', attrs: { src: 'data:image/png;base64,abc123', alt: 'Diagram [draft]' } },
      { type: 'fileAttachment', attrs: { name: 'report.pdf', mimeType: 'application/pdf', size: 12345, src: 'data:application/pdf;base64,abc123' } },
    ))

    expect(markdown).toContain(':::callout type="info"\nInfo\n:::')
    expect(markdown).toContain(':::callout type="success"\nSuccess\n:::')
    expect(markdown).toContain(':::callout type="warning"\nWarning\n:::')
    expect(markdown).toContain(':::toggle title="Open toggle" open=true\nOpen body\n:::')
    expect(markdown).toContain(':::toggle title="Closed toggle" open=false\nClosed body\n:::')
    expect(markdown).toContain('![Diagram \\[draft\\]](data:image/png;base64,abc123)')
    expect(markdown).toContain(':::file name="report.pdf" mime="application/pdf" size=12345\ndata:application/pdf;base64,abc123\n:::')
  })

  it('preserves the uploaded PDF inline preview setting in MyBook Markdown', () => {
    const source = doc({
      type: 'fileAttachment',
      attrs: { name: 'report.pdf', mimeType: 'application/pdf', size: 12345, src: 'data:application/pdf;base64,abc123', pdfPreview: true },
    })
    const markdown = documentToMyBookMarkdown('PDF', source)

    expect(markdown).toContain(':::file name="report.pdf" mime="application/pdf" size=12345 preview=pdf\ndata:application/pdf;base64,abc123\n:::')
    expect(myBookMarkdownToDocument(markdown).content?.[0]?.attrs?.pdfPreview).toBe(true)
  })

  it('exports simple tables as Markdown tables', () => {
    const markdown = documentToMyBookMarkdown('Simple Table', doc({
      type: 'table',
      content: [
        tableRow(tableHeader(paragraph(text('Name'))), tableHeader(paragraph(text('Status')))),
        tableRow(tableCell(paragraph(text('Draft'))), tableCell(paragraph(text('Open')))),
      ],
    }))

    expect(markdown).toContain(':::table\n{')
    expect(markdown).toContain('"type": "tableHeader"')
    expect(markdown).toContain('"text": "Name"')
    expect(markdown).toContain('"text": "Open"')
    expect(markdown).toContain('\n:::')
  })

  it('exports advanced tables with metadata so headers, spans, and rich cell content are preserved', () => {
    const markdown = documentToMyBookMarkdown('Advanced Table', doc({
      type: 'table',
      content: [
        tableRow(
          { type: 'tableHeader', attrs: { colspan: 2, rowspan: 1, colwidth: [120, 120], align: 'center' }, content: [paragraph(text('Header'))] },
        ),
        tableRow(
          { type: 'tableHeader', attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [paragraph(text('Column header'))] },
          { type: 'tableCell', attrs: { colspan: 1, rowspan: 2, colwidth: null }, content: [paragraph(text('First paragraph')), paragraph(text('Second paragraph'))] },
        ),
      ],
    }))

    expect(markdown).toContain(':::table')
    expect(markdown).toContain('"type": "tableHeader"')
    expect(markdown).toContain('"colspan": 2')
    expect(markdown).toContain('"rowspan": 2')
    expect(markdown).toContain('Second paragraph')
    expect(markdown).toContain(':::')
  })

  it('serializes structured tables deterministically', () => {
    const source = doc({
      type: 'table',
      content: [
        tableRow(tableHeader(paragraph(text('Name')))),
        tableRow(tableCell(paragraph(text('Ali')))),
      ],
    })

    expect(documentToMyBookMarkdown('Table', source)).toBe(documentToMyBookMarkdown('Table', source))
  })

  it('exports default database blocks as structured MyBook database blocks', () => {
    const source = doc(databaseBlock({
      version: 1,
      id: 'db_default',
      title: 'Untitled database',
      columns: [
        { id: 'col_name', name: 'Name', type: 'text' },
        {
          id: 'col_status',
          name: 'Status',
          type: 'status',
          options: [
            { id: 'opt_todo', label: 'Not started', color: 'gray' },
            { id: 'opt_progress', label: 'In progress', color: 'blue' },
            { id: 'opt_done', label: 'Done', color: 'green' },
          ],
        },
      ],
      rows: [{ id: 'row_1', values: {} }],
    }))
    const markdown = documentToMyBookMarkdown('Database', source)

    expect(markdown).toContain(':::database\n{')
    expect(markdown).toContain('"type": "databaseBlock"')
    expect(markdown).toContain('"id": "db_default"')
    expect(markdown).toContain('"name": "Name"')
    expect(markdown).toContain('"label": "Not started"')
    expect(markdown).toContain('"id": "row_1"')
    expect(markdown).toContain('\n:::')
  })

  it('exports databases with all six property types and values', () => {
    const markdown = documentToMyBookMarkdown('Database', doc(databaseBlock()))

    expect(markdown).toContain('"type": "text"')
    expect(markdown).toContain('"type": "number"')
    expect(markdown).toContain('"type": "select"')
    expect(markdown).toContain('"type": "status"')
    expect(markdown).toContain('"type": "date"')
    expect(markdown).toContain('"type": "checkbox"')
    expect(markdown).toContain('"col_number": 42')
    expect(markdown).toContain('"col_number": -12.5')
    expect(markdown).toContain('"col_select": "opt_high"')
    expect(markdown).toContain('"col_date": "2026-09-04"')
    expect(markdown).toContain('"col_done": false')
  })

  it('serializes database blocks deterministically', () => {
    const source = doc(databaseBlock())

    expect(documentToMyBookMarkdown('Database', source)).toBe(documentToMyBookMarkdown('Database', source))
  })

  it('exports table of contents blocks as minimal MyBook custom blocks', () => {
    expect(documentToMyBookMarkdown('TOC', doc(
      heading(1, 'Introduction'),
      tableOfContentsBlock(),
      heading(2, 'Details'),
    ))).toContain('# Introduction\n\n:::toc\n:::\n\n## Details')
  })

  it('exports document links as structured MyBook custom blocks', () => {
    const markdown = documentToMyBookMarkdown('Links', doc(documentLinkBlock('doc_b', 'Project Notes 😀')))

    expect(markdown).toContain(':::document-link')
    expect(markdown).toContain('"label": "Project Notes 😀"')
    expect(markdown).toContain('"targetId": "doc_b"')
  })
})

describe('MyBook Markdown parsing', () => {
  it('parses frontmatter, missing frontmatter, paragraphs, and headings', () => {
    expect(normalize(myBookMarkdownToDocument('---\nmybook_version: 1\ntype: document\ntitle: "Doc"\n---\n\n# One\n\nParagraph'))).toEqual(normalize(doc(
      heading(1, 'One'),
      paragraph(text('Paragraph')),
    )))

    expect(normalize(myBookMarkdownToDocument('Just text'))).toEqual(normalize(doc(paragraph(text('Just text')))))
  })

  it('parses simple checklist items without changing ordinary bullets', () => {
    expect(normalize(myBookMarkdownToDocument('- Plain bullet\n\n- [ ] Pending\n- [X] Done'))).toEqual(normalize(doc(
      { type: 'bulletList', content: [listItem(paragraph(text('Plain bullet')))] },
      { type: 'taskList', content: [
        taskItem(false, paragraph(text('Pending'))),
        taskItem(true, paragraph(text('Done'))),
      ] },
    )))
  })

  it('round trips simple inline code without parsing formatting inside it', () => {
    expectRoundTrip(doc(paragraph(text('**not bold** and `ticks`', [{ type: 'code' }]))))
  })

  it('parses inline marks, links, escaping, and nested mark combinations', () => {
    expect(normalize(myBookMarkdownToDocument('**bold** _italic_ ~~strike~~ <u>underline</u> `code` [**bold-link**](https://example.com/a_(b))'))).toEqual(normalize(doc(paragraph(
      text('bold', [{ type: 'bold' }]),
      text(' '),
      text('italic', [{ type: 'italic' }]),
      text(' '),
      text('strike', [{ type: 'strike' }]),
      text(' '),
      text('underline', [{ type: 'underline' }]),
      text(' '),
      text('code', [{ type: 'code' }]),
      text(' '),
      text('bold-link', [{ type: 'bold' }, { type: 'link', attrs: { href: 'https://example.com/a_(b)' } }]),
    ))))
  })

  it('parses nested lists and checklists with checked state', () => {
    expect(normalize(myBookMarkdownToDocument('- Parent\n  - Child\n\n1. One\n  1. One A\n\n- [ ] Pending\n- [x] Done\n  - [ ] Nested'))).toEqual(normalize(doc(
      { type: 'bulletList', content: [listItem(paragraph(text('Parent')), { type: 'bulletList', content: [listItem(paragraph(text('Child')))] })] },
      { type: 'orderedList', content: [listItem(paragraph(text('One')), { type: 'orderedList', content: [listItem(paragraph(text('One A')))] })] },
      { type: 'taskList', content: [
        taskItem(false, paragraph(text('Pending'))),
        taskItem(true, paragraph(text('Done')), { type: 'taskList', content: [taskItem(false, paragraph(text('Nested')))] }),
      ] },
    )))
  })

  it('parses blockquote, fenced code blocks, horizontal rules, and hard breaks', () => {
    expect(normalize(myBookMarkdownToDocument('> Quote\n\n````ts\nconst value = `tick`\n  return value\n````\n\n---\n\nLine one  \nLine two'))).toEqual(normalize(doc(
      { type: 'blockquote', content: [paragraph(text('Quote'))] },
      { type: 'codeBlock', attrs: { language: 'ts' }, content: [text('const value = `tick`\n  return value')] },
      { type: 'horizontalRule' },
      paragraph(text('Line one'), { type: 'hardBreak' }, text('Line two')),
    )))
  })

  it('parses legacy and extended MyBook custom block syntax', () => {
    const parsed = myBookMarkdownToDocument([
      ':::callout type="warning"',
      'Careful',
      ':::',
      '',
      ':::toggle title="Legacy toggle"',
      'Details',
      ':::',
      '',
      ':::toggle title="Closed toggle" open=false',
      'Hidden',
      ':::',
      '',
      ':::file name="report.pdf" mime="application/pdf" size=12345',
      'data:application/pdf;base64,abc123',
      ':::',
      '',
      '![Diagram](data:image/png;base64,abc123)',
    ].join('\n'))

    expect(normalize(parsed)).toEqual(normalize(doc(
      { type: 'callout', attrs: { kind: 'warning' }, content: [paragraph(text('Careful'))] },
      { type: 'toggleBlock', attrs: { title: 'Legacy toggle', open: true }, content: [paragraph(text('Details'))] },
      { type: 'toggleBlock', attrs: { title: 'Closed toggle', open: false }, content: [paragraph(text('Hidden'))] },
      { type: 'fileAttachment', attrs: { name: 'report.pdf', mimeType: 'application/pdf', size: 12345, src: 'data:application/pdf;base64,abc123' } },
      { type: 'imageBlock', attrs: { alt: 'Diagram', src: 'data:image/png;base64,abc123' } },
    )))
  })

  it('round trips toggle open state, title, child content, and inline marks', () => {
    expectRoundTrip(doc(
      { type: 'toggleBlock', attrs: { title: 'Open details', open: true }, content: [
        paragraph(text('Bold detail', [{ type: 'bold' }]), text(' and plain')),
      ] },
      { type: 'toggleBlock', attrs: { title: 'Closed details', open: false }, content: [
        paragraph(text('Hidden detail', [{ type: 'underline' }])),
      ] },
    ))
  })

  it('round trips toggle headings with levels 1 to 4', () => {
    expectRoundTrip(doc(
      { type: 'toggleBlock', attrs: { title: 'Section 1', open: true, level: 1 }, content: [paragraph(text('H1 body'))] },
      { type: 'toggleBlock', attrs: { title: 'Section 2', open: false, level: 2 }, content: [paragraph(text('H2 body'))] },
      { type: 'toggleBlock', attrs: { title: 'Section 3', open: true, level: 3 }, content: [paragraph(text('H3 body'))] },
      { type: 'toggleBlock', attrs: { title: 'Section 4', open: false, level: 4 }, content: [paragraph(text('H4 body'))] },
    ))
  })

  it('preserves legacy toggle blocks without open as open by default', () => {
    expect(normalize(myBookMarkdownToDocument(':::toggle title="Legacy details"\nContent\n:::'))).toEqual(normalize(doc(
      { type: 'toggleBlock', attrs: { title: 'Legacy details', open: true }, content: [paragraph(text('Content'))] },
    )))
  })

  it('falls back to legacy open behavior for malformed toggle booleans', () => {
    expect(normalize(myBookMarkdownToDocument(':::toggle title="Details" open=yes\nContent\n:::'))).toEqual(normalize(doc(
      { type: 'toggleBlock', attrs: { title: 'Details', open: true }, content: [paragraph(text('Content'))] },
    )))
  })

  it('preserves unknown custom blocks visibly as raw paragraph text', () => {
    expect(normalize(myBookMarkdownToDocument(':::futureBlock foo="bar"\nImportant user content\n:::\n\nParagraph'))).toEqual(normalize(doc(
      paragraph(text(':::futureBlock foo="bar"\nImportant user content\n:::')),
      paragraph(text('Paragraph')),
    )))
  })

  it('preserves unknown nested-looking custom block content visibly', () => {
    expect(normalize(myBookMarkdownToDocument(':::futureBlock\n:::toggle title="Nested"\nDo not parse me\n:::\n:::'))).toEqual(normalize(doc(
      paragraph(text(':::futureBlock\n:::toggle title="Nested"\nDo not parse me\n:::')),
      paragraph(text(':::')),
    )))
  })

  it('preserves malformed known custom blocks visibly', () => {
    expect(normalize(myBookMarkdownToDocument([
      ':::callout type=',
      'Important callout text',
      ':::',
      '',
      ':::toggle title=',
      'Important toggle text',
      ':::',
      '',
      ':::file name=',
      'data:broken',
      ':::',
    ].join('\n')))).toEqual(normalize(doc(
      paragraph(text(':::callout type=\nImportant callout text\n:::')),
      paragraph(text(':::toggle title=\nImportant toggle text\n:::')),
      paragraph(text(':::file name=\ndata:broken\n:::')),
    )))
  })

  it('preserves unclosed custom blocks visibly', () => {
    expect(normalize(myBookMarkdownToDocument(':::toggle title="Details"\nContent without closing marker'))).toEqual(normalize(doc(
      paragraph(text(':::toggle title="Details"\nContent without closing marker')),
    )))
  })

  it('keeps literal triple-colon text as normal paragraph content', () => {
    expect(normalize(myBookMarkdownToDocument(':::\n\nThis documentation uses ::: notation.'))).toEqual(normalize(doc(
      paragraph(text(':::')),
      paragraph(text('This documentation uses ::: notation.')),
    )))
  })

  it('does not parse MyBook custom syntax inside fenced code blocks', () => {
    expect(normalize(myBookMarkdownToDocument('```text\n:::toggle title="Not a real toggle"\nThis is source code.\n:::\n```'))).toEqual(normalize(doc(
      { type: 'codeBlock', attrs: { language: 'text' }, content: [text(':::toggle title="Not a real toggle"\nThis is source code.\n:::')] },
    )))
  })

  it('continues parsing known callout, toggle, and file blocks', () => {
    expect(normalize(myBookMarkdownToDocument([
      ':::callout type="info"',
      'Callout',
      ':::',
      '',
      ':::toggle title="Toggle" open=false',
      'Toggle body',
      ':::',
      '',
      ':::file name="report.pdf" mime="application/pdf" size=12345',
      'data:application/pdf;base64,abc123',
      ':::',
    ].join('\n')))).toEqual(normalize(doc(
      { type: 'callout', attrs: { kind: 'info' }, content: [paragraph(text('Callout'))] },
      { type: 'toggleBlock', attrs: { title: 'Toggle', open: false }, content: [paragraph(text('Toggle body'))] },
      { type: 'fileAttachment', attrs: { name: 'report.pdf', mimeType: 'application/pdf', size: 12345, src: 'data:application/pdf;base64,abc123' } },
    )))
  })

  it('parses existing serializer-produced pipe tables', () => {
    expect(normalize(myBookMarkdownToDocument('| Name | Status |\n| --- | --- |\n| Draft | Open |'))).toEqual(normalize(doc({
      type: 'table',
      content: [
        tableRow(tableHeader(paragraph(text('Name'))), tableHeader(paragraph(text('Status')))),
        tableRow(tableCell(paragraph(text('Draft'))), tableCell(paragraph(text('Open')))),
      ],
    })))
  })

  it('round trips structured tables with metadata and rich cell content', () => {
    expectRoundTrip(doc({
      type: 'table',
      content: [
        tableRow(
          { type: 'tableHeader', attrs: { colspan: 2, rowspan: 1, colwidth: [120, 120], align: 'center' }, content: [paragraph(text('Header', [{ type: 'bold' }]))] },
        ),
        tableRow(
          { type: 'tableHeader', attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [paragraph(text('Column header', [{ type: 'underline' }]))] },
          { type: 'tableCell', attrs: { colspan: 1, rowspan: 2, colwidth: null }, content: [
            paragraph(text('First paragraph'), { type: 'hardBreak' }, text('Second line')),
            paragraph(text('Link', [{ type: 'link', attrs: { href: 'https://example.com/a_(b)' } }])),
          ] },
        ),
      ],
    }))
  })

  it('round trips structured tables with empty and international cell content', () => {
    expectRoundTrip(doc({
      type: 'table',
      content: [
        tableRow(tableHeader(paragraph()), tableHeader(paragraph(text('Emoji 😀')))),
        tableRow(tableCell(paragraph(text('Hindi नमस्ते'))), tableCell(paragraph(text('Arabic مرحبا')))),
      ],
    }))
  })

  it('imports pipe tables without leading or trailing pipes', () => {
    expect(normalize(myBookMarkdownToDocument('Name | Age\n--- | ---\nAli | 32'))).toEqual(normalize(doc({
      type: 'table',
      content: [
        tableRow(tableHeader(paragraph(text('Name'))), tableHeader(paragraph(text('Age')))),
        tableRow(tableCell(paragraph(text('Ali'))), tableCell(paragraph(text('32')))),
      ],
    })))
  })

  it('imports escaped pipes and inline-code pipes in legacy pipe tables', () => {
    expect(normalize(myBookMarkdownToDocument('| Name | Value | Code |\n| --- | --- | --- |\n| Example | A \\| B | `a | b` |'))).toEqual(normalize(doc({
      type: 'table',
      content: [
        tableRow(tableHeader(paragraph(text('Name'))), tableHeader(paragraph(text('Value'))), tableHeader(paragraph(text('Code')))),
        tableRow(tableCell(paragraph(text('Example'))), tableCell(paragraph(text('A | B'))), tableCell(paragraph(text('a | b', [{ type: 'code' }])))),
      ],
    })))
  })

  it('exports imported legacy pipe tables as structured table blocks on next serialization', () => {
    const parsed = myBookMarkdownToDocument('| Name | Age |\n| --- | --- |\n| Ali | 32 |')
    const markdown = documentToMyBookMarkdown('Imported Table', parsed)

    expect(markdown).toContain(':::table\n{')
    expect(markdown).toContain('"type": "table"')
    expect(markdown).not.toContain('| Name | Age |')
  })

  it('preserves malformed structured table blocks visibly', () => {
    expect(normalize(myBookMarkdownToDocument(':::table\n{ not valid json\n:::'))).toEqual(normalize(doc(
      paragraph(text(':::table\n{ not valid json\n:::')),
    )))
  })

  it('preserves structurally invalid table blocks visibly', () => {
    expect(normalize(myBookMarkdownToDocument(':::table\n{"type":"table","content":[{"type":"paragraph"}]}\n:::'))).toEqual(normalize(doc(
      paragraph(text(':::table\n{"type":"table","content":[{"type":"paragraph"}]}\n:::')),
    )))
  })

  it('preserves unknown custom Markdown content instead of discarding it', () => {
    expect(normalize(myBookMarkdownToDocument(':::future-block kind="demo"\nraw content\n:::\n\nParagraph'))).toEqual(normalize(doc(
      paragraph(text(':::future-block kind="demo"\nraw content\n:::')),
      paragraph(text('Paragraph')),
    )))
  })

  it('imports structured database blocks and preserves stored ids', () => {
    const attrs = databaseAttrs()
    const parsed = myBookMarkdownToDocument([
      ':::database',
      JSON.stringify({ type: 'databaseBlock', attrs }, null, 2),
      ':::',
    ].join('\n'))

    expect(normalize(parsed)).toEqual(normalize(doc(databaseBlock(attrs))))
  })

  it('normalizes valid database blocks without regenerating existing ids', () => {
    const parsed = myBookMarkdownToDocument([
      ':::database',
      JSON.stringify({
        type: 'databaseBlock',
        attrs: {
          version: 1,
          id: 'db_normalized',
          title: 'Normalized',
          columns: [
            { id: 'col_name', name: 'Name', type: 'text' },
            { id: 'col_number', name: 'Number', type: 'number' },
            { id: 'col_date', name: 'Date', type: 'date' },
            { id: 'col_select', name: 'Select', type: 'select', options: [{ id: 'opt_select', label: 'Option', color: 'yellow' }] },
            { id: 'col_bad', name: 'Mystery', type: 'mystery' },
            { id: 'col_status', name: 'Status', type: 'status', options: [{ id: 'opt_a', label: 'A', color: 'purple' }] },
            { id: 'col_done', name: 'Done', type: 'checkbox' },
          ],
          rows: [
            { id: 'row_keep', values: { col_name: 'Task', col_number: -3.5, col_date: '2026-09-04', col_select: 'opt_select', col_status: 'opt_a', col_done: false, col_bad: 'drop me', col_missing: 'drop me' } },
          ],
        },
      }, null, 2),
      ':::',
    ].join('\n'))

    expect(normalize(parsed)).toEqual(normalize(doc(databaseBlock({
      version: 1,
      id: 'db_normalized',
      title: 'Normalized',
      columns: [
        { id: 'col_name', name: 'Name', type: 'text' },
        { id: 'col_number', name: 'Number', type: 'number' },
        { id: 'col_date', name: 'Date', type: 'date' },
        { id: 'col_select', name: 'Select', type: 'select', options: [{ id: 'opt_select', label: 'Option', color: 'yellow' }] },
        { id: 'col_status', name: 'Status', type: 'status', options: [{ id: 'opt_a', label: 'A', color: 'purple' }] },
        { id: 'col_done', name: 'Done', type: 'checkbox' },
      ],
      rows: [
        { id: 'row_keep', values: { col_name: 'Task', col_number: -3.5, col_date: '2026-09-04', col_select: 'opt_select', col_status: 'opt_a', col_done: false } },
      ],
    }))))
  })

  it('clears invalid number, date, and select database values during import', () => {
    const parsed = myBookMarkdownToDocument([
      ':::database',
      JSON.stringify({
        type: 'databaseBlock',
        attrs: {
          version: 1,
          id: 'db_invalid_values',
          title: 'Invalid values',
          columns: [
            { id: 'col_name', name: 'Name', type: 'text' },
            { id: 'col_number', name: 'Number', type: 'number' },
            { id: 'col_date', name: 'Date', type: 'date' },
            { id: 'col_select', name: 'Select', type: 'select', options: [{ id: 'opt_a', label: 'A', color: 'gray' }] },
          ],
          rows: [
            { id: 'row_1', values: { col_name: 'Task', col_number: 'NaN', col_date: '2026-99-99', col_select: 'missing' } },
          ],
        },
      }),
      ':::',
    ].join('\n'))

    expect(normalize(parsed)).toEqual(normalize(doc(databaseBlock({
      version: 1,
      id: 'db_invalid_values',
      title: 'Invalid values',
      columns: [
        { id: 'col_name', name: 'Name', type: 'text' },
        { id: 'col_number', name: 'Number', type: 'number' },
        { id: 'col_date', name: 'Date', type: 'date' },
        { id: 'col_select', name: 'Select', type: 'select', options: [{ id: 'opt_a', label: 'A', color: 'gray' }] },
      ],
      rows: [
        { id: 'row_1', values: { col_name: 'Task' } },
      ],
    }))))
  })

  it('round trips customized select and status options with labels, colors, and row references', () => {
    const attrs: DatabaseAttrs = {
      version: 1,
      id: 'db_custom_options',
      title: 'Custom options',
      columns: [
        { id: 'col_name', name: 'Name', type: 'text' },
        {
          id: 'col_priority',
          name: 'Priority',
          type: 'select',
          options: [
            { id: 'opt_urgent', label: 'Urgent 😀', color: 'red' },
            { id: 'opt_hindi', label: 'Hindi नमस्ते', color: 'orange' },
          ],
        },
        {
          id: 'col_status',
          name: 'Status',
          type: 'status',
          options: [
            { id: 'opt_review', label: 'Review', color: 'purple' },
            { id: 'opt_arabic', label: 'Arabic مرحبا', color: 'pink' },
          ],
        },
      ],
      rows: [
        { id: 'row_1', values: { col_name: 'Homepage', col_priority: 'opt_urgent', col_status: 'opt_review' } },
        { id: 'row_2', values: { col_name: 'Mobile', col_priority: 'opt_hindi', col_status: 'opt_arabic' } },
      ],
    }

    expectRoundTrip(doc(databaseBlock(attrs)))
  })

  it('round trips zero-option select and status columns', () => {
    const attrs: DatabaseAttrs = {
      version: 1,
      id: 'db_zero_options',
      title: 'Zero options',
      columns: [
        { id: 'col_name', name: 'Name', type: 'text' },
        { id: 'col_priority', name: 'Priority', type: 'select', options: [] },
        { id: 'col_status', name: 'Status', type: 'status', options: [] },
      ],
      rows: [{ id: 'row_1', values: { col_name: 'Task' } }],
    }

    expectRoundTrip(doc(databaseBlock(attrs)))
  })

  it('preserves custom database row order through markdown round trip', () => {
    const source = databaseAttrs()
    const attrs: DatabaseAttrs = {
      ...source,
      rows: [source.rows[2]!, source.rows[0]!, source.rows[1]!, source.rows[3]!],
    }

    const parsed = myBookMarkdownToDocument(documentToMyBookMarkdown('Rows', doc(databaseBlock(attrs))))
    const parsedDatabase = parsed.content?.[0]

    expect(parsedDatabase?.type).toBe('databaseBlock')
    expect(parsedDatabase?.attrs?.rows.map((row: { id: string }) => row.id)).toEqual(['row_3', 'row_1', 'row_2', 'row_4'])
    expect(normalize(parsed)).toEqual(normalize(doc(databaseBlock(attrs))))
  })

  it('preserves custom database column order through markdown round trip', () => {
    const source = databaseAttrs()
    const attrs: DatabaseAttrs = {
      ...source,
      columns: [
        source.columns[0]!,
        source.columns[4]!,
        source.columns[2]!,
        source.columns[3]!,
        source.columns[5]!,
        source.columns[1]!,
      ],
    }

    const parsed = myBookMarkdownToDocument(documentToMyBookMarkdown('Columns', doc(databaseBlock(attrs))))
    const parsedDatabase = parsed.content?.[0]

    expect(parsedDatabase?.type).toBe('databaseBlock')
    expect(parsedDatabase?.attrs?.columns.map((column: { id: string }) => column.id)).toEqual(['col_name', 'col_date', 'col_select', 'col_status', 'col_done', 'col_number'])
    expect(normalize(parsed)).toEqual(normalize(doc(databaseBlock(attrs))))
  })

  it('preserves database sort and filters through markdown round trip', () => {
    const attrs: DatabaseAttrs = {
      ...databaseAttrs(),
      viewState: {
        sort: { columnId: 'col_date', direction: 'desc' },
        filters: [
          { id: 'filter_priority', columnId: 'col_select', operator: 'is', value: 'opt_high' },
          { id: 'filter_number', columnId: 'col_number', operator: 'greaterThanOrEqual', value: 2 },
          { id: 'filter_date', columnId: 'col_date', operator: 'isBefore', value: '2026-12-01' },
          { id: 'filter_done', columnId: 'col_done', operator: 'isChecked' },
          { id: 'filter_status', columnId: 'col_status', operator: 'isNot', value: 'opt_todo' },
        ],
      },
    }

    const parsed = myBookMarkdownToDocument(documentToMyBookMarkdown('View State', doc(databaseBlock(attrs))))
    const parsedDatabase = parsed.content?.[0]

    expect(parsedDatabase?.type).toBe('databaseBlock')
    expect(parsedDatabase?.attrs?.viewState).toEqual(attrs.viewState)
    expect(normalize(parsed)).toEqual(normalize(doc(databaseBlock(attrs))))
  })

  it('preserves malformed database blocks visibly', () => {
    expect(normalize(myBookMarkdownToDocument(':::database\n{ not valid json\n:::'))).toEqual(normalize(doc(
      paragraph(text(':::database\n{ not valid json\n:::')),
    )))
    expect(normalize(myBookMarkdownToDocument(':::database\n{"type":"paragraph"}\n:::'))).toEqual(normalize(doc(
      paragraph(text(':::database\n{"type":"paragraph"}\n:::')),
    )))
    expect(normalize(myBookMarkdownToDocument(':::database\n{"type":"databaseBlock","attrs":{"version":1,"id":"db_missing","title":"Missing"}}\n:::'))).toEqual(normalize(doc(
      paragraph(text(':::database\n{"type":"databaseBlock","attrs":{"version":1,"id":"db_missing","title":"Missing"}}\n:::')),
    )))
  })

  it('preserves unclosed database blocks visibly', () => {
    expect(normalize(myBookMarkdownToDocument(':::database\n{"type":"databaseBlock","attrs":{"version":1'))).toEqual(normalize(doc(
      paragraph(text(':::database\n{"type":"databaseBlock","attrs":{"version":1')),
    )))
  })

  it('preserves unknown future database versions visibly', () => {
    const attrs = { ...databaseAttrs(), version: 2 }
    expect(normalize(myBookMarkdownToDocument([
      ':::database',
      JSON.stringify({ type: 'databaseBlock', attrs }),
      ':::',
    ].join('\n')))).toEqual(normalize(doc(
      paragraph(text(`:::database\n${JSON.stringify({ type: 'databaseBlock', attrs })}\n:::`)),
    )))
  })

  it('parses database blocks adjacent to paragraphs, tables, and custom blocks', () => {
    const attrs = databaseAttrs()
    const parsed = myBookMarkdownToDocument([
      'Before',
      '',
      ':::database',
      JSON.stringify({ type: 'databaseBlock', attrs }, null, 2),
      ':::',
      '',
      ':::table',
      JSON.stringify({
        type: 'table',
        content: [tableRow(tableHeader(paragraph(text('Name'))), tableHeader(paragraph(text('Status'))))],
      }, null, 2),
      ':::',
      '',
      ':::toggle title="Details" open=false',
      'After table',
      ':::',
      '',
      'After',
    ].join('\n'))

    expect(normalize(parsed)).toEqual(normalize(doc(
      paragraph(text('Before')),
      databaseBlock(attrs),
      {
        type: 'table',
        content: [tableRow(tableHeader(paragraph(text('Name'))), tableHeader(paragraph(text('Status'))))],
      },
      { type: 'toggleBlock', attrs: { title: 'Details', open: false }, content: [paragraph(text('After table'))] },
      paragraph(text('After')),
    )))
  })

  it('parses multiple database blocks in one document', () => {
    const first = { ...databaseAttrs(), id: 'db_first', title: 'First' }
    const second = { ...databaseAttrs(), id: 'db_second', title: 'Second' }
    const parsed = myBookMarkdownToDocument([
      ':::database',
      JSON.stringify({ type: 'databaseBlock', attrs: first }),
      ':::',
      '',
      ':::database',
      JSON.stringify({ type: 'databaseBlock', attrs: second }),
      ':::',
    ].join('\n'))

    expect(normalize(parsed)).toEqual(normalize(doc(databaseBlock(first), databaseBlock(second))))
  })

  it('parses table of contents blocks without storing heading entries', () => {
    expect(normalize(myBookMarkdownToDocument(':::toc\n:::'))).toEqual(normalize(doc(
      tableOfContentsBlock(),
    )))
  })

  it('preserves malformed table of contents blocks visibly', () => {
    expect(normalize(myBookMarkdownToDocument(':::toc\nUnexpected stale entry\n:::'))).toEqual(normalize(doc(
      paragraph(text(':::toc\nUnexpected stale entry\n:::')),
    )))
    expect(normalize(myBookMarkdownToDocument(':::toc\nmissing close'))).toEqual(normalize(doc(
      paragraph(text(':::toc\nmissing close')),
    )))
  })

  it('parses document link blocks and preserves target identity', () => {
    expect(normalize(myBookMarkdownToDocument([
      'Before',
      '',
      ':::document-link',
      '{',
      '  "targetId": "doc_b",',
      '  "label": "Project Notes नमस्ते مرحبا 😀"',
      '}',
      ':::',
      '',
      'After',
    ].join('\n')))).toEqual(normalize(doc(
      paragraph(text('Before')),
      documentLinkBlock('doc_b', 'Project Notes नमस्ते مرحبا 😀'),
      paragraph(text('After')),
    )))
  })

  it('preserves malformed document link blocks visibly', () => {
    expect(normalize(myBookMarkdownToDocument(':::document-link\n{ not json\n:::'))).toEqual(normalize(doc(
      paragraph(text(':::document-link\n{ not json\n:::')),
    )))
    expect(normalize(myBookMarkdownToDocument(':::document-link\n{"label":"Missing target"}\n:::'))).toEqual(normalize(doc(
      paragraph(text(':::document-link\n{"label":"Missing target"}\n:::')),
    )))
    expect(normalize(myBookMarkdownToDocument(':::document-link\n{"targetId":"doc_b","label":"Project Notes"}'))).toEqual(normalize(doc(
      paragraph(text(':::document-link\n{"targetId":"doc_b","label":"Project Notes"}')),
    )))
  })
})

describe('MyBook Markdown round trips', () => {
  it('round trips all currently supported document features semantically', () => {
    expectRoundTrip(doc(
      heading(1, 'Overview'),
      paragraph(
        text('Bold italic link', [{ type: 'bold' }, { type: 'italic' }, { type: 'link', attrs: { href: 'https://example.com/a_(b)' } }]),
        { type: 'hardBreak' },
        text('Underline', [{ type: 'underline' }]),
        text(' '),
        text('code', [{ type: 'code' }]),
      ),
      { type: 'bulletList', content: [listItem(paragraph(text('Parent')), { type: 'bulletList', content: [listItem(paragraph(text('Child')))] })] },
      { type: 'orderedList', content: [listItem(paragraph(text('One')), { type: 'orderedList', content: [listItem(paragraph(text('One A')))] })] },
      { type: 'taskList', content: [taskItem(false, paragraph(text('Pending'))), taskItem(true, paragraph(text('Done')))] },
      { type: 'blockquote', content: [paragraph(text('Quote'))] },
      { type: 'codeBlock', attrs: { language: 'js' }, content: [text('const fence = "```"\nconsole.log(fence)')] },
      { type: 'horizontalRule' },
      { type: 'callout', attrs: { kind: 'success' }, content: [paragraph(text('Callout body'))] },
      { type: 'toggleBlock', attrs: { title: 'Closed', open: false }, content: [paragraph(text('Toggle body'))] },
      { type: 'imageBlock', attrs: { src: 'data:image/png;base64,abc123', alt: 'Diagram' } },
      { type: 'fileAttachment', attrs: { name: 'report.pdf', mimeType: 'application/pdf', size: 12345, src: 'data:application/pdf;base64,abc123' } },
      tableOfContentsBlock(),
      {
        type: 'table',
        content: [
          tableRow(tableHeader(paragraph(text('Name'))), tableHeader(paragraph(text('Status')))),
          tableRow(tableCell(paragraph(text('Draft'))), tableCell(paragraph(text('Open')))),
        ],
      },
      databaseBlock(),
    ))
  })

  it('round trips database blocks with title, ids, values, empty values, and international text', () => {
    expectRoundTrip(doc(databaseBlock()))
  })

  it('round trips table of contents blocks without serializing derived headings', () => {
    const source = doc(
      heading(1, 'Overview'),
      tableOfContentsBlock(),
      heading(2, 'Details'),
    )
    const markdown = documentToMyBookMarkdown('TOC', source)

    expect(markdown).toContain(':::toc\n:::')
    expect(markdown).not.toContain(':::toc\nOverview')
    expect(normalize(myBookMarkdownToDocument(markdown))).toEqual(normalize(source))
  })

  it('round trips document links with stable target ids and fallback labels', () => {
    const source = doc(
      paragraph(text('Before')),
      documentLinkBlock('doc_b', 'Project Notes नमस्ते مرحبا 😀'),
      paragraph(text('After')),
    )
    const markdown = documentToMyBookMarkdown('Links', source)
    const parsed = myBookMarkdownToDocument(markdown)
    const secondMarkdown = documentToMyBookMarkdown('Links', parsed)

    expect(secondMarkdown).toBe(markdown)
    expect(normalize(parsed)).toEqual(normalize(source))
  })

  it('round trips pasted bookmark and embed blocks', () => {
    const source = doc(
      paragraph(text('Before')),
      bookmarkBlock(),
      embedBlock(),
      paragraph(text('After')),
    )
    const markdown = documentToMyBookMarkdown('Paste Blocks', source)

    expect(markdown).toContain(':::bookmark')
    expect(markdown).toContain(':::embed')
    expectRoundTrip(source)
  })

  it('round trips multiple database blocks without regenerating ids', () => {
    const first = { ...databaseAttrs(), id: 'db_one', title: 'One' }
    const second = { ...databaseAttrs(), id: 'db_two', title: 'Two' }

    expectRoundTrip(doc(databaseBlock(first), paragraph(text('Between')), databaseBlock(second)))
  })

  it('keeps complex database markdown stable across repeated round trips', () => {
    const attrs: DatabaseAttrs = {
      ...databaseAttrs(),
      title: 'Launch خطة नमस्ते 😀',
      columns: [
        databaseAttrs().columns[0]!,
        databaseAttrs().columns[4]!,
        databaseAttrs().columns[2]!,
        databaseAttrs().columns[3]!,
        databaseAttrs().columns[1]!,
        databaseAttrs().columns[5]!,
      ],
      rows: [
        databaseAttrs().rows[2]!,
        databaseAttrs().rows[0]!,
        databaseAttrs().rows[1]!,
      ],
      viewState: {
        sort: { columnId: 'col_select', direction: 'asc' },
        filters: [
          { id: 'filter_status', columnId: 'col_status', operator: 'isNot', value: 'opt_done' },
          { id: 'filter_number', columnId: 'col_number', operator: 'greaterThanOrEqual', value: -12.5 },
          { id: 'filter_done', columnId: 'col_done', operator: 'isUnchecked' },
        ],
      },
    }
    const source = doc(paragraph(text('Before')), databaseBlock(attrs), paragraph(text('After')))
    const firstMarkdown = documentToMyBookMarkdown('Complex', source)
    const firstParsed = myBookMarkdownToDocument(firstMarkdown)
    const secondMarkdown = documentToMyBookMarkdown('Complex', firstParsed)
    const secondParsed = myBookMarkdownToDocument(secondMarkdown)

    expect(normalize(firstParsed)).toEqual(normalize(source))
    expect(normalize(secondParsed)).toEqual(normalize(source))
    expect(secondMarkdown).toBe(firstMarkdown)
  })

  it('round trips empty documents, empty blocks, Unicode, emoji, Arabic, and Hindi text', () => {
    expectRoundTrip(doc(paragraph()))
    expectRoundTrip(doc({ type: 'taskList', content: [taskItem(false, paragraph())] }))
    expectRoundTrip(doc({ type: 'taskList', content: [taskItem(true, paragraph())] }))
    expectRoundTrip(doc({ type: 'bulletList', content: [{ type: 'listItem', content: [paragraph()] }] }))
    expectRoundTrip(doc({ type: 'orderedList', content: [{ type: 'listItem', content: [paragraph()] }] }))
    expectRoundTrip(doc(
      paragraph(text('Unicode café Привет')),
      paragraph(text('Emoji 😀')),
      paragraph(text('Arabic مرحبا')),
      paragraph(text('Hindi नमस्ते')),
    ))
  })

  it('correctly parses empty task items, shortcuts, and list lines without fallback to bullet text', () => {
    const parsedEmptyTask = myBookMarkdownToDocument('- [ ]')
    expect(parsedEmptyTask.content?.[0]?.type).toBe('taskList')
    expect(parsedEmptyTask.content?.[0]?.content?.[0]?.type).toBe('taskItem')
    expect(parsedEmptyTask.content?.[0]?.content?.[0]?.attrs?.checked).toBe(false)

    const parsedEmptyBracket = myBookMarkdownToDocument('- []')
    expect(parsedEmptyBracket.content?.[0]?.type).toBe('taskList')
    expect(parsedEmptyBracket.content?.[0]?.content?.[0]?.type).toBe('taskItem')

    const parsedCheckedEmpty = myBookMarkdownToDocument('- [x]')
    expect(parsedCheckedEmpty.content?.[0]?.type).toBe('taskList')
    expect(parsedCheckedEmpty.content?.[0]?.content?.[0]?.attrs?.checked).toBe(true)
  })

  it('round trips Markdown special characters as literal user text', () => {
    expectRoundTrip(doc(paragraph(text('Literal * _ # [ ] ( ) ` | \\ characters should not corrupt content'))))
  })

  it('round trips video blocks with attributes and captions', () => {
    const videoNode: JSONContent = {
      type: 'videoBlock',
      attrs: {
        src: 'https://example.com/demo.mp4',
        alt: 'Demo Video',
        caption: 'Watch the full walkthrough',
        showCaption: true,
        width: '75%',
        align: 'center',
        href: 'https://example.com/docs',
        provider: 'html5',
      },
    }
    const markdown = documentToMyBookMarkdown('Video Doc', doc(videoNode))
    const parsed = myBookMarkdownToDocument(markdown)
    expect(parsed.content?.[0]).toEqual(videoNode)
  })

  it('round trips image blocks with customized width, alignment, caption, and href', () => {
    const imageNode: JSONContent = {
      type: 'imageBlock',
      attrs: {
        src: 'https://example.com/photo.png',
        alt: 'Custom Photo',
        caption: 'A caption for the photo',
        showCaption: true,
        width: '45%',
        align: 'center',
        href: 'https://example.com/target',
      },
    }
    const markdown = documentToMyBookMarkdown('Image Doc', doc(imageNode))
    expect(markdown).toContain(':::image')
    const parsed = myBookMarkdownToDocument(markdown)
    expect(parsed.content?.[0]).toEqual(imageNode)
  })

  it('round trips audio blocks with attributes, title, caption, and artwork', () => {
    const audioNode: JSONContent = {
      type: 'audioBlock',
      attrs: {
        src: 'https://example.com/song.mp3',
        title: 'Theme Song',
        caption: 'Audio description',
        showCaption: true,
        width: '80%',
        align: 'center',
        artwork: 'https://example.com/cover.png',
        provider: 'html5',
      },
    }
    const markdown = documentToMyBookMarkdown('Audio Doc', doc(audioNode))
    expect(markdown).toContain(':::audio')
    const parsed = myBookMarkdownToDocument(markdown)
    expect(parsed.content?.[0]).toEqual(audioNode)
  })

  it('round trips standard image markdown syntax without losing alt, src, caption', () => {
    const standardImageNode: JSONContent = {
      type: 'imageBlock',
      attrs: {
        src: 'https://example.com/standard.jpg',
        alt: 'Standard Photo',
        caption: 'Simple caption',
        showCaption: true,
      },
    }
    const markdown = documentToMyBookMarkdown('Standard Image', doc(standardImageNode))
    expect(markdown).toContain('![Standard Photo](https://example.com/standard.jpg "Simple caption")')
    const parsed = myBookMarkdownToDocument(markdown)
    expect(parsed.content?.[0]?.type).toBe('imageBlock')
    expect(parsed.content?.[0]?.attrs?.src).toBe('https://example.com/standard.jpg')
    expect(parsed.content?.[0]?.attrs?.alt).toBe('Standard Photo')
    expect(parsed.content?.[0]?.attrs?.caption).toBe('Simple caption')
  })

  it('round trips metadata with createdAt and updatedAt timestamps', () => {
    const markdown = documentToMyBookMarkdown('Timestamped Doc', doc(paragraph(text('Hello'))), {
      documentId: 'doc_123',
      createdAt: '2026-01-15T10:00:00.000Z',
      updatedAt: '2026-03-20T15:30:00.000Z',
    })
    const parsed = parseMyBookMarkdown(markdown)
    expect(parsed.metadata.documentId).toBe('doc_123')
    expect(parsed.metadata.createdAt).toBe('2026-01-15T10:00:00.000Z')
    expect(parsed.metadata.updatedAt).toBe('2026-03-20T15:30:00.000Z')
  })

  it('round trips optional writing-language metadata and keeps legacy files unresolved', () => {
    const markdown = documentToMyBookMarkdown('Language Note', doc(paragraph(text('Hello'))), {
      writingLanguage: 'hi-Latn',
    })

    expect(markdown).toContain('writing_language: "hi-Latn"')
    expect(parseMyBookMarkdown(markdown).metadata.writingLanguage).toBe('hi-Latn')
    expect(parseMyBookMarkdown('---\ntitle: "Legacy"\n---\n\nHello').metadata.writingLanguage).toBeUndefined()
  })

  it('round trips a larger document without changing structure', () => {
    expectRoundTrip(doc(...Array.from({ length: 150 }, (_, index) => paragraph(text(`Paragraph ${index + 1}`)))))
  })

  it('serializes and deserializes 2, 3, 4, and 5 columns', () => {
    for (const count of [2, 3, 4, 5] as const) {
      const columnsNode: JSONContent = {
        type: 'columns',
        attrs: { count },
        content: Array.from({ length: count }, (_, i) => ({
          type: 'column',
          content: [paragraph(text(`Column ${i + 1} content`))],
        })),
      }

      const markdown = documentToMyBookMarkdown(`Columns ${count}`, doc(columnsNode))
      expect(markdown).toContain(`:::columns count=${count}`)
      expect(markdown.match(/:::column\b/g)?.length).toBe(count)

      const parsed = myBookMarkdownToDocument(markdown)
      expect(parsed.content?.[0]?.type).toBe('columns')
      expect(parsed.content?.[0]?.attrs?.count).toBe(count)
      expect(parsed.content?.[0]?.content?.length).toBe(count)
      expect(parsed.content?.[0]?.content?.[0]?.type).toBe('column')
      expect(parsed.content?.[0]?.content?.[0]?.content?.[0]?.content?.[0]?.text).toBe('Column 1 content')
    }
  })

  it('correctly handles nested custom ::: blocks inside columns without early termination', () => {
    const rawMarkdown = [
      ':::columns count=2',
      ':::column',
      '# Column 1 Header',
      '',
      'First column intro.',
      '',
      ':::callout type="info"',
      'Note inside column 1',
      ':::',
      '',
      'Trailing text after callout in col 1.',
      ':::',
      ':::column',
      ':::toggle title="Collapsible in Col 2" open=true',
      'Hidden content in toggle in col 2',
      ':::',
      '',
      'Another paragraph in col 2.',
      ':::',
      ':::',
    ].join('\n')

    const parsed = myBookMarkdownToDocument(rawMarkdown)
    const columnsBlock = parsed.content?.[0]
    expect(columnsBlock?.type).toBe('columns')
    expect(columnsBlock?.attrs?.count).toBe(2)
    expect(columnsBlock?.content?.length).toBe(2)

    // Check Column 1
    const col1 = columnsBlock?.content?.[0]
    expect(col1?.type).toBe('column')
    expect(col1?.content?.length).toBe(4)
    expect(col1?.content?.[0]?.type).toBe('heading')
    expect(col1?.content?.[1]?.type).toBe('paragraph')
    expect(col1?.content?.[2]?.type).toBe('callout')
    expect(col1?.content?.[2]?.attrs?.kind).toBe('info')
    expect(col1?.content?.[3]?.type).toBe('paragraph')

    // Check Column 2
    const col2 = columnsBlock?.content?.[1]
    expect(col2?.type).toBe('column')
    expect(col2?.content?.length).toBe(2)
    expect(col2?.content?.[0]?.type).toBe('toggleBlock')
    expect(col2?.content?.[0]?.attrs?.title).toBe('Collapsible in Col 2')
    expect(col2?.content?.[1]?.type).toBe('paragraph')
  })

  it('round trips columns with nested blocks', () => {
    const testDoc = doc({
      type: 'columns',
      attrs: { count: 2 },
      content: [
        {
          type: 'column',
          content: [
            paragraph(text('Left text')),
            {
              type: 'callout',
              attrs: { kind: 'warning' },
              content: [paragraph(text('Warning note'))],
            },
          ],
        },
        {
          type: 'column',
          content: [
            paragraph(text('Right text')),
          ],
        },
      ],
    })

    const markdown = documentToMyBookMarkdown('Columns Roundtrip', testDoc)
    const parsed = myBookMarkdownToDocument(markdown)
    expect(parsed.content?.[0]?.type).toBe('columns')
    expect(parsed.content?.[0]?.content?.[0]?.content?.[0]?.content?.[0]?.text).toBe('Left text')
    expect(parsed.content?.[0]?.content?.[0]?.content?.[1]?.type).toBe('callout')
    expect(parsed.content?.[0]?.content?.[0]?.content?.[1]?.attrs?.kind).toBe('warning')
    expect(parsed.content?.[0]?.content?.[1]?.content?.[0]?.content?.[0]?.text).toBe('Right text')
  })
})
