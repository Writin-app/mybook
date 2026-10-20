import type { Editor } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'

import { calloutNode } from './extensions/Callout'
import { columnsNode } from './extensions/Columns'
import { databaseBlockNode } from './extensions/DatabaseBlock'
import { dateTimeBlockNode } from './extensions/DateTimeBlock'
import { tableOfContentsNode } from './extensions/TableOfContents'
import { toggleBlockNode } from './extensions/ToggleBlock'
import { convertSelectedBlocks, isFormatCommand } from './blockConversion'

export function isInsideColumns(editor: Pick<Editor, 'state'>): boolean {
  const { $from } = editor.state.selection
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const typeName = $from.node(depth).type.name
    if (typeName === 'columns' || typeName === 'column') return true
  }
  return false
}

export interface SlashCommand {
  id: string
  title: string
  description: string
  keywords: string[]
  category: 'Basic Blocks' | 'Lists' | 'Media' | 'Data' | 'Mention' | 'Advanced'
  shortcut?: string
  hidden?: boolean
}

export interface SlashMenuState {
  query: string
  range: { from: number; to: number }
  rect: DOMRect
}

export function getMentionMenuState(editor: Pick<Editor, 'state' | 'view'>): SlashMenuState | null {
  const { selection } = editor.state
  if (!selection.empty || !['paragraph', 'heading'].includes(selection.$from.parent.type.name)) return null
  const before = selection.$from.parent.textBetween(0, selection.$from.parentOffset, '\n', '\0')
  const match = /(?:^|\s)@([a-zA-Z0-9 -]*)$/u.exec(before)
  if (!match) return null
  const token = match[0].trimStart()
  const from = selection.$from.start() + before.length - token.length
  const coords = editor.view.coordsAtPos(selection.from)
  return { query: match[1] ?? '', range: { from, to: selection.from }, rect: new DOMRect(coords.left, coords.top, coords.right - coords.left, coords.bottom - coords.top) }
}

export function filterMentionCommands(query: string) {
  const normalized = query.trim().toLowerCase()
  const dateTime = allSlashCommands.find((command) => command.id === 'date-time')!
  return !normalized || 'date & time date time datetime'.includes(normalized) ? [dateTime] : []
}

export function commandMenuTop(rect: DOMRect, menuHeight: number, gap = 8, minTop = gap, viewportHeight?: number) {
  const effectiveViewportHeight = viewportHeight ?? (typeof window !== 'undefined' ? (window.visualViewport ? (window.visualViewport.offsetTop + window.visualViewport.height) : window.innerHeight) : 768)
  const below = rect.bottom + gap
  const hasRoomBelow = below + menuHeight <= effectiveViewportHeight - gap
  if (hasRoomBelow) return below
  const above = rect.top - menuHeight - gap
  if (above >= minTop) return above
  return Math.max(minTop, effectiveViewportHeight - menuHeight - gap)
}

export function getSlashCommandMatch(textBeforeCursor: string) {
  const match = /(?:^|\s)(\/+[a-zA-Z0-9-]*)$/.exec(textBeforeCursor)
  if (!match) return null
  const token = match[1] ?? ''
  const fromOffset = textBeforeCursor.length - token.length
  return {
    query: token.replace(/^\/+/u, ''),
    fromOffset,
  }
}

export function getSlashMenuState(editor: Pick<Editor, 'state' | 'view'>): SlashMenuState | null {
  const { selection } = editor.state
  if (!selection.empty) return null
  const { $from } = selection
  if (!['paragraph', 'heading'].includes($from.parent.type.name)) return null
  const textBeforeCursor = $from.parent.textBetween(0, $from.parentOffset, '\n', '\0')
  const match = getSlashCommandMatch(textBeforeCursor)
  if (!match) return null
  const from = $from.start() + match.fromOffset
  const to = $from.pos
  const coords = editor.view.coordsAtPos(to)
  return { query: match.query, range: { from, to }, rect: new DOMRect(coords.left, coords.top, coords.right - coords.left, coords.bottom - coords.top) }
}

export const ENABLE_DATABASE_BLOCK = false

export const allSlashCommands: SlashCommand[] = [
  { id: 'paragraph', title: 'Text', description: 'Start with plain text', keywords: ['paragraph', 'text'], category: 'Basic Blocks' },
  { id: 'h1', title: 'Heading 1', description: 'Large section heading', keywords: ['h1', 'heading', 'title'], category: 'Basic Blocks', shortcut: '#' },
  { id: 'h2', title: 'Heading 2', description: 'Medium section heading', keywords: ['h2', 'heading', 'subtitle'], category: 'Basic Blocks', shortcut: '##' },
  { id: 'h3', title: 'Heading 3', description: 'Small section heading', keywords: ['h3', 'heading'], category: 'Basic Blocks', shortcut: '###' },
  { id: 'h4', title: 'Heading 4', description: 'Smallest section heading', keywords: ['h4', 'heading'], category: 'Basic Blocks', shortcut: '####' },
  { id: 'quote', title: 'Quote', description: 'Highlight quoted text', keywords: ['quote', 'blockquote'], category: 'Basic Blocks', shortcut: '>' },
  { id: 'hr', title: 'Divider', description: 'Separate sections', keywords: ['divider', 'rule', 'hr', 'line'], category: 'Basic Blocks', shortcut: '---' },
  { id: 'bullet', title: 'Bulleted list', description: 'Create a simple list', keywords: ['bullet', 'list', 'ul'], category: 'Lists', shortcut: '- or *' },
  { id: 'numbered', title: 'Numbered list', description: 'Create an ordered list', keywords: ['numbered', 'ordered', 'list', 'ol'], category: 'Lists', shortcut: '1.' },
  { id: 'task', title: 'To-do list', description: 'Track tasks and todos', keywords: ['task', 'check', 'todo', 'todo list', 'checklist'], category: 'Lists', shortcut: '[]' },
  { id: 'toggle', title: 'Toggle', description: 'Hide details under a title', keywords: ['toggle', 'details', 'collapse'], category: 'Lists' },
  { id: 'toggle-h1', title: 'Toggle H1', description: 'Large heading with collapsible details', keywords: ['toggle', 'h1', 'heading', 'toggle h1', 'details', 'collapse'], category: 'Lists' },
  { id: 'toggle-h2', title: 'Toggle H2', description: 'Medium heading with collapsible details', keywords: ['toggle', 'h2', 'heading', 'toggle h2', 'details', 'collapse'], category: 'Lists' },
  { id: 'toggle-h3', title: 'Toggle H3', description: 'Small heading with collapsible details', keywords: ['toggle', 'h3', 'heading', 'toggle h3', 'details', 'collapse'], category: 'Lists' },
  { id: 'toggle-h4', title: 'Toggle H4', description: 'Smallest heading with collapsible details', keywords: ['toggle', 'h4', 'heading', 'toggle h4', 'details', 'collapse'], category: 'Lists' },
  { id: 'image', title: 'Image', description: 'Upload an image', keywords: ['image', 'photo', 'picture', 'media'], category: 'Media' },
  { id: 'video', title: 'Video', description: 'Embed a video or upload a clip', keywords: ['video', 'clip', 'youtube', 'vimeo', 'movie', 'media', 'mp4'], category: 'Media' },
  { id: 'audio', title: 'Audio', description: 'Embed an audio link or upload a sound file', keywords: ['audio', 'sound', 'music', 'podcast', 'recording', 'media', 'mp3', 'wav', 'track'], category: 'Media' },
  { id: 'file', title: 'File', description: 'Upload a file or embed a link', keywords: ['file', 'attachment', 'upload', 'pdf', 'doc', 'docx', 'xlsx', 'media', 'embed'], category: 'Media' },
  { id: 'document-link', title: 'Link to Page', description: 'Link to another workspace item', keywords: ['document link', 'link to page', 'page link', 'internal link', 'document', 'database', 'spreadsheet'], category: 'Media', shortcut: '[[' },
  { id: 'table', title: 'Basic Table', description: 'Insert a basic table', keywords: ['table', 'basic table', 'grid'], category: 'Data' },
  { id: 'database', title: 'Database', description: 'Typed rows and properties', keywords: ['database', 'data', 'properties', 'status'], category: 'Data', hidden: !ENABLE_DATABASE_BLOCK },
  { id: 'date-time', title: 'Date & Time', description: 'Insert a date with optional time', keywords: ['date', 'time', 'calendar', 'datetime'], category: 'Mention' },
  { id: 'inline-code', title: 'Inline code', description: 'Format text as inline code', keywords: ['inline code', 'code', 'monospace'], category: 'Advanced', shortcut: '`code`' },
  { id: 'callout', title: 'Callout', description: 'Add a highlighted note', keywords: ['callout', 'note', 'info', 'warning'], category: 'Advanced' },
  { id: 'columns-2', title: 'Columns 2', description: 'Split into 2 columns', keywords: ['columns', 'column', 'columns 2', '2 columns', 'split', 'grid', 'layout'], category: 'Advanced' },
  { id: 'columns-3', title: 'Columns 3', description: 'Split into 3 columns', keywords: ['columns', 'column', 'columns 3', '3 columns', 'split', 'grid', 'layout'], category: 'Advanced' },
  { id: 'columns-4', title: 'Columns 4', description: 'Split into 4 columns', keywords: ['columns', 'column', 'columns 4', '4 columns', 'split', 'grid', 'layout'], category: 'Advanced' },
  { id: 'columns-5', title: 'Columns 5', description: 'Split into 5 columns', keywords: ['columns', 'column', 'columns 5', '5 columns', 'split', 'grid', 'layout'], category: 'Advanced' },
  { id: 'toc', title: 'Table of contents', description: 'Show document headings', keywords: ['toc', 'table of contents', 'contents', 'outline'], category: 'Advanced' },
  { id: 'code-block', title: 'Code block', description: 'Insert multiline code', keywords: ['code', 'pre', 'block'], category: 'Advanced', shortcut: '```' },
]

export const slashCommands: SlashCommand[] = allSlashCommands.filter((command) => !command.hidden)

export function groupSlashCommands(commands: SlashCommand[]) {
  const categoryOrder: SlashCommand['category'][] = ['Basic Blocks', 'Lists', 'Media', 'Data', 'Mention', 'Advanced']
  return categoryOrder
    .map((category) => ({ category, commands: commands.filter((command) => command.category === category) }))
    .filter((group) => group.commands.length > 0)
}

export function filterSlashCommands(query: string, editor?: Pick<Editor, 'state'>) {
  const normalized = query.trim().toLowerCase()
  const source = editor && isInsideColumns(editor)
    ? slashCommands.filter((command) => !command.id.startsWith('columns-'))
    : slashCommands
  if (!normalized) return source

  // Title matches: title starts with query OR any word in title starts with query (e.g. Basic Table for table)
  const titleMatches = source.filter((command) => {
    const titleLower = command.title.toLowerCase()
    const words = titleLower.split(/\s+/u)
    return titleLower.startsWith(normalized) || words.some((word) => word.startsWith(normalized))
  })
  if (titleMatches.length > 0) return titleMatches

  return source.filter((command) => {
    const haystack = [command.title, command.description, ...command.keywords].join(' ').toLowerCase()
    return haystack.includes(normalized)
  })
}

function insertQuoteBlock(editor: Editor, range: SlashMenuState['range']) {
  const insertAt = range.from
  editor
    .chain()
    .focus()
    .deleteRange(range)
    .insertContent({ type: 'blockquote', content: [{ type: 'paragraph' }] })
    .run()

  const quoteTextStart = Math.min(insertAt + 2, editor.state.doc.content.size)
  editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, quoteTextStart)).scrollIntoView())
}

function insertCodeBlock(editor: Editor, range: SlashMenuState['range']) {
  editor
    .chain()
    .focus()
    .deleteRange(range)
    .setCodeBlock()
    .run()
}

export function runSlashCommand(
  editor: Editor,
  commandId: string,
  range: SlashMenuState['range'],
  isConversion = false,
) {
  if (isConversion && isFormatCommand(commandId)) {
    convertSelectedBlocks(editor, commandId)
    return
  }

  if (commandId === 'inline-code') {
    const selectedText = editor.state.doc.textBetween(range.from, range.to)
    const isSlashQuery = /^\/[a-zA-Z0-9-]*$/u.test(selectedText)
    const chain = editor.chain().focus()
    if (!isConversion && isSlashQuery) chain.deleteRange(range)
    chain.toggleCode().run()
    return
  }

  let chain = editor.chain().focus()
  if (!isConversion && range.from < range.to) {
    chain = chain.deleteRange(range)
  }

  if (commandId === 'paragraph') chain.setParagraph().run()
  else if (commandId === 'h1') chain.setHeading({ level: 1 }).run()
  else if (commandId === 'h2') chain.setHeading({ level: 2 }).run()
  else if (commandId === 'h3') chain.setHeading({ level: 3 }).run()
  else if (commandId === 'h4') chain.setHeading({ level: 4 }).run()
  else if (commandId === 'bullet') chain.toggleBulletList().run()
  else if (commandId === 'numbered') chain.toggleOrderedList().run()
  else if (commandId === 'task') chain.toggleTaskList().run()
  else if (commandId === 'callout') chain.insertContent(calloutNode()).run()
  else if (commandId === 'columns-2') {
    if (!isInsideColumns(editor)) chain.insertContent(columnsNode(2)).run()
  }
  else if (commandId === 'columns-3') {
    if (!isInsideColumns(editor)) chain.insertContent(columnsNode(3)).run()
  }
  else if (commandId === 'columns-4') {
    if (!isInsideColumns(editor)) chain.insertContent(columnsNode(4)).run()
  }
  else if (commandId === 'columns-5') {
    if (!isInsideColumns(editor)) chain.insertContent(columnsNode(5)).run()
  }
  else if (commandId === 'toggle') chain.insertContent(toggleBlockNode()).run()
  else if (commandId === 'toggle-h1') chain.insertContent(toggleBlockNode('Toggle', 1)).run()
  else if (commandId === 'toggle-h2') chain.insertContent(toggleBlockNode('Toggle', 2)).run()
  else if (commandId === 'toggle-h3') chain.insertContent(toggleBlockNode('Toggle', 3)).run()
  else if (commandId === 'toggle-h4') chain.insertContent(toggleBlockNode('Toggle', 4)).run()
  else if (commandId === 'toc') chain.insertContent([tableOfContentsNode(), { type: 'paragraph' }]).run()
  else if (commandId === 'database') chain.insertContent([databaseBlockNode(), { type: 'paragraph' }]).run()
  else if (commandId === 'date-time') {
    // Insert only the inline atom. ProseMirror already places the text cursor
    // after inline atoms; a literal NBSP spacer becomes document content and
    // leaves an unwanted character after the user clears adjacent text.
    chain.insertContent(dateTimeBlockNode()).run()
  }
  else if (commandId === 'document-link') {
    chain.run()
    window.dispatchEvent(new CustomEvent('mybook:insert-document-link'))
  }
  else if (commandId === 'image') {
    chain.run()
    window.dispatchEvent(new CustomEvent('mybook:insert-image'))
  }
  else if (commandId === 'video') {
    chain.run()
    window.dispatchEvent(new CustomEvent('mybook:insert-video'))
  }
  else if (commandId === 'audio') {
    chain.run()
    window.dispatchEvent(new CustomEvent('mybook:insert-audio'))
  }
  else if (commandId === 'file') {
    chain.run()
    window.dispatchEvent(new CustomEvent('mybook:insert-file'))
  }
  else if (commandId === 'quote') {
    if (isConversion) {
      chain.setBlockquote().run()
    } else {
      insertQuoteBlock(editor, range)
    }
  }
  else if (commandId === 'code-block') {
    if (isConversion) {
      chain.setCodeBlock().run()
    } else {
      insertCodeBlock(editor, range)
    }
  }
  else if (commandId === 'table') chain.insertTable({ rows: 2, cols: 2, withHeaderRow: false }).run()
  else if (commandId === 'hr') chain.setHorizontalRule().insertContent({ type: 'paragraph' }).run()
}
