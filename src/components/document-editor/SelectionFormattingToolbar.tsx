import {
  BoldIcon,
  CheckIcon,
  ChevronDownIcon,
  EllipsisHorizontalIcon,
  ItalicIcon,
  LinkIcon,
  StrikethroughIcon,
  UnderlineIcon,
} from '@heroicons/react/24/outline'
import type { Editor } from '@tiptap/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { TextSelection } from '@tiptap/pm/state'

import { BlockCommandMenu } from './SlashCommandMenu'
import { tableColors } from './extensions/TableCellStyles'
import { filterSlashCommands, type SlashCommand } from './slashCommands'

type ToolbarPosition = { left: number; top: number }
type ColorMenu = 'text' | 'highlight' | null

const textColors = [
  { name: 'Default', value: null },
  { name: 'Gray', value: '#6b7280' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Green', value: '#15803d' },
  { name: 'Yellow', value: '#a16207' },
  { name: 'Orange', value: '#c2410c' },
  { name: 'Red', value: '#dc2626' },
  { name: 'Purple', value: '#7e22ce' },
] as const

function selectionPosition(editor: Editor): ToolbarPosition | null {
  const { selection } = editor.state
  if (!(selection instanceof TextSelection) || selection.empty || !editor.isFocused || editor.isActive('codeBlock') || editor.isActive('table')) return null
  const { from, to } = selection
  const start = editor.view.coordsAtPos(from)
  const end = editor.view.coordsAtPos(to)
  if (!Number.isFinite(start.left) || !Number.isFinite(end.right)) return null
  return { left: Math.min(start.left, end.left), top: Math.min(start.top, end.top) - 44 }
}

function ToolButton({ label, active, children, onClick }: { label: string; active?: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`flex size-7 shrink-0 items-center justify-center rounded-[6px] text-foreground transition hover:bg-[var(--app-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${active ? 'bg-[var(--app-subtle)]' : ''}`}
    >
      {children}
    </button>
  )
}

export function SelectionFormattingToolbar({ editor, onInsertBlock, onEditLink, linkEditorOpen = false }: { editor: Editor; onInsertBlock: (commandId: string) => void; onEditLink: () => void; linkEditorOpen?: boolean }) {
  const [position, setPosition] = useState<ToolbarPosition | null>(null)
  const [colorMenu, setColorMenu] = useState<ColorMenu>(null)
  const [blockMenuOpen, setBlockMenuOpen] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [moreSelectedIndex, setMoreSelectedIndex] = useState(0)
  const savedRange = useRef<{ from: number; to: number } | null>(null)

  const linkEditorOpenRef = useRef(linkEditorOpen)
  linkEditorOpenRef.current = linkEditorOpen

  useEffect(() => {
    const update = () => {
      if (linkEditorOpenRef.current) return
      const selection = editor.state.selection
      if (!selection.empty && editor.isFocused) savedRange.current = { from: selection.from, to: selection.to }
      setPosition(selectionPosition(editor))
    }
    const updateOnScroll = () => {
      if (!linkEditorOpenRef.current) setPosition(selectionPosition(editor))
    }
    update()
    editor.on('selectionUpdate', update)
    editor.on('transaction', update)
    editor.on('focus', update)
    editor.on('blur', update)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', updateOnScroll, true)
    return () => {
      editor.off('selectionUpdate', update)
      editor.off('transaction', update)
      editor.off('focus', update)
      editor.off('blur', update)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', updateOnScroll, true)
    }
  }, [editor])

  useEffect(() => {
    if (!position) {
      setColorMenu(null)
      setBlockMenuOpen(false)
      setMoreMenuOpen(false)
    }
  }, [position])

  const restoreSelection = useCallback(() => {
    const range = savedRange.current
    if (!range) return
    const max = editor.state.doc.content.size
    const from = Math.min(range.from, max)
    const to = Math.min(range.to, max)
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, from, to)))
  }, [editor])

  const headingLevel = [1, 2, 3, 4].find((level) => editor.isActive('heading', { level }))
  const blockStyle = headingLevel ? `Heading ${headingLevel}` : 'Text'
  const setBlockStyle = (level: number) => {
    restoreSelection()
    const chain = editor.chain().focus()
    if (level === 0) chain.setParagraph().run()
    else chain.setHeading({ level: level as 1 | 2 | 3 | 4 }).run()
    setBlockMenuOpen(false)
  }
  const openLinkEditor = () => {
    restoreSelection()
    setColorMenu(null)
    setBlockMenuOpen(false)
    setMoreMenuOpen(false)
    onEditLink()
  }
  const applyColor = (kind: Exclude<ColorMenu, null>, value: string | null) => {
    restoreSelection()
    if (kind === 'text') {
      if (value) editor.chain().focus().setMark('textColor', { color: value }).run()
      else editor.chain().focus().unsetMark('textColor').run()
    } else if (value) editor.chain().focus().setMark('highlight', { color: value }).run()
    else editor.chain().focus().unsetMark('highlight').run()
    setColorMenu(null)
  }
  const moreCommands = filterSlashCommands('', editor)
  const runMoreCommand = useCallback((command: SlashCommand) => {
    restoreSelection()
    onInsertBlock(command.id)
    setMoreMenuOpen(false)
  }, [onInsertBlock, restoreSelection])

  useEffect(() => {
    if (!moreMenuOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setMoreMenuOpen(false)
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setMoreSelectedIndex((prev) => (moreCommands.length ? (prev + 1) % moreCommands.length : 0))
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setMoreSelectedIndex((prev) => (moreCommands.length ? (prev - 1 + moreCommands.length) % moreCommands.length : 0))
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        const cmd = moreCommands[moreSelectedIndex]
        if (cmd) runMoreCommand(cmd)
      }
    }
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [moreMenuOpen, moreCommands, moreSelectedIndex, runMoreCommand])

  useEffect(() => {
    if (!linkEditorOpen) setPosition(selectionPosition(editor))
  }, [editor, linkEditorOpen])

  const toolbarRef = useRef<HTMLDivElement>(null)
  const isOpen = position !== null

  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target || toolbarRef.current?.contains(target) || editor.view.dom.contains(target)) return
      if (target instanceof Element && target.closest('.mybook-inline-link-toolbar')) return
      const { selection } = editor.state
      if (selection.empty) return
      editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, selection.to)))
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [editor, isOpen])

  if (!position) return null

  const viewportHeight = typeof window !== 'undefined'
    ? (window.visualViewport && window.visualViewport.height > 0
        ? window.visualViewport.offsetTop + window.visualViewport.height
        : window.innerHeight)
    : 768

  const toolbarHeight = toolbarRef.current?.offsetHeight || 36
  const toolbarTop = position.top
  const toolbarBottom = position.top + toolbarHeight
  const spaceBelow = viewportHeight - toolbarBottom
  const spaceAbove = toolbarTop

  const openBlockOnTop = spaceBelow < 260 && spaceAbove > spaceBelow
  const openColorOnTop = spaceBelow < 260 && spaceAbove > spaceBelow
  const openMoreOnTop = spaceBelow < 340 && spaceAbove > spaceBelow
  const moreMaxHeight = Math.min(384, Math.max(160, (openMoreOnTop ? spaceAbove : spaceBelow) - 16))

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label="Selected text formatting"
      className="fixed z-30 hidden md:flex h-9 items-center gap-0.5 rounded-[8px] bg-[var(--app-surface)] px-1 text-foreground shadow-[0_8px_20px_rgba(0,0,0,0.12)]"
      style={{ left: position.left, top: position.top }}
      onMouseDown={(event) => event.preventDefault()}
    >
      <div className="relative">
        <button type="button" aria-label="Block style" aria-expanded={blockMenuOpen} onClick={() => { setBlockMenuOpen((open) => !open); setColorMenu(null) }} className="flex h-7 min-w-20 items-center justify-center gap-1.5 rounded-[6px] bg-[var(--app-subtle)] px-2 text-xs font-medium hover:bg-[var(--app-subtle)]/80">
          {blockStyle}<ChevronDownIcon aria-hidden="true" className="size-4" />
        </button>
        {blockMenuOpen ? (
          <div role="menu" aria-label="Block style" className={`absolute left-0 z-40 w-56 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-1.5 shadow-[0_12px_28px_rgba(0,0,0,0.14)] ${openBlockOnTop ? 'bottom-full mb-2' : 'top-full mt-2'}`}>
            {['Text', 'Heading 1', 'Heading 2', 'Heading 3', 'Heading 4'].map((label, index) => (
              <button key={label} type="button" role="menuitemradio" aria-checked={blockStyle === label} onClick={() => setBlockStyle(index)} className={`flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-left text-sm hover:bg-[var(--app-subtle)] ${blockStyle === label ? 'bg-[var(--app-subtle)]' : ''}`}>
                <span>{label}</span><span className="text-muted-foreground">{'#'.repeat(index)}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-[var(--app-border)]" />
      <ToolButton label="Bold" active={editor.isActive('bold')} onClick={() => { restoreSelection(); editor.chain().focus().toggleBold().run() }}><BoldIcon className="size-4" /></ToolButton>
      <ToolButton label="Underline" active={editor.isActive('underline')} onClick={() => { restoreSelection(); editor.chain().focus().toggleUnderline().run() }}><UnderlineIcon className="size-4" /></ToolButton>
      <ToolButton label="Italic" active={editor.isActive('italic')} onClick={() => { restoreSelection(); editor.chain().focus().toggleItalic().run() }}><ItalicIcon className="size-4" /></ToolButton>
      <ToolButton label="Strikethrough" active={editor.isActive('strike')} onClick={() => { restoreSelection(); editor.chain().focus().toggleStrike().run() }}><StrikethroughIcon className="size-4" /></ToolButton>
      <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-[var(--app-border)]" />
      <div className="relative">
        <ToolButton label="Text color" active={editor.isActive('textColor')} onClick={() => { setColorMenu((current) => current === 'text' ? null : 'text'); setBlockMenuOpen(false) }}>
          <span className="flex h-5 flex-col items-center justify-center text-sm font-medium leading-none">A<span className="mt-0.5 h-0.5 w-3 rounded-full" style={{ backgroundColor: editor.getAttributes('textColor').color ?? 'currentColor' }} /></span>
        </ToolButton>
        {colorMenu === 'text' ? (
          <div role="menu" aria-label="Text color" className={`absolute left-1/2 z-40 w-48 -translate-x-1/2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-1.5 shadow-[0_12px_28px_rgba(0,0,0,0.14)] ${openColorOnTop ? 'bottom-full mb-2' : 'top-full mt-2'}`}>
            {textColors.map((color) => <button key={color.name} type="button" role="menuitemradio" aria-checked={(editor.getAttributes('textColor').color ?? null) === color.value} onClick={() => applyColor('text', color.value)} className="flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-[var(--app-subtle)]"><span className="size-4 rounded border border-[var(--app-border)]" style={{ backgroundColor: color.value ?? 'transparent' }}>{color.value ? null : <span className="block rotate-45 border-t border-destructive" />}</span>{color.name}{(editor.getAttributes('textColor').color ?? null) === color.value ? <CheckIcon className="ml-auto size-4" /> : null}</button>)}
          </div>
        ) : null}
      </div>
      <div className="relative">
        <ToolButton label="Highlight" active={editor.isActive('highlight')} onClick={() => { setColorMenu((current) => current === 'highlight' ? null : 'highlight'); setBlockMenuOpen(false) }}>
          <span className="flex size-4 items-center justify-center rounded border border-current text-[10px] font-bold" style={{ backgroundColor: editor.getAttributes('highlight').color ?? 'transparent' }}>H</span>
        </ToolButton>
        {colorMenu === 'highlight' ? (
          <div role="menu" aria-label="Highlight color" className={`absolute left-1/2 z-40 w-48 -translate-x-1/2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-1.5 shadow-[0_12px_28px_rgba(0,0,0,0.14)] ${openColorOnTop ? 'bottom-full mb-2' : 'top-full mt-2'}`}>
            <button type="button" role="menuitem" onClick={() => applyColor('highlight', null)} className="flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-[var(--app-subtle)]">Remove highlight</button>
            {tableColors.filter((color) => color.name !== 'White').map((color) => <button key={color.name} type="button" role="menuitemradio" aria-checked={editor.getAttributes('highlight').color === color.value} onClick={() => applyColor('highlight', color.value)} className="flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-[var(--app-subtle)]"><span className="size-4 rounded border border-[var(--app-border)]" style={{ backgroundColor: color.value }} />{color.name}{editor.getAttributes('highlight').color === color.value ? <CheckIcon className="ml-auto size-4" /> : null}</button>)}
          </div>
        ) : null}
      </div>
      <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-[var(--app-border)]" />
      <ToolButton label="Link" active={editor.isActive('link')} onClick={openLinkEditor}><LinkIcon className="size-4" /></ToolButton>
      <ToolButton label="Checklist" active={editor.isActive('taskList')} onClick={() => { restoreSelection(); editor.chain().focus().toggleTaskList().run() }}><span className="relative"><CheckIcon className="size-4" /><span aria-hidden="true" className="absolute -right-1 -top-0.5 size-3 border border-current" /></span></ToolButton>
      <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-[var(--app-border)]" />
      <div className="relative">
        <ToolButton label="More options" active={moreMenuOpen} onClick={() => { setMoreMenuOpen((open) => !open); setColorMenu(null); setBlockMenuOpen(false) }}><EllipsisHorizontalIcon className="size-4" /></ToolButton>
        {moreMenuOpen ? (
          <div
            data-command-menu-scroller="true"
            className={`absolute right-0 z-40 w-[min(20rem,calc(100vw-1rem))] overflow-y-auto rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-1.5 text-foreground shadow-[0_12px_28px_rgba(0,0,0,0.16)] ${openMoreOnTop ? 'bottom-full mb-2' : 'top-full mt-2'}`}
            style={{ maxHeight: moreMaxHeight }}
          >
            <BlockCommandMenu
              ariaLabel="More block options"
              commands={moreCommands}
              selectedIndex={moreSelectedIndex}
              onSelectIndex={setMoreSelectedIndex}
              onRun={runMoreCommand}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
