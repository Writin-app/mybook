import {
  ArrowDownIcon,
  ArrowUpIcon,
  DocumentDuplicateIcon,
  EllipsisHorizontalIcon,
} from '@heroicons/react/24/outline'
import { Delete02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { JSONContent } from '@tiptap/core'
import type { Editor } from '@tiptap/react'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { NodeSelection } from '@tiptap/pm/state'
import { useEffect, useState, type ReactNode } from 'react'
import { cloneDatabaseAttrs } from './databaseModel'
import { MobileBottomSheet } from '../common/MobileBottomSheet'
import { Button } from '../ui/button'

const actionableBlocks = new Set(['callout', 'toggleBlock', 'tableOfContents', 'documentLink', 'databaseBlock', 'imageBlock', 'videoBlock', 'audioBlock', 'fileAttachment', 'table', 'codeBlock'])

interface BlockTarget {
  node: ProseMirrorNode
  pos: number
  rect: DOMRect
}

function findBlockTarget(editor: Editor): BlockTarget | null {
  const { state, view } = editor
  const { selection } = state

  if (selection instanceof NodeSelection && actionableBlocks.has(selection.node.type.name)) {
    const coords = view.coordsAtPos(selection.from)
    return {
      node: selection.node,
      pos: selection.from,
      rect: new DOMRect(coords.left, coords.top, coords.right - coords.left, coords.bottom - coords.top),
    }
  }

  const { $from } = selection
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth)
    if (actionableBlocks.has(node.type.name)) {
      const pos = $from.before(depth)
      const coords = view.coordsAtPos(pos)
      return {
        node,
        pos,
        rect: new DOMRect(coords.left, coords.top, coords.right - coords.left, coords.bottom - coords.top),
      }
    }
  }

  return null
}

function selectMovedNode(editor: Editor, pos: number) {
  const { state, view } = editor
  const selection = NodeSelection.create(state.doc, pos)
  view.dispatch(state.tr.setSelection(selection).scrollIntoView())
  view.focus()
}

function duplicateBlock(editor: Editor, target: BlockTarget) {
  const json = target.node.toJSON() as JSONContent
  const duplicate = json.type === 'databaseBlock'
    ? { ...json, attrs: cloneDatabaseAttrs(json.attrs) }
    : json
  editor.chain().focus().insertContentAt(target.pos + target.node.nodeSize, duplicate).run()
  selectMovedNode(editor, target.pos + target.node.nodeSize)
}

function deleteBlock(editor: Editor, target: BlockTarget) {
  editor.chain().focus().deleteRange({ from: target.pos, to: target.pos + target.node.nodeSize }).run()
}

function moveBlockUp(editor: Editor, target: BlockTarget) {
  const { state, view } = editor
  const previous = state.doc.resolve(target.pos).nodeBefore
  if (!previous) return
  const nextPos = target.pos - previous.nodeSize
  const tr = state.tr.delete(target.pos, target.pos + target.node.nodeSize).insert(nextPos, target.node)
  view.dispatch(tr.scrollIntoView())
  selectMovedNode(editor, nextPos)
}

function moveBlockDown(editor: Editor, target: BlockTarget) {
  const { state, view } = editor
  const afterPos = target.pos + target.node.nodeSize
  const next = state.doc.resolve(afterPos).nodeAfter
  if (!next) return
  const nextPos = target.pos + next.nodeSize
  const tr = state.tr.delete(target.pos, afterPos).insert(nextPos, target.node)
  view.dispatch(tr.scrollIntoView())
  selectMovedNode(editor, nextPos)
}

function ActionButton({
  label,
  children,
  disabled,
  onClick,
}: {
  label: string
  children: ReactNode
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-lg"
      aria-label={label}
      title={label}
      disabled={disabled}
      onMouseDown={(event) => {
        event.preventDefault()
        onClick()
      }}
      className="flex size-9 items-center justify-center rounded-[8px] text-muted-foreground transition hover:bg-[var(--app-subtle)] hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:pointer-events-none disabled:opacity-35"
    >
      {children}
    </Button>
  )
}

function SheetActionButton({
  label,
  children,
  disabled,
  destructive,
  onClick,
}: {
  label: string
  children: ReactNode
  disabled?: boolean
  destructive?: boolean
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="lg"
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-12 w-full items-center gap-3 rounded-[8px] border border-[var(--app-border)] px-4 text-left text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:pointer-events-none disabled:opacity-40 ${
        destructive
          ? 'text-red-600 hover:border-red-200 hover:bg-red-50'
          : 'text-foreground hover:bg-[var(--app-subtle)]'
      }`}
    >
      {children}
      <span>{label}</span>
    </Button>
  )
}

export function BlockActionsMenu({ editor }: { editor: Editor }) {
  const [target, setTarget] = useState<BlockTarget | null>(null)
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false)

  useEffect(() => {
    const update = () => setTarget(findBlockTarget(editor))
    update()
    editor.on('selectionUpdate', update)
    editor.on('transaction', update)
    editor.on('focus', update)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      editor.off('selectionUpdate', update)
      editor.off('transaction', update)
      editor.off('focus', update)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [editor])

  const maxPos = editor.state.doc.content.size
  if (!target || target.pos < 0 || target.pos + target.node.nodeSize > maxPos) return null

  const previous = editor.state.doc.resolve(target.pos).nodeBefore
  const next = editor.state.doc.resolve(target.pos + target.node.nodeSize).nodeAfter
  const viewportHeight = typeof window !== 'undefined'
    ? (window.visualViewport ? window.visualViewport.offsetTop + window.visualViewport.height : window.innerHeight)
    : 768
  const header = typeof document !== 'undefined' ? document.querySelector<HTMLElement>('.mybook-document-editor > header') : null
  const headerBottom = header?.getBoundingClientRect().bottom ?? 0
  const minTop = Math.max(88, headerBottom + 8)
  const menuHeight = 44
  const maxTop = Math.max(minTop, viewportHeight - menuHeight - 12)
  const top = target ? Math.max(minTop, Math.min(target.rect.top, maxTop)) : minTop
  const left = target ? Math.max(8, Math.min(target.rect.left - 52, window.innerWidth - 188)) : 8

  const runMobileAction = (action: () => void) => {
    action()
    setIsMobileSheetOpen(false)
  }

  return (
    <>
      {target ? (
        <div
          data-editor-popover="true"
          className="fixed z-50 hidden gap-1 rounded-[8px] border border-[var(--app-border)] bg-[var(--app-surface)] p-1 shadow-[0_12px_32px_rgba(0,0,0,0.12)] md:flex"
          style={{ top, left }}
          role="toolbar"
          aria-label="Block actions"
        >
          <ActionButton label="Move block up" disabled={!previous} onClick={() => moveBlockUp(editor, target)}>
            <ArrowUpIcon aria-hidden="true" className="size-4" />
          </ActionButton>
          <ActionButton label="Move block down" disabled={!next} onClick={() => moveBlockDown(editor, target)}>
            <ArrowDownIcon aria-hidden="true" className="size-4" />
          </ActionButton>
          <ActionButton label="Duplicate block" onClick={() => duplicateBlock(editor, target)}>
            <DocumentDuplicateIcon aria-hidden="true" className="size-4" />
          </ActionButton>
          <ActionButton label="Delete block" onClick={() => deleteBlock(editor, target)}>
            <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4" />
          </ActionButton>
        </div>
      ) : null}

      {target ? (
      <div className="fixed right-4 z-50 md:hidden" style={{ bottom: 'calc(var(--mybook-keyboard-offset, 0px) + 5.5rem + env(safe-area-inset-bottom))' }}>
        <MobileBottomSheet
          title="Block actions"
          triggerLabel="Open block actions"
          isOpen={isMobileSheetOpen}
          onOpenChange={setIsMobileSheetOpen}
          trigger={
            <span className="flex size-11 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] text-foreground shadow-[0_10px_24px_rgba(15,23,42,0.18)]">
              <EllipsisHorizontalIcon aria-hidden="true" className="size-5" />
            </span>
          }
          triggerClassName="rounded-full"
        >
          <div className="space-y-2 pb-2">
            <SheetActionButton label="Move block up" disabled={!previous} onClick={() => runMobileAction(() => moveBlockUp(editor, target))}>
              <ArrowUpIcon aria-hidden="true" className="size-5 shrink-0" />
            </SheetActionButton>
            <SheetActionButton label="Move block down" disabled={!next} onClick={() => runMobileAction(() => moveBlockDown(editor, target))}>
              <ArrowDownIcon aria-hidden="true" className="size-5 shrink-0" />
            </SheetActionButton>
            <SheetActionButton label="Duplicate block" onClick={() => runMobileAction(() => duplicateBlock(editor, target))}>
              <DocumentDuplicateIcon aria-hidden="true" className="size-5 shrink-0" />
            </SheetActionButton>
            <SheetActionButton label="Delete block" destructive onClick={() => runMobileAction(() => deleteBlock(editor, target))}>
              <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-5 shrink-0" />
            </SheetActionButton>
          </div>
        </MobileBottomSheet>
      </div>
      ) : null}

    </>
  )
}
