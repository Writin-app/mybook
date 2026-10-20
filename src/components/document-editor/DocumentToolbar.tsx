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
  PaperClipIcon,
  NumberedListIcon,
  PhotoIcon,
  QueueListIcon,
  StrikethroughIcon,
  TableCellsIcon,
  UnderlineIcon,
} from '@heroicons/react/24/outline'
import type { Editor } from '@tiptap/react'
import { useEffect, useState } from 'react'

import { useKeyboardOffset } from '../../hooks/useVisualViewport'
import { MobileBottomSheet } from '../common/MobileBottomSheet'
import { calloutNode } from './extensions/Callout'
import { toggleBlockNode } from './extensions/ToggleBlock'
import { BlockCommandMenu } from './SlashCommandMenu'
import { isInsideColumns, runSlashCommand, slashCommands } from './slashCommands'

interface ToolButtonProps {
  label: string
  icon: typeof BoldIcon
  active?: boolean
  disabled?: boolean
  onPress: () => void
}

function ToolButton({ label, icon: Icon, active, disabled, onPress }: ToolButtonProps) {
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
      <Icon aria-hidden="true" className="size-5" />
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
}: {
  editor: Editor
  idPrefix: string
  variant: 'desktop' | 'mobile'
  onInsertFile?: () => void
  onInsertImage?: () => void
  onInsertBlock?: (commandId: string) => void
  onEditLink?: () => void
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

  const [isBlockSheetOpen, setIsBlockSheetOpen] = useState(false)

  if (variant === 'mobile') {
    const mobileFormatActions = [
      { label: 'To-do list', icon: QueueListIcon, active: editor.isActive('taskList'), disabled: !editor.can().chain().focus().toggleTaskList().run(), run: () => editor.chain().focus().toggleTaskList().run() },
      { label: 'Quote', icon: ChatBubbleBottomCenterTextIcon, active: editor.isActive('blockquote'), disabled: false, run: insertQuote },
      { label: 'Inline code', icon: CodeBracketIcon, active: editor.isActive('code'), disabled: !editor.can().chain().focus().toggleCode().run(), run: () => editor.chain().focus().toggleCode().run() },
      { label: 'Code block', icon: CommandLineIcon, active: editor.isActive('codeBlock'), disabled: !editor.can().chain().focus().toggleCodeBlock().run(), run: () => editor.chain().focus().toggleCodeBlock().run() },
      { label: 'Strikethrough', icon: StrikethroughIcon, active: editor.isActive('strike'), disabled: !editor.can().chain().focus().toggleStrike().run(), run: () => editor.chain().focus().toggleStrike().run() },
      { label: 'Clear formatting', icon: BackspaceIcon, active: false, disabled: !editor.can().chain().focus().unsetAllMarks().clearNodes().run(), run: () => editor.chain().focus().unsetAllMarks().clearNodes().run() },
    ]
    const mobileInsertActions = [
      { label: 'Link', icon: LinkIcon, active: editor.isActive('link'), disabled: false, run: setLink },
      { label: 'Callout', icon: InformationCircleIcon, active: editor.isActive('callout'), disabled: false, run: () => editor.chain().focus().insertContent(calloutNode()).run() },
      { label: 'Toggle', icon: ChevronRightIcon, active: editor.isActive('toggleBlock'), disabled: false, run: () => editor.chain().focus().insertContent(toggleBlockNode()).run() },
      { label: 'Image', icon: PhotoIcon, active: editor.isActive('imageBlock'), disabled: !onInsertImage, run: () => onInsertImage?.() },
      { label: 'File', icon: PaperClipIcon, active: editor.isActive('fileAttachment'), disabled: !onInsertFile, run: () => onInsertFile?.() },
      { label: 'Basic Table', icon: TableCellsIcon, active: editor.isActive('table'), disabled: !editor.can().chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: false }).run(), run: () => editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: false }).run() },
      { label: 'Horizontal rule', icon: MinusIcon, active: false, disabled: !editor.can().chain().focus().setHorizontalRule().run(), run: () => editor.chain().focus().setHorizontalRule().run() },
    ]

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
            className={`h-12 min-w-20 rounded-[10px] border-0 px-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${heading !== '0' ? 'bg-primary text-primary-foreground' : 'bg-transparent text-muted-foreground hover:bg-[var(--app-subtle)]'}`}
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
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="History and more formatting">
          <ToolButton label="Undo" icon={ArrowUturnLeftIcon} disabled={!editor.can().chain().focus().undo().run()} onPress={() => editor.chain().focus().undo().run()} />
          <ToolButton label="Redo" icon={ArrowUturnRightIcon} disabled={!editor.can().chain().focus().redo().run()} onPress={() => editor.chain().focus().redo().run()} />
          {onInsertBlock ? (
            <MobileBottomSheet
              title="Insert block"
              triggerLabel="Insert block"
              isOpen={isBlockSheetOpen}
              onOpenChange={setIsBlockSheetOpen}
              trigger={<QueueListIcon aria-hidden="true" className="size-6" />}
              triggerClassName="flex size-12 min-h-12 min-w-12 items-center justify-center rounded-[10px] text-muted-foreground transition hover:bg-[var(--app-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              <div className="pb-[env(safe-area-inset-bottom)]">
                <BlockCommandMenu
                  ariaLabel="Insert block options"
                  commands={isInsideColumns(editor) ? slashCommands.filter((command) => !command.id.startsWith('columns-')) : slashCommands}
                  selectedIndex={-1}
                  onSelectIndex={() => undefined}
                  onRun={(command) => {
                    onInsertBlock(command.id)
                    setIsBlockSheetOpen(false)
                  }}
                />
              </div>
            </MobileBottomSheet>
          ) : null}
          <MobileBottomSheet
            trigger={<EllipsisHorizontalIcon aria-hidden="true" className="size-6" />}
            triggerLabel="More formatting options"
            triggerClassName="flex size-12 min-h-12 min-w-12 items-center justify-center rounded-[10px] text-muted-foreground transition hover:bg-[var(--app-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            title="More formatting"
          >
            <div className="space-y-5 pb-[env(safe-area-inset-bottom)]">
              <div>
                <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Format</h2>
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="Additional formatting options">
                  {mobileFormatActions.map((action) => (
                    <button key={action.label} type="button" title={action.label} aria-label={action.label} aria-pressed={action.active} disabled={action.disabled} onClick={action.run} className={`flex min-h-12 items-center gap-3 rounded-[10px] px-3 text-left text-base font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-40 ${action.active ? 'bg-primary text-primary-foreground' : 'hover:bg-[var(--app-subtle)]'}`}>
                      <action.icon aria-hidden="true" className="size-5 shrink-0" />
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Insert</h2>
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="Insert options">
                  {mobileInsertActions.map((action) => (
                    <button key={action.label} type="button" title={action.label} aria-label={action.label} aria-pressed={action.active} disabled={action.disabled} onClick={action.run} className={`flex min-h-12 items-center gap-3 rounded-[10px] px-3 text-left text-base font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-40 ${action.active ? 'bg-primary text-primary-foreground' : 'hover:bg-[var(--app-subtle)]'}`}>
                      <action.icon aria-hidden="true" className="size-5 shrink-0" />
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </MobileBottomSheet>
        </div>
      </>
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
}: {
  editor: Editor
  onInsertFile?: () => void
  onInsertImage?: () => void
  onInsertBlock?: (commandId: string) => void
  onEditLink?: () => void
  variant?: 'desktop' | 'mobile'
}) {
  const [, setVersion] = useState(0)
  const keyboardOffset = useKeyboardOffset(variant === 'mobile')

  useEffect(() => {
    const update = () => setVersion((version) => version + 1)
    editor.on('transaction', update)
    editor.on('selectionUpdate', update)
    return () => {
      editor.off('transaction', update)
      editor.off('selectionUpdate', update)
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
    <div role="toolbar" aria-label="Document formatting" className="mybook-mobile-document-toolbar fixed inset-x-0 z-20 border-t border-[var(--app-border)] bg-[var(--app-surface)] pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_20px_rgba(0,0,0,0.06)] transition-[bottom] duration-150 md:hidden" style={{ bottom: keyboardOffset }}>
      <div className="scrollbar mx-auto flex h-16 max-w-4xl items-center gap-1 overflow-x-auto overscroll-x-contain px-2 [scrollbar-width:thin]">
        <ToolbarControls editor={editor} idPrefix="mobile" onInsertFile={onInsertFile} onInsertImage={onInsertImage} onInsertBlock={onInsertBlock} onEditLink={onEditLink} variant="mobile" />
      </div>
    </div>
  )
}
