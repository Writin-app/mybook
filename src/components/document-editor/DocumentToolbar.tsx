import {
  AddCircleIcon,
  ArrowDown01Icon,
  ArrowLeft02Icon,
  ArrowReloadHorizontalIcon,
  Attachment01Icon,
  CancelCircleIcon,
  CheckListIcon,
  CodeIcon,
  File01Icon,
  Heading01Icon,
  Heading02Icon,
  Heading03Icon,
  Image01Icon,
  InformationCircleIcon as HugeInformationCircleIcon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  Link02Icon,
  MinusSignIcon,
  MusicNote01Icon,
  QuoteDownIcon,
  Redo03Icon,
  Search01Icon,
  TableIcon,
  TextBoldIcon,
  TextColorIcon,
  TextFontIcon,
  TextItalicIcon,
  TextStrikethroughIcon,
  TextUnderlineIcon,
  Tick02Icon,
  Undo03Icon,
  Unlink02Icon,
  Video01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import {
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  BackspaceIcon,
  BoldIcon,
  ChatBubbleBottomCenterTextIcon,
  ChevronRightIcon,
  CodeBracketIcon,
  CommandLineIcon,
  EllipsisHorizontalIcon,
  InformationCircleIcon,
  ItalicIcon,
  LinkIcon,
  ListBulletIcon,
  MinusIcon,
  NumberedListIcon,
  PaperClipIcon,
  PhotoIcon,
  QueueListIcon,
  StrikethroughIcon,
  TableCellsIcon,
  UnderlineIcon,
} from '@heroicons/react/24/outline'
import type { Editor } from '@tiptap/react'
import { useEffect, useRef, useState } from 'react'

import { useKeyboardOffset } from '../../hooks/useVisualViewport'
import { MobileBottomSheet } from '../common/MobileBottomSheet'
import { convertSelectedBlocks } from './blockConversion'
import { calloutNode } from './extensions/Callout'
import { toggleBlockNode } from './extensions/ToggleBlock'
import { filterSlashCommands, groupSlashCommands, isInsideColumns, runSlashCommand, slashCommands } from './slashCommands'

function KeyboardHideIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      className={className ?? 'size-4.5'}
    >
      <rect x="3" y="4" width="18" height="11" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="7" cy="8" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="10" cy="8" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="13" cy="8" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="16" cy="8" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="7" cy="11" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="10" cy="11" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="13" cy="11" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="16" cy="11" r="0.75" fill="currentColor" stroke="none" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 18.5l3 2.5 3-2.5" />
    </svg>
  )
}



function getBlockTriggerLabel(editor: Editor): string {
  if (editor.isActive('heading', { level: 1 })) return 'Heading 1'
  if (editor.isActive('heading', { level: 2 })) return 'Heading 2'
  if (editor.isActive('heading', { level: 3 })) return 'Heading 3'
  if (editor.isActive('heading', { level: 4 })) return 'Heading 4'
  if (editor.isActive('toggleBlock')) {
    const level = editor.getAttributes('toggleBlock').level as number | null | undefined
    if (level === 1) return 'Toggle H1'
    if (level === 2) return 'Toggle H2'
    if (level === 3) return 'Toggle H3'
    if (level === 4) return 'Toggle H4'
    return 'Toggle'
  }
  return 'Text'
}

const textColors = [
  { name: 'Default', value: null },
  { name: 'Red', value: '#dc2626' },
  { name: 'Green', value: '#15803d' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Yellow', value: '#a16207' },
  { name: 'Orange', value: '#c2410c' },
  { name: 'Purple', value: '#7e22ce' },
  { name: 'Gray', value: '#6b7280' },
] as const

const highlightColors = [
  { name: 'None', value: null },
  { name: 'Red', value: '#fee2e2' },
  { name: 'Green', value: '#dcfce7' },
  { name: 'Blue', value: '#dbeafe' },
  { name: 'Yellow', value: '#fef9c3' },
  { name: 'Orange', value: '#ffedd5' },
  { name: 'Purple', value: '#f3e8ff' },
  { name: 'Gray', value: '#f3f4f6' },
] as const

const blockOptions = [
  { id: 'text', label: 'Text' },
  { id: 'h1', label: 'Heading 1' },
  { id: 'h2', label: 'Heading 2' },
  { id: 'h3', label: 'Heading 3' },
  { id: 'h4', label: 'Heading 4' },
  { id: 'toggle-h1', label: 'Toggle Heading 1' },
  { id: 'toggle-h2', label: 'Toggle Heading 2' },
  { id: 'toggle-h3', label: 'Toggle Heading 3' },
] as const

const mobileBlockHugeicons: Record<string, IconSvgElement> = {
  paragraph: TextFontIcon,
  h1: Heading01Icon,
  h2: Heading02Icon,
  h3: Heading03Icon,
  h4: Heading03Icon,
  quote: QuoteDownIcon,
  hr: MinusSignIcon,
  bullet: LeftToRightListBulletIcon,
  numbered: LeftToRightListNumberIcon,
  task: CheckListIcon,
  toggle: ArrowDown01Icon,
  'toggle-h1': ArrowDown01Icon,
  'toggle-h2': ArrowDown01Icon,
  'toggle-h3': ArrowDown01Icon,
  'toggle-h4': ArrowDown01Icon,
  image: Image01Icon,
  video: Video01Icon,
  audio: MusicNote01Icon,
  file: Attachment01Icon,
  'document-link': File01Icon,
  table: TableIcon,
  database: TableIcon,
  'date-time': File01Icon,
  callout: HugeInformationCircleIcon,
  'columns-2': TableIcon,
  'columns-3': TableIcon,
  'columns-4': TableIcon,
  'columns-5': TableIcon,
  toc: LeftToRightListBulletIcon,
  'code-block': CodeIcon,
  'inline-code': CodeIcon,
}

interface ToolButtonProps {
  label: string
  icon?: typeof BoldIcon
  hugeIcon?: IconSvgElement
  children?: React.ReactNode
  active?: boolean
  disabled?: boolean
  onPress: () => void
  isMobile?: boolean
  dataTrigger?: string
}

function ToolButton({ label, icon: Icon, hugeIcon, children, active, disabled, onPress, isMobile, dataTrigger }: ToolButtonProps) {
  const runPreservingScroll = () => {
    const scrollTargets = [
      document.querySelector('main'),
      document.scrollingElement,
    ].filter((target): target is Element => Boolean(target))
    const positions = scrollTargets.map((target) => ({ target, top: target.scrollTop, left: target.scrollLeft }))

    onPress()

    const restore = () => {
      for (const { target, top, left } of positions) {
        target.scrollTop = top
        target.scrollLeft = left
      }
    }
    window.requestAnimationFrame(() => {
      restore()
      window.requestAnimationFrame(restore)
    })
  }

  if (isMobile) {
    return (
      <button
        type="button"
        title={label}
        aria-label={label}
        aria-pressed={active}
        disabled={disabled}
        data-color-trigger={dataTrigger}
        onMouseDown={(event) => event.preventDefault()}
        onClick={runPreservingScroll}
        className={`flex size-8 shrink-0 items-center justify-center rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40 ${
          active
            ? 'bg-[var(--app-subtle)] font-bold text-foreground ring-1 ring-[var(--app-border)] shadow-sm'
            : 'text-muted-foreground hover:bg-[var(--app-subtle)] hover:text-foreground'
        }`}
      >
        {children ? children : hugeIcon ? <HugeiconsIcon icon={hugeIcon} size={18} /> : Icon ? <Icon aria-hidden="true" className="size-4.5" /> : null}
      </button>
    )
  }

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={runPreservingScroll}
      className={`flex size-11 min-h-11 min-w-11 items-center justify-center rounded-[10px] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40 ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-[var(--app-subtle)]'}`}
    >
      {children ? children : Icon ? <Icon aria-hidden="true" className="size-5" /> : null}
    </button>
  )
}


function ToolbarControls({
  editor,
  idPrefix,
  variant,
  onInsertFile,
  onInsertImage,
  onInsertBlock,
  onEditLink,
  keyboardOffset = 0,
}: {
  editor: Editor
  idPrefix: string
  variant: 'desktop' | 'mobile'
  onInsertFile?: () => void
  onInsertImage?: () => void
  onInsertBlock?: (commandId: string) => void
  onEditLink?: () => void
  keyboardOffset?: number
}) {
  const setLink = () => {
    if (onEditLink && !editor.state.selection.empty) {
      onEditLink()
      return
    }
    const current = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Link URL', current ?? 'https://')
    if (url === null) return
    if (!url.trim()) editor.chain().focus().extendMarkRange('link').unsetLink().run()
    else editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
  }
  const insertQuote = () => {
    const { from, to } = editor.state.selection
    runSlashCommand(editor, 'quote', { from, to })
  }

  const activeToggleLevel = editor.isActive('toggleBlock') && !editor.isActive('heading')
    ? (editor.getAttributes('toggleBlock').level as number | null | undefined)
    : null

  const heading = activeToggleLevel
    ? String(activeToggleLevel)
    : editor.isActive('heading', { level: 1 })
      ? '1'
      : editor.isActive('heading', { level: 2 })
        ? '2'
        : editor.isActive('heading', { level: 3 })
          ? '3'
          : editor.isActive('heading', { level: 4 })
            ? '4'
            : '0'

  const moreActions = [
    { label: 'Quote', icon: ChatBubbleBottomCenterTextIcon, active: editor.isActive('blockquote'), disabled: false, run: insertQuote },
    { label: 'Link', icon: LinkIcon, active: editor.isActive('link'), disabled: false, run: setLink },
    { label: 'Callout', icon: InformationCircleIcon, active: editor.isActive('callout'), disabled: false, run: () => editor.chain().focus().insertContent(calloutNode()).run() },
    { label: 'Toggle', icon: ChevronRightIcon, active: editor.isActive('toggleBlock'), disabled: false, run: () => editor.chain().focus().insertContent(toggleBlockNode()).run() },
    { label: 'Image', icon: PhotoIcon, active: editor.isActive('imageBlock'), disabled: !onInsertImage, run: () => onInsertImage?.() },
    { label: 'File', icon: PaperClipIcon, active: editor.isActive('fileAttachment'), disabled: !onInsertFile, run: () => onInsertFile?.() },
    { label: 'Basic Table', icon: TableCellsIcon, active: editor.isActive('table'), disabled: !editor.can().chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: false }).run(), run: () => editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: false }).run() },
    { label: 'Horizontal rule', icon: MinusIcon, active: false, disabled: !editor.can().chain().focus().setHorizontalRule().run(), run: () => editor.chain().focus().setHorizontalRule().run() },
    { label: 'Inline code', icon: CodeBracketIcon, active: editor.isActive('code'), disabled: !editor.can().chain().focus().toggleCode().run(), run: () => editor.chain().focus().toggleCode().run() },
    { label: 'Code block', icon: CommandLineIcon, active: editor.isActive('codeBlock'), disabled: !editor.can().chain().focus().toggleCodeBlock().run(), run: () => editor.chain().focus().toggleCodeBlock().run() },
    { label: 'Strikethrough', icon: StrikethroughIcon, active: editor.isActive('strike'), disabled: !editor.can().chain().focus().toggleStrike().run(), run: () => editor.chain().focus().toggleStrike().run() },
    { label: 'Clear formatting', icon: BackspaceIcon, active: false, disabled: !editor.can().chain().focus().unsetAllMarks().clearNodes().run(), run: () => editor.chain().focus().unsetAllMarks().clearNodes().run() },
  ]

  const [isManualFormatMode, setIsManualFormatMode] = useState(false)
  const [isFormatDismissed, setIsFormatDismissed] = useState(false)
  const [activeSubmenu, setActiveSubmenu] = useState<'block-type' | 'text-color' | 'bg-color' | 'link' | null>(null)
  const [isAddBlockOpen, setIsAddBlockOpen] = useState(false)
  const [isReplacingBlock, setIsReplacingBlock] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [linkUrlInput, setLinkUrlInput] = useState('')
  const lastFromPosRef = useRef(editor.state.selection.from)

  const hasSelection = !editor.state.selection.empty
  const parentNode = editor.state.selection.$from.parent
  const isBlockWritten = Boolean(parentNode && parentNode.isTextblock && parentNode.textContent.trim().length > 0)

  useEffect(() => {
    if (Math.abs(editor.state.selection.from - lastFromPosRef.current) > 1) {
      setIsFormatDismissed(false)
    }
    lastFromPosRef.current = editor.state.selection.from
  }, [editor.state.selection.from])

  const isFormatMode = hasSelection || isManualFormatMode || (editor.isFocused && isBlockWritten && !isFormatDismissed)
  const currentBlockLabel = getBlockTriggerLabel(editor)

  useEffect(() => {
    if (!activeSubmenu) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('.mybook-mobile-document-toolbar')) return
      setActiveSubmenu(null)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [activeSubmenu])

  useEffect(() => {
    if (!isAddBlockOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('.mybook-mobile-document-toolbar')) return
      setIsAddBlockOpen(false)
      setIsReplacingBlock(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isAddBlockOpen])

  const dismissKeyboard = () => {
    if (isAddBlockOpen) {
      setIsAddBlockOpen(false)
      setIsReplacingBlock(false)
    }
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    editor.commands.blur()
  }

  const toggleBullet = () => {
    if (editor.isActive('bulletList')) {
      editor.chain().focus().toggleBulletList().run()
    } else {
      convertSelectedBlocks(editor, 'bullet')
    }
  }

  const toggleTask = () => {
    if (editor.isActive('taskList')) {
      editor.chain().focus().toggleTaskList().run()
    } else {
      convertSelectedBlocks(editor, 'task')
    }
  }

  const applyBlockOption = (id: string) => {
    if (id === 'text') {
      if (editor.isActive('toggleBlock')) {
        editor.chain().focus().updateAttributes('toggleBlock', { level: null }).run()
      } else {
        editor.chain().focus().setParagraph().run()
      }
    } else if (id === 'h1') {
      if (editor.isActive('toggleBlock')) {
        editor.chain().focus().updateAttributes('toggleBlock', { level: 1 }).run()
      } else {
        editor.chain().focus().setHeading({ level: 1 }).run()
      }
    } else if (id === 'h2') {
      if (editor.isActive('toggleBlock')) {
        editor.chain().focus().updateAttributes('toggleBlock', { level: 2 }).run()
      } else {
        editor.chain().focus().setHeading({ level: 2 }).run()
      }
    } else if (id === 'h3') {
      if (editor.isActive('toggleBlock')) {
        editor.chain().focus().updateAttributes('toggleBlock', { level: 3 }).run()
      } else {
        editor.chain().focus().setHeading({ level: 3 }).run()
      }
    } else if (id === 'h4') {
      if (editor.isActive('toggleBlock')) {
        editor.chain().focus().updateAttributes('toggleBlock', { level: 4 }).run()
      } else {
        editor.chain().focus().setHeading({ level: 4 }).run()
      }
    } else if (id === 'toggle-h1') {
      if (editor.isActive('toggleBlock')) {
        editor.chain().focus().updateAttributes('toggleBlock', { level: 1 }).run()
      } else {
        editor.chain().focus().insertContent(toggleBlockNode('Toggle', 1)).run()
      }
    } else if (id === 'toggle-h2') {
      if (editor.isActive('toggleBlock')) {
        editor.chain().focus().updateAttributes('toggleBlock', { level: 2 }).run()
      } else {
        editor.chain().focus().insertContent(toggleBlockNode('Toggle', 2)).run()
      }
    } else if (id === 'toggle-h3') {
      if (editor.isActive('toggleBlock')) {
        editor.chain().focus().updateAttributes('toggleBlock', { level: 3 }).run()
      } else {
        editor.chain().focus().insertContent(toggleBlockNode('Toggle', 3)).run()
      }
    }
    setActiveSubmenu(null)
  }

  if (variant === 'mobile') {
    const allAvailableCommands = isInsideColumns(editor)
      ? slashCommands.filter((command) => !command.id.startsWith('columns-'))
      : slashCommands
    const filteredCommands = filterSlashCommands(searchQuery, editor).filter((command) =>
      allAvailableCommands.some((c) => c.id === command.id)
    )
    const groupedInsertCommands = groupSlashCommands(filteredCommands)

    const toolbarPillClass =
      'flex h-[42px] w-full items-center justify-between rounded-full border border-[var(--app-border)]/80 bg-[var(--app-surface)]/95 px-2.5 py-1 shadow-[0_8px_24px_rgba(0,0,0,0.14),0_2px_6px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur-2xl'
    const subtoolbarPillClass =
      'flex h-[34px] w-full items-center justify-between rounded-full border border-[var(--app-border)]/80 bg-[var(--app-surface)]/95 px-2.5 py-1 shadow-[0_8px_24px_rgba(0,0,0,0.14),0_2px_6px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-2 duration-150'

    const showKeyboardDismiss = keyboardOffset > 50

    return (
      <div
        role="toolbar"
        aria-label="Document formatting"
        className={`mybook-mobile-document-toolbar pointer-events-none fixed inset-x-0 bottom-0 z-40 ${
          keyboardOffset > 0 ? '' : 'transition-[bottom] duration-150'
        } md:hidden ${
          isAddBlockOpen
            ? 'pb-0'
            : keyboardOffset > 0
              ? 'pb-2'
              : 'pb-[max(0.75rem,env(safe-area-inset-bottom))]'
        }`}
        style={{ bottom: isAddBlockOpen ? 0 : keyboardOffset }}
      >
        <div className="flex w-full flex-col items-center pointer-events-auto">
          {/* Sub-toolbar and Main / Format Toolbar Row */}
          <div className={`flex w-full flex-col items-center gap-1.5 px-4 ${isAddBlockOpen ? 'mb-2' : ''}`}>
            {/* Sub-toolbar pill: Text Block Toolbar / Text Color / Highlight / Link */}
            {activeSubmenu ? (
              <div className={subtoolbarPillClass}>
                {activeSubmenu === 'block-type' ? (
                  <div
                    role="group"
                    aria-label="Block choices"
                    className="scrollbar-none flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none]"
                  >
                    {blockOptions.map((opt) => {
                      const isSelected = currentBlockLabel === opt.label || (opt.id === 'text' && currentBlockLabel === 'Text')
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => applyBlockOption(opt.id)}
                          className={`flex h-6 shrink-0 items-center rounded-full border px-2.5 text-xs font-medium transition ${
                            isSelected
                              ? 'border-[var(--app-border)] bg-[var(--app-subtle)] font-bold text-foreground ring-1 ring-[var(--app-border)] shadow-sm'
                              : 'border-[var(--app-border)]/60 bg-[var(--app-surface)] text-muted-foreground hover:bg-[var(--app-subtle)] hover:text-foreground'
                          }`}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                ) : null}

                {activeSubmenu === 'text-color' ? (
                  <>
                    <div
                      role="menu"
                      aria-label="Text color"
                      className="scrollbar-none flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none]"
                    >
                      {textColors.map((color) => {
                        const isSelected = (editor.getAttributes('textColor').color ?? null) === color.value
                        return (
                          <button
                            key={color.name}
                            type="button"
                            role="menuitemradio"
                            aria-checked={isSelected}
                            onClick={() => {
                              if (color.value) {
                                editor.chain().focus().setMark('textColor', { color: color.value }).run()
                              } else {
                                editor.chain().focus().unsetMark('textColor').run()
                              }
                              setActiveSubmenu(null)
                            }}
                            className={`flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition ${
                              isSelected
                                ? 'border-[var(--app-border)] bg-[var(--app-subtle)] font-bold text-foreground ring-1 ring-[var(--app-border)] shadow-sm'
                                : 'border-[var(--app-border)]/60 bg-[var(--app-surface)] text-foreground hover:bg-[var(--app-subtle)]'
                            }`}
                          >
                            <HugeiconsIcon icon={TextFontIcon} size={13} style={{ color: color.value ?? 'currentColor' }} />
                            <span>{color.name}</span>
                            <span
                              className="size-2 shrink-0 rounded-full"
                              style={{ backgroundColor: color.value ?? 'currentColor' }}
                            />
                          </button>
                        )
                      })}
                    </div>
                    <div className="flex flex-none items-center pl-1">
                      <span aria-hidden="true" className="mx-0.5 h-3.5 w-px flex-none bg-[var(--app-border)]" />
                      <button
                        type="button"
                        aria-label="Close text colors"
                        onClick={() => setActiveSubmenu(null)}
                        className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-[var(--app-subtle)] hover:text-foreground"
                      >
                        <HugeiconsIcon icon={CancelCircleIcon} size={18} />
                      </button>
                    </div>
                  </>
                ) : null}

                {activeSubmenu === 'bg-color' ? (
                  <>
                    <div
                      role="menu"
                      aria-label="Highlight color"
                      className="scrollbar-none flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none]"
                    >
                      {highlightColors.map((color) => {
                        const isSelected = (editor.getAttributes('highlight').color ?? null) === color.value
                        return (
                          <button
                            key={color.name}
                            type="button"
                            role="menuitemradio"
                            aria-checked={isSelected}
                            onClick={() => {
                              if (color.value) {
                                editor.chain().focus().setMark('highlight', { color: color.value }).run()
                              } else {
                                editor.chain().focus().unsetMark('highlight').run()
                              }
                              setActiveSubmenu(null)
                            }}
                            className={`flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition ${
                              isSelected
                                ? 'border-[var(--app-border)] bg-[var(--app-subtle)] font-bold text-foreground ring-1 ring-[var(--app-border)] shadow-sm'
                                : 'border-[var(--app-border)]/60 bg-[var(--app-surface)] text-foreground hover:bg-[var(--app-subtle)]'
                            }`}
                          >
                            <svg viewBox="0 0 24 24" className="size-3.5 shrink-0">
                              <path
                                d="M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z"
                                fill={color.value ?? 'transparent'}
                                stroke="currentColor"
                                strokeWidth="1.5"
                              />
                            </svg>
                            <span>{color.name}</span>
                          </button>
                        )
                      })}
                    </div>
                    <div className="flex flex-none items-center pl-1">
                      <span aria-hidden="true" className="mx-0.5 h-3.5 w-px flex-none bg-[var(--app-border)]" />
                      <button
                        type="button"
                        aria-label="Close highlight colors"
                        onClick={() => setActiveSubmenu(null)}
                        className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-[var(--app-subtle)] hover:text-foreground"
                      >
                        <HugeiconsIcon icon={CancelCircleIcon} size={18} />
                      </button>
                    </div>
                  </>
                ) : null}

                {activeSubmenu === 'link' ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault()
                      const trimmed = linkUrlInput.trim()
                      if (!trimmed) {
                        editor.chain().focus().extendMarkRange('link').unsetLink().run()
                      } else {
                        const normalized = /^https?:\/\//i.test(trimmed) || trimmed.startsWith('/') || trimmed.startsWith('#')
                          ? trimmed
                          : `https://${trimmed}`
                        editor.chain().focus().extendMarkRange('link').setLink({ href: normalized }).run()
                      }
                      setActiveSubmenu(null)
                    }}
                    className="flex min-w-0 flex-1 items-center gap-1.5"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-1 rounded-full bg-[var(--app-subtle)] px-2.5 py-0.5">
                      <HugeiconsIcon icon={Link02Icon} size={14} className="shrink-0 text-muted-foreground" />
                      <input
                        type="url"
                        value={linkUrlInput}
                        onChange={(e) => setLinkUrlInput(e.target.value)}
                        placeholder="Paste link or URL…"
                        autoFocus
                        className="w-full min-w-0 border-0 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      aria-label="Apply link"
                      className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition hover:opacity-90"
                    >
                      <HugeiconsIcon icon={Tick02Icon} size={14} />
                    </button>
                    {editor.isActive('link') ? (
                      <button
                        type="button"
                        aria-label="Remove link"
                        title="Remove link"
                        onClick={() => {
                          editor.chain().focus().extendMarkRange('link').unsetLink().run()
                          setActiveSubmenu(null)
                        }}
                        className="flex size-6 shrink-0 items-center justify-center rounded-full text-destructive transition hover:bg-[var(--app-subtle)]"
                      >
                        <HugeiconsIcon icon={Unlink02Icon} size={14} />
                      </button>
                    ) : null}
                    <div className="flex flex-none items-center pl-0.5">
                      <button
                        type="button"
                        aria-label="Close link toolbar"
                        onClick={() => setActiveSubmenu(null)}
                        className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-[var(--app-subtle)] hover:text-foreground"
                      >
                        <HugeiconsIcon icon={CancelCircleIcon} size={16} />
                      </button>
                    </div>
                  </form>
                ) : null}
              </div>
            ) : null}

            {/* Main / Format Toolbar Row */}
            {isFormatMode ? (
              <div className={toolbarPillClass}>
                {/* Left scrollable part */}
                <div className="scrollbar-none flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none]">
                  <ToolButton
                    label="Back to main toolbar"
                    hugeIcon={ArrowLeft02Icon}
                    onPress={() => {
                      setIsManualFormatMode(false)
                      setIsFormatDismissed(true)
                      setActiveSubmenu(null)
                      setIsAddBlockOpen(false)
                      setIsReplacingBlock(false)
                      if (hasSelection) {
                        const { to } = editor.state.selection
                        editor.commands.setTextSelection(to)
                      }
                    }}
                    isMobile
                  />
                  <ToolButton
                    label="Replace block"
                    hugeIcon={ArrowReloadHorizontalIcon}
                    active={isAddBlockOpen && isReplacingBlock}
                    onPress={() => {
                      setActiveSubmenu(null)
                      if (document.activeElement instanceof HTMLElement) {
                        document.activeElement.blur()
                      }
                      editor.commands.blur()
                      setIsReplacingBlock(true)
                      setIsAddBlockOpen(true)
                    }}
                    isMobile
                  />

                  <span aria-hidden="true" className="mx-0.5 h-3.5 w-px flex-none bg-[var(--app-border)]" />

                  <ToolButton label="Bold" hugeIcon={TextBoldIcon} active={editor.isActive('bold')} disabled={!editor.can().chain().focus().toggleBold().run()} onPress={() => editor.chain().focus().toggleBold().run()} isMobile />
                  <ToolButton label="Underline" hugeIcon={TextUnderlineIcon} active={editor.isActive('underline')} disabled={!editor.can().chain().focus().toggleUnderline().run()} onPress={() => editor.chain().focus().toggleUnderline().run()} isMobile />
                  <ToolButton label="Italic" hugeIcon={TextItalicIcon} active={editor.isActive('italic')} disabled={!editor.can().chain().focus().toggleItalic().run()} onPress={() => editor.chain().focus().toggleItalic().run()} isMobile />
                  <ToolButton label="Strikethrough" hugeIcon={TextStrikethroughIcon} active={editor.isActive('strike')} disabled={!editor.can().chain().focus().toggleStrike().run()} onPress={() => editor.chain().focus().toggleStrike().run()} isMobile />

                  <span aria-hidden="true" className="mx-0.5 h-3.5 w-px flex-none bg-[var(--app-border)]" />

                  <ToolButton
                    label="Text color"
                    active={activeSubmenu === 'text-color' || Boolean(editor.isActive('textColor'))}
                    onPress={() => {
                      setIsAddBlockOpen(false)
                      setIsReplacingBlock(false)
                      setActiveSubmenu((prev) => (prev === 'text-color' ? null : 'text-color'))
                    }}
                    isMobile
                  >
                    <span className="relative flex size-8 items-center justify-center">
                      <HugeiconsIcon icon={TextColorIcon} size={18} />
                      <span
                        className="absolute bottom-1.5 h-0.5 w-3.5 rounded-full"
                        style={{ backgroundColor: (editor.getAttributes('textColor').color as string | undefined) ?? 'currentColor' }}
                      />
                    </span>
                  </ToolButton>

                  <ToolButton
                    label="Highlight"
                    active={activeSubmenu === 'bg-color' || Boolean(editor.isActive('highlight'))}
                    onPress={() => {
                      setIsAddBlockOpen(false)
                      setIsReplacingBlock(false)
                      setActiveSubmenu((prev) => (prev === 'bg-color' ? null : 'bg-color'))
                    }}
                    isMobile
                  >
                    <span className="flex size-8 items-center justify-center">
                      <svg viewBox="0 0 24 24" className="size-4" fill={(editor.getAttributes('highlight').color as string | undefined) ?? 'currentColor'}>
                        <path
                          d="M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z"
                          fill={(editor.getAttributes('highlight').color as string | undefined) ?? 'currentColor'}
                        />
                      </svg>
                    </span>
                  </ToolButton>

                  <span aria-hidden="true" className="mx-0.5 h-3.5 w-px flex-none bg-[var(--app-border)]" />

                  <ToolButton
                    label="Link"
                    hugeIcon={Link02Icon}
                    active={activeSubmenu === 'link' || Boolean(editor.isActive('link'))}
                    onPress={() => {
                      setIsAddBlockOpen(false)
                      setIsReplacingBlock(false)
                      if (activeSubmenu === 'link') {
                        setActiveSubmenu(null)
                      } else {
                        const current = (editor.getAttributes('link').href as string | undefined) ?? ''
                        setLinkUrlInput(current)
                        setActiveSubmenu('link')
                      }
                    }}
                    isMobile
                  />
                  <ToolButton
                    label="Inline code"
                    hugeIcon={CodeIcon}
                    active={editor.isActive('code')}
                    disabled={!editor.can().chain().focus().toggleCode().run()}
                    onPress={() => editor.chain().focus().toggleCode().run()}
                    isMobile
                  />
                </div>

                {/* Right fixed area: Keyboard dismiss */}
                {showKeyboardDismiss ? (
                  <div className="flex flex-none items-center pl-1" role="group" aria-label="Keyboard control">
                    <span aria-hidden="true" className="mx-0.5 h-3.5 w-px flex-none bg-[var(--app-border)]" />
                    <button
                      type="button"
                      title="Hide keyboard"
                      aria-label="Hide keyboard"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={dismissKeyboard}
                      className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-[var(--app-subtle)] hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                    >
                      <KeyboardHideIcon className="size-4.5" />
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className={toolbarPillClass}>
                {/* Left scrollable part */}
                <div className="scrollbar-none flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none]">
                  <ToolButton
                    label="Format text"
                    hugeIcon={TextFontIcon}
                    active={isFormatMode}
                    onPress={() => {
                      setIsManualFormatMode(true)
                      setIsFormatDismissed(false)
                      setActiveSubmenu(null)
                      setIsAddBlockOpen(false)
                      setIsReplacingBlock(false)
                    }}
                    isMobile
                  />

                  <span aria-hidden="true" className="mx-0.5 h-3.5 w-px flex-none bg-[var(--app-border)]" />

                  <button
                    type="button"
                    aria-label="Block style"
                    aria-expanded={activeSubmenu === 'block-type'}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setIsAddBlockOpen(false)
                      setIsReplacingBlock(false)
                      setActiveSubmenu((prev) => (prev === 'block-type' ? null : 'block-type'))
                    }}
                    className={`flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-semibold transition ${
                      activeSubmenu === 'block-type'
                        ? 'bg-[var(--app-subtle)] text-foreground ring-1 ring-[var(--app-border)] shadow-sm'
                        : 'text-foreground hover:bg-[var(--app-subtle)]'
                    }`}
                  >
                    <span className="max-w-[72px] truncate">{currentBlockLabel}</span>
                    <HugeiconsIcon icon={ArrowDown01Icon} size={14} className="text-muted-foreground shrink-0" />
                  </button>

                  <span aria-hidden="true" className="mx-0.5 h-3.5 w-px flex-none bg-[var(--app-border)]" />

                  <ToolButton label="Bulleted list" hugeIcon={LeftToRightListBulletIcon} active={editor.isActive('bulletList')} disabled={false} onPress={toggleBullet} isMobile />
                  <ToolButton
                    label="Checklist"
                    hugeIcon={CheckListIcon}
                    active={editor.isActive('taskList')}
                    disabled={false}
                    onPress={toggleTask}
                    isMobile
                  />
                  <ToolButton label="Undo" hugeIcon={Undo03Icon} disabled={!editor.can().chain().focus().undo().run()} onPress={() => editor.chain().focus().undo().run()} isMobile />
                  <ToolButton label="Redo" hugeIcon={Redo03Icon} disabled={!editor.can().chain().focus().redo().run()} onPress={() => editor.chain().focus().redo().run()} isMobile />

                  <span aria-hidden="true" className="mx-0.5 h-3.5 w-px flex-none bg-[var(--app-border)]" />

                  <ToolButton
                    label="Add block"
                    hugeIcon={AddCircleIcon}
                    active={isAddBlockOpen && !isReplacingBlock}
                    onPress={() => {
                      setActiveSubmenu(null)
                      setIsReplacingBlock(false)
                      if (!isAddBlockOpen) {
                        if (document.activeElement instanceof HTMLElement) {
                          document.activeElement.blur()
                        }
                        editor.commands.blur()
                      }
                      setIsAddBlockOpen((prev) => !prev)
                    }}
                    isMobile
                  />
                </div>

                {/* Right fixed area: Keyboard dismiss */}
                {showKeyboardDismiss ? (
                  <div className="flex flex-none items-center pl-1" role="group" aria-label="Keyboard control">
                    <span aria-hidden="true" className="mx-0.5 h-3.5 w-px flex-none bg-[var(--app-border)]" />
                    <button
                      type="button"
                      title="Hide keyboard"
                      aria-label="Hide keyboard"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={dismissKeyboard}
                      className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-[var(--app-subtle)] hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                    >
                      <KeyboardHideIcon className="size-4.5" />
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Add / Replace Block Tray Directly Below Toolbar */}
          {isAddBlockOpen ? (
            <div
              role="dialog"
              aria-label={isReplacingBlock ? 'Replace block' : 'Insert blocks'}
              className="flex w-full flex-col h-[360px] max-h-[50vh] rounded-t-2xl border-t border-[var(--app-border)] bg-[var(--app-surface)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom duration-200"
            >
              {/* Sheet handler */}
              <div className="mx-auto mb-3 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30" aria-hidden="true" />

              {/* Search Bar */}
              <div className="relative mb-3 flex items-center shrink-0">
                <HugeiconsIcon icon={Search01Icon} size={16} className="absolute left-3 text-muted-foreground pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isReplacingBlock ? 'Search replacement blocks…' : 'Search blocks…'}
                  className="h-9 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-subtle)] pl-9 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 flex size-5 items-center justify-center text-muted-foreground hover:text-foreground"
                  >
                    <HugeiconsIcon icon={CancelCircleIcon} size={15} />
                  </button>
                ) : null}
              </div>

              {/* Grouped Commands List */}
              <div className="flex-1 overflow-y-auto overscroll-contain pr-0.5 space-y-4">
                {groupedInsertCommands.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">No matching blocks found</div>
                ) : (
                  groupedInsertCommands.map((group) => (
                    <div key={group.category}>
                      <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {group.category}
                      </div>
                      <div className="grid grid-cols-2 gap-2" role="group" aria-label={group.category}>
                        {group.commands.map((command) => {
                          const HugeIcon = mobileBlockHugeicons[command.id] || File01Icon
                          return (
                            <button
                              key={command.id}
                              type="button"
                              onClick={() => {
                                if (isReplacingBlock) {
                                  convertSelectedBlocks(editor, command.id)
                                } else if (onInsertBlock) {
                                  onInsertBlock(command.id)
                                } else {
                                  runSlashCommand(editor, command.id, editor.state.selection)
                                }
                                setIsAddBlockOpen(false)
                                setIsReplacingBlock(false)
                                setSearchQuery('')
                                window.requestAnimationFrame(() => {
                                  if (!editor.isDestroyed) {
                                    editor.commands.focus()
                                    try {
                                      const coords = editor.view.coordsAtPos(editor.state.selection.from)
                                      const toolbarEl = document.querySelector('.mybook-mobile-document-toolbar')
                                      const toolbarTop = toolbarEl instanceof HTMLElement
                                        ? toolbarEl.getBoundingClientRect().top
                                        : (window.innerHeight - 70)
                                      const overlap = coords.bottom - (toolbarTop - 24)
                                      if (overlap > 0) {
                                        window.scrollBy({ top: overlap, behavior: 'smooth' })
                                      }
                                    } catch {
                                      editor.commands.scrollIntoView()
                                    }
                                  }
                                })
                              }}
                              className="flex h-11 items-center gap-2.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-left transition hover:bg-[var(--app-subtle)] active:scale-[0.98]"
                            >
                              <HugeiconsIcon icon={HugeIcon} size={18} className="shrink-0 text-muted-foreground" />
                              <span className="truncate text-xs font-semibold text-foreground">{command.title}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center gap-1 border-r border-[var(--app-border)] pr-1" role="group" aria-label="Text style">
        <ToolButton label="Bold" icon={BoldIcon} active={editor.isActive('bold')} disabled={!editor.can().chain().focus().toggleBold().run()} onPress={() => editor.chain().focus().toggleBold().run()} />
        <ToolButton label="Italic" icon={ItalicIcon} active={editor.isActive('italic')} disabled={!editor.can().chain().focus().toggleItalic().run()} onPress={() => editor.chain().focus().toggleItalic().run()} />
        <ToolButton label="Underline" icon={UnderlineIcon} active={editor.isActive('underline')} disabled={!editor.can().chain().focus().toggleUnderline().run()} onPress={() => editor.chain().focus().toggleUnderline().run()} />
      </div>
      <div className="flex items-center gap-1 border-r border-[var(--app-border)] pr-1" role="group" aria-label="Block type">
        <label className="sr-only" htmlFor={`${idPrefix}-heading-level`}>Heading level</label>
        <select
          id={`${idPrefix}-heading-level`}
          title="Heading level"
          aria-label="Heading level"
          value={heading}
          onChange={(event) => {
            const level = Number(event.target.value)
            if (editor.isActive('toggleBlock') && !editor.isActive('heading')) {
              const newLevel = level === 0 ? null : (level as 1 | 2 | 3 | 4)
              editor.chain().focus().updateAttributes('toggleBlock', { level: newLevel }).run()
              return
            }
            if (level === 0) editor.chain().focus().setParagraph().run()
            else editor.chain().focus().setHeading({ level: level as 1 | 2 | 3 | 4 }).run()
          }}
          className={`h-11 min-w-20 rounded-[10px] border-0 px-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${heading !== '0' ? 'bg-primary text-primary-foreground' : 'bg-transparent text-muted-foreground hover:bg-[var(--app-subtle)]'}`}
        >
          <option value="0">Text</option>
          <option value="1">H1</option>
          <option value="2">H2</option>
          <option value="3">H3</option>
          <option value="4">H4</option>
        </select>
      </div>
      <div className="flex items-center gap-1 border-r border-[var(--app-border)] pr-1" role="group" aria-label="Lists">
        <ToolButton label="Bulleted list" icon={ListBulletIcon} active={editor.isActive('bulletList')} disabled={!editor.can().chain().focus().toggleBulletList().run()} onPress={() => editor.chain().focus().toggleBulletList().run()} />
        <ToolButton label="Numbered list" icon={NumberedListIcon} active={editor.isActive('orderedList')} disabled={!editor.can().chain().focus().toggleOrderedList().run()} onPress={() => editor.chain().focus().toggleOrderedList().run()} />
        <ToolButton label="To-do list" icon={QueueListIcon} active={editor.isActive('taskList')} disabled={!editor.can().chain().focus().toggleTaskList().run()} onPress={() => editor.chain().focus().toggleTaskList().run()} />
      </div>
      <div className="flex items-center gap-1" role="group" aria-label="History and more formatting">
        <ToolButton label="Undo" icon={ArrowUturnLeftIcon} disabled={!editor.can().chain().focus().undo().run()} onPress={() => editor.chain().focus().undo().run()} />
        <ToolButton label="Redo" icon={ArrowUturnRightIcon} disabled={!editor.can().chain().focus().redo().run()} onPress={() => editor.chain().focus().redo().run()} />
        {variant === 'desktop' ? moreActions.map((action) => (
          <ToolButton key={action.label} label={action.label} icon={action.icon} active={action.active} disabled={action.disabled} onPress={action.run} />
        )) : (
          <MobileBottomSheet
            trigger={<EllipsisHorizontalIcon aria-hidden="true" className="size-6" />}
            triggerLabel="More formatting options"
            triggerClassName="flex size-11 min-h-11 min-w-11 items-center justify-center rounded-[10px] text-muted-foreground transition hover:bg-[var(--app-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            title="More formatting"
          >
            <div className="grid grid-cols-2 gap-2 pb-[env(safe-area-inset-bottom)]" role="group" aria-label="Additional formatting options">
              {moreActions.map((action) => (
                <button key={action.label} type="button" title={action.label} aria-label={action.label} aria-pressed={action.active} disabled={action.disabled} onClick={action.run} className={`flex min-h-12 items-center gap-3 rounded-[10px] px-3 text-left text-base font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-40 ${action.active ? 'bg-primary text-primary-foreground' : 'hover:bg-[var(--app-subtle)]'}`}>
                  <action.icon aria-hidden="true" className="size-5 shrink-0" />
                  {action.label}
                </button>
              ))}
            </div>
          </MobileBottomSheet>
        )}
      </div>
    </>
  )
}

export function DocumentToolbar({
  editor,
  onInsertFile,
  onInsertImage,
  onInsertBlock,
  onEditLink,
  variant = 'mobile',
  keyboardOffset: propKeyboardOffset,
}: {
  editor: Editor
  onInsertFile?: () => void
  onInsertImage?: () => void
  onInsertBlock?: (commandId: string) => void
  onEditLink?: () => void
  variant?: 'desktop' | 'mobile'
  keyboardOffset?: number
}) {
  const [, setVersion] = useState(0)
  const hookKeyboardOffset = useKeyboardOffset(variant === 'mobile')
  const keyboardOffset = propKeyboardOffset ?? hookKeyboardOffset

  useEffect(() => {
    const update = () => setVersion((version) => version + 1)
    editor.on('transaction', update)
    editor.on('selectionUpdate', update)
    editor.on('focus', update)
    editor.on('blur', update)
    return () => {
      editor.off('transaction', update)
      editor.off('selectionUpdate', update)
      editor.off('focus', update)
      editor.off('blur', update)
    }
  }, [editor])

  if (variant === 'desktop') {
    return (
      <div role="toolbar" aria-label="Document formatting" className="hidden border-t border-[var(--app-border)] md:block">
        <div className="scrollbar flex h-14 w-full items-center gap-1 overflow-x-auto overscroll-x-contain px-8 [scrollbar-width:thin]">
          <ToolbarControls editor={editor} idPrefix="desktop" onInsertFile={onInsertFile} onInsertImage={onInsertImage} onInsertBlock={onInsertBlock} onEditLink={onEditLink} variant="desktop" />
        </div>
      </div>
    )
  }

  return (
    <ToolbarControls
      editor={editor}
      idPrefix="mobile"
      onInsertFile={onInsertFile}
      onInsertImage={onInsertImage}
      onInsertBlock={onInsertBlock}
      onEditLink={onEditLink}
      variant="mobile"
      keyboardOffset={keyboardOffset}
    />
  )
}
