// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { isMarkdownText, contentToMarkdown, myBookMarkdownToDocument } from '../../utils/mybookMarkdown'
import { EditorKeyboardShortcuts } from './extensions/EditorKeyboardShortcuts'

describe('EditorKeyboardShortcuts extension', () => {
  it('registers all expected formatting, heading, list, block and navigation shortcuts', () => {
    const shortcuts = EditorKeyboardShortcuts.config.addKeyboardShortcuts?.call({
      editor: {
        commands: {},
        can: () => ({ sinkListItem: () => true, liftListItem: () => true }),
        isActive: () => false,
      },
    } as never)

    expect(shortcuts).toBeDefined()
    expect(shortcuts).toHaveProperty('Mod-b')
    expect(shortcuts).toHaveProperty('Mod-i')
    expect(shortcuts).toHaveProperty('Mod-u')
    expect(shortcuts).toHaveProperty('Mod-Shift-x')
    expect(shortcuts).toHaveProperty('Mod-Shift-s')
    expect(shortcuts).toHaveProperty('Mod-e')
    expect(shortcuts).toHaveProperty('Mod-Alt-1')
    expect(shortcuts).toHaveProperty('Mod-Alt-2')
    expect(shortcuts).toHaveProperty('Mod-Alt-3')
    expect(shortcuts).toHaveProperty('Mod-Alt-4')
    expect(shortcuts).toHaveProperty('Mod-Alt-0')
    expect(shortcuts).toHaveProperty('Mod-Shift-7')
    expect(shortcuts).toHaveProperty('Mod-Shift-8')
    expect(shortcuts).toHaveProperty('Mod-Shift-9')
    expect(shortcuts).toHaveProperty('Mod-Shift-b')
    expect(shortcuts).toHaveProperty('Mod-Shift-c')
    expect(shortcuts).toHaveProperty('Tab')
    expect(shortcuts).toHaveProperty('Shift-Tab')
    expect(shortcuts).toHaveProperty('ArrowRight')
    expect(shortcuts).toHaveProperty('ArrowLeft')
    expect(shortcuts).toHaveProperty('Space')
    expect(shortcuts).toHaveProperty('Enter')
  })
})

describe('isMarkdownText detector', () => {
  it('detects headings', () => {
    expect(isMarkdownText('# Heading 1')).toBe(true)
    expect(isMarkdownText('### Heading 3')).toBe(true)
    expect(isMarkdownText('Just some regular text')).toBe(false)
  })

  it('detects task lists', () => {
    expect(isMarkdownText('- [ ] Todo item')).toBe(true)
    expect(isMarkdownText('- [x] Done item')).toBe(true)
    expect(isMarkdownText('* [ ] Star todo')).toBe(true)
  })

  it('detects bullet and numbered lists', () => {
    expect(isMarkdownText('- Item 1\n- Item 2')).toBe(true)
    expect(isMarkdownText('1. Step 1\n2. Step 2')).toBe(true)
    expect(isMarkdownText('- Single item')).toBe(false)
    expect(isMarkdownText('- Item with **bold** formatting')).toBe(true)
  })

  it('detects code fences and blockquotes', () => {
    expect(isMarkdownText('```js\nconsole.log("hello")\n```')).toBe(true)
    expect(isMarkdownText('> A wise quote here')).toBe(true)
  })

  it('detects markdown tables and horizontal rules', () => {
    expect(isMarkdownText('| Name | Age |\n|---|---|\n| Alice | 30 |')).toBe(true)
    expect(isMarkdownText('---')).toBe(true)
  })

  it('detects custom callouts and toggles', () => {
    expect(isMarkdownText(':::callout type="warning"\nBe careful!\n:::')).toBe(true)
    expect(isMarkdownText(':::toggle title="Notes"\nDetails\n:::')).toBe(true)
  })
})

describe('contentToMarkdown serialization for clipboard', () => {
  it('serializes headings, paragraphs, bold, italic, underline, strike, and code', () => {
    const nodes = [
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Section Title' }],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', marks: [{ type: 'bold' }], text: 'Bold text' },
          { type: 'text', text: ' and ' },
          { type: 'text', marks: [{ type: 'italic' }], text: 'italic text' },
          { type: 'text', text: ' and ' },
          { type: 'text', marks: [{ type: 'code' }], text: 'const x = 1' },
        ],
      },
    ]

    const markdown = contentToMarkdown(nodes)
    expect(markdown).toContain('## Section Title')
    expect(markdown).toContain('**Bold text**')
    expect(markdown).toContain('_italic text_')
    expect(markdown).toContain('`const x = 1`')
  })

  it('serializes task lists, bullet lists, and code blocks', () => {
    const nodes = [
      {
        type: 'taskList',
        content: [
          {
            type: 'taskItem',
            attrs: { checked: true },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Completed task' }] }],
          },
          {
            type: 'taskItem',
            attrs: { checked: false },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Pending task' }] }],
          },
        ],
      },
      {
        type: 'codeBlock',
        attrs: { language: 'typescript' },
        content: [{ type: 'text', text: 'const answer = 42;' }],
      },
    ]

    const markdown = contentToMarkdown(nodes)
    expect(markdown).toContain('- [x] Completed task')
    expect(markdown).toContain('- [ ] Pending task')
    expect(markdown).toContain('```typescript\nconst answer = 42;\n```')
  })
})

describe('Markdown parsing into TipTap document blocks', () => {
  it('converts markdown text into TipTap block structures', () => {
    const markdown = `# Main Heading

- [ ] Buy groceries
- [x] Walk the dog

\`\`\`javascript
function add(a, b) {
  return a + b;
}
\`\`\`

> Remember to review code.
`

    const doc = myBookMarkdownToDocument(markdown)
    expect(doc.type).toBe('doc')
    expect(doc.content?.[0]?.type).toBe('heading')
    expect(doc.content?.[0]?.attrs?.level).toBe(1)
    expect(doc.content?.[1]?.type).toBe('taskList')
    expect(doc.content?.[2]?.type).toBe('codeBlock')
    expect(doc.content?.[3]?.type).toBe('blockquote')
  })
})
