import { ArrowDownIcon, ClipboardDocumentIcon, DocumentDuplicateIcon, ViewColumnsIcon } from '@heroicons/react/24/outline'
import { AddCircleIcon, Delete02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { Editor } from '@tiptap/react'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import { useEffect, useRef, useState } from 'react'

import { useHoverBlockControlsAvailable } from '../../hooks/useHoverBlockControls'
import { Button } from '../ui/button'
import { BlockCommandMenu } from './SlashCommandMenu'
import { commandMenuTop, type SlashCommand } from './slashCommands'
import { safeSelectionForBlock } from './blockConversion'
import { movableBlockAt } from './blockDrag'
import { deleteColumnAt } from './extensions/Columns'
import {
  gutterBoundsForTarget,
  insertBlockCommands,
  type BlockTarget,
  type ColumnContext,
} from './columnControls'

export type { BlockTarget, ColumnContext }

const CENTERED_BLOCK_CONTROLS = new Set(['bookmarkBlock', 'documentLink', 'embedBlock', 'horizontalRule'])

function targetAtBlockPos(editor: Editor, node: ProseMirrorNode, pos: number): BlockTarget {
  const { view } = editor
  const blockElement = view.nodeDOM(pos)
  const coords = view.coordsAtPos(pos)
  const rect = blockElement instanceof Element
    ? blockElement.getBoundingClientRect()
    : new DOMRect(coords.left, coords.top, coords.right - coords.left, coords.bottom - coords.top)
  const $from = editor.state.doc.resolve(Math.min(pos + 1, editor.state.doc.content.size))

  let columnDepth = -1
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === 'column') {
      columnDepth = depth
      break
    }
  }

  let topPos = pos
  if (columnDepth !== -1 && $from.depth > columnDepth) {
    topPos = $from.before(columnDepth + 1)
  } else if ($from.depth > 0) {
    topPos = $from.before(1)
  }

  const topElement = view.nodeDOM(topPos)
  const topCoords = view.coordsAtPos(topPos)
  const controlRect = topElement instanceof Element
    ? topElement.getBoundingClientRect()
    : new DOMRect(topCoords.left, topCoords.top, topCoords.right - topCoords.left, topCoords.bottom - topCoords.top)
  return { node, pos, rect, controlRect }
}

function blockTargetAtResolvedPos(editor: Editor, pos: number): BlockTarget | null {
  const { state, view } = editor
  const $from = state.doc.resolve(pos)
  let topBlock: { pos: number; rect: DOMRect } | null = null

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth)
    if (node.type.name !== 'table') continue
    const tablePos = $from.before(depth)
    return targetAtBlockPos(editor, node, tablePos)
  }

  let columnDepth = -1
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === 'column') {
      columnDepth = depth
      break
    }
  }

  if (columnDepth !== -1 && $from.depth > columnDepth) {
    const topPos = $from.before(columnDepth + 1)
    const topElement = view.nodeDOM(topPos)
    const topCoords = view.coordsAtPos(topPos)
    const rect = topElement instanceof Element
      ? topElement.getBoundingClientRect()
      : new DOMRect(topCoords.left, topCoords.top, topCoords.right - topCoords.left, topCoords.bottom - topCoords.top)
    topBlock = { pos: topPos, rect }
  } else if ($from.depth > 0) {
    const topPos = $from.before(1)
    const topElement = view.nodeDOM(topPos)
    const topCoords = view.coordsAtPos(topPos)
    const rect = topElement instanceof Element
      ? topElement.getBoundingClientRect()
      : new DOMRect(topCoords.left, topCoords.top, topCoords.right - topCoords.left, topCoords.bottom - topCoords.top)
    topBlock = { pos: topPos, rect }
  }

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth)
    if (node.type.name !== 'taskItem') continue
    const taskPos = $from.before(depth)
    const coords = view.coordsAtPos(taskPos)
    const rect = new DOMRect(coords.left, coords.top, coords.right - coords.left, coords.bottom - coords.top)
    return { node, pos: taskPos, rect, controlRect: topBlock?.rect ?? rect }
  }

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth)
    if (node.type.name === 'column') continue
    if (node.isBlock) {
      const blockPos = $from.before(depth)
      const coords = view.coordsAtPos(blockPos)
      const rect = new DOMRect(coords.left, coords.top, coords.right - coords.left, coords.bottom - coords.top)
      return { node, pos: blockPos, rect, controlRect: topBlock?.rect ?? rect }
    }
  }
  return null
}


function findSelectionTarget(editor: Editor): BlockTarget | null {
  const { state, view } = editor
  const { selection } = state
  if (selection instanceof NodeSelection) {
    const coords = view.coordsAtPos(selection.from)
    const rect = new DOMRect(coords.left, coords.top, coords.right - coords.left, coords.bottom - coords.top)
    return { node: selection.node, pos: selection.from, rect, controlRect: rect }
  }
  return blockTargetAtResolvedPos(editor, selection.from)
}

function findPointerTarget(editor: Editor, event: PointerEvent, clampToEditor = false): BlockTarget | null {
  const pointerElement = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-document-link-block="true"]') : null
  if (pointerElement) {
    let match: BlockTarget | null = null
    editor.state.doc.descendants((node, pos) => {
      if (match || node.type.name !== 'documentLink') return
      const nodeElement = editor.view.nodeDOM(pos)
      if (nodeElement === pointerElement || (nodeElement instanceof Node && nodeElement.contains(pointerElement))) {
        match = targetAtBlockPos(editor, node, pos)
      }
    })
    if (match) return match

    const domPosition = editor.view.posAtDOM(pointerElement, 0)
    const resolved = editor.state.doc.resolve(Math.min(domPosition, editor.state.doc.content.size))
    for (let depth = resolved.depth; depth > 0; depth -= 1) {
      const node = resolved.node(depth)
      if (node.type.name !== 'documentLink') continue
      return targetAtBlockPos(editor, node, resolved.before(depth))
    }
  }
  // While dragging from the gutter the pointer is left of the text, where posAtCoords finds nothing
  const editorRect = editor.view.dom.getBoundingClientRect()
  const left = clampToEditor
    ? Math.min(Math.max(event.clientX, editorRect.left + 8), editorRect.right - 8)
    : event.clientX
  const result = editor.view.posAtCoords({ left, top: event.clientY })
  if (!result) return null
  return blockTargetAtResolvedPos(editor, result.pos)
}

function isInsideTable(editor: Editor, pos: number) {
  const resolved = editor.state.doc.resolve(pos)
  for (let depth = resolved.depth; depth > 0; depth -= 1) {
    if (resolved.node(depth).type.name === 'table') return true
  }
  return false
}

function findGutterTarget(editor: Editor, event: PointerEvent): BlockTarget | null {
  const candidates: BlockTarget[] = []
  editor.state.doc.descendants((node, pos) => {
    if (!node.isBlock) return
    if (isInsideTable(editor, pos) && node.type.name !== 'table') return
    if (['tableRow', 'tableCell', 'tableHeader', 'column'].includes(node.type.name)) return
    const target = targetAtBlockPos(editor, node, pos)
    const bounds = gutterBoundsForTarget(editor, target)
    const gutterLeft = bounds.left
    const gutterRight = bounds.left + bounds.width
    const isInRow = event.clientY >= target.rect.top - 8 && event.clientY <= target.rect.bottom + 8
    const isInGutter = event.clientX >= gutterLeft && event.clientX <= gutterRight
    if (isInRow && isInGutter) candidates.push(target)
  })
  return candidates.sort((a, b) => a.node.nodeSize - b.node.nodeSize)[0] ?? null
}

function collectGutterTargets(editor: Editor): BlockTarget[] {
  const targets: BlockTarget[] = []
  editor.state.doc.descendants((node, pos) => {
    if (!node.isBlock) return
    if (isInsideTable(editor, pos) && node.type.name !== 'table') return
    if (['tableRow', 'tableCell', 'tableHeader', 'column'].includes(node.type.name)) return
    const target = targetAtBlockPos(editor, node, pos)
    if (target.rect.width > 0 && target.rect.height > 0) targets.push(target)
  })
  return targets
}

function toMovableBlock(editor: Editor, target: BlockTarget): BlockTarget {
  const block = movableBlockAt(editor.state.doc, target.pos)
  if (!block || block.pos === target.pos) return target
  return targetAtBlockPos(editor, block.node, block.pos)
}

function selectTarget(editor: Editor, target: BlockTarget) {
  const selection = target.node.isTextblock
    ? TextSelection.create(editor.state.doc, target.pos + 1, Math.max(target.pos + 1, target.pos + target.node.nodeSize - 1))
    : NodeSelection.create(editor.state.doc, target.pos)
  editor.view.dispatch(editor.state.tr.setSelection(selection).scrollIntoView())
  editor.view.focus()
}

function duplicateTarget(editor: Editor, target: BlockTarget) {
  editor.chain().focus().insertContentAt(target.pos + target.node.nodeSize, target.node.toJSON()).run()
}

async function copyTarget(target: BlockTarget) {
  const text = target.node.textContent.trim()
  const clipboardText = text || JSON.stringify(target.node.toJSON())
  await navigator.clipboard?.writeText(clipboardText)
}

function findParentColumnsTarget(editor: Editor, target: BlockTarget): BlockTarget | null {
  const $pos = editor.state.doc.resolve(target.pos)
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth)
    if (node.type.name === 'columns') {
      const pos = $pos.before(depth)
      return targetAtBlockPos(editor, node, pos)
    }
  }
  return null
}

function deleteTarget(editor: Editor, target: BlockTarget) {
  const $pos = editor.state.doc.resolve(target.pos)
  let parentColumn: { node: ProseMirrorNode; pos: number } | null = null
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    if ($pos.node(depth).type.name === 'column') {
      parentColumn = { node: $pos.node(depth), pos: $pos.before(depth) }
      break
    }
  }

  // Empty column safety: if this is the only block inside a column, replace it with an empty paragraph instead of leaving column empty
  if (parentColumn && parentColumn.node.childCount <= 1) {
    const paragraphType = editor.state.schema.nodes.paragraph
    if (paragraphType) {
      editor
        .chain()
        .focus()
        .deleteRange({ from: target.pos, to: target.pos + target.node.nodeSize })
        .insertContentAt(target.pos, paragraphType.createAndFill()!)
        .setTextSelection(target.pos + 1)
        .run()
      return
    }
  }

  editor.chain().focus().deleteRange({ from: target.pos, to: target.pos + target.node.nodeSize }).run()
  editor.view.dom.blur()
}

function blockControlsTop(target: BlockTarget | null) {
  if (!target) return 8
  if (CENTERED_BLOCK_CONTROLS.has(target.node.type.name)) return Math.max(8, target.rect.top + target.rect.height / 2 - 14)
  return Math.max(8, target.rect.top)
}

function moveTarget(editor: Editor, source: BlockTarget, drop: { pos: number; side: 'before' | 'after' }) {
  if (source.node.type.name === 'column') return
  const targetInsertPos = drop.side === 'before' ? drop.pos : drop.pos + editor.state.doc.nodeAt(drop.pos)!.nodeSize
  if (targetInsertPos >= source.pos && targetInsertPos <= source.pos + source.node.nodeSize) return
  if (source.node.type.name === 'columns') {
    const resolved = editor.state.doc.resolve(targetInsertPos)
    for (let depth = resolved.depth; depth > 0; depth -= 1) {
      if (resolved.node(depth).type.name === 'column' || resolved.node(depth).type.name === 'columns') return
    }
  }

  const $sourcePos = editor.state.doc.resolve(source.pos)
  let sourceParentCol: { node: ProseMirrorNode; pos: number } | null = null
  for (let depth = $sourcePos.depth; depth > 0; depth -= 1) {
    if ($sourcePos.node(depth).type.name === 'column') {
      sourceParentCol = { node: $sourcePos.node(depth), pos: $sourcePos.before(depth) }
      break
    }
  }

  const paragraphType = editor.state.schema.nodes.paragraph
  if (sourceParentCol && sourceParentCol.node.childCount <= 1 && paragraphType) {
    const emptyParagraph = paragraphType.createAndFill()!
    const tr = editor.state.tr.replaceWith(source.pos, source.pos + source.node.nodeSize, emptyParagraph)
    const adjustedTarget = targetInsertPos > source.pos
      ? targetInsertPos - source.node.nodeSize + emptyParagraph.nodeSize
      : targetInsertPos
    tr.insert(adjustedTarget, source.node)
    editor.view.dispatch(tr.scrollIntoView())
    const selection = source.node.isTextblock && source.node.content.size
      ? TextSelection.create(editor.state.doc, adjustedTarget + 1)
      : NodeSelection.create(editor.state.doc, adjustedTarget)
    editor.view.dispatch(editor.state.tr.setSelection(selection))
    editor.view.focus()
    return
  }

  const insertPos = targetInsertPos > source.pos ? targetInsertPos - source.node.nodeSize : targetInsertPos
  const tr = editor.state.tr.delete(source.pos, source.pos + source.node.nodeSize).insert(insertPos, source.node)
  editor.view.dispatch(tr.scrollIntoView())
  const selection = source.node.isTextblock && source.node.content.size
    ? TextSelection.create(editor.state.doc, insertPos + 1)
    : NodeSelection.create(editor.state.doc, insertPos)
  editor.view.dispatch(editor.state.tr.setSelection(selection))
  editor.view.focus()
}

function GripHandleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className} fill="currentColor">
      <circle cx="5" cy="3.5" r="1.25" />
      <circle cx="11" cy="3.5" r="1.25" />
      <circle cx="5" cy="8" r="1.25" />
      <circle cx="11" cy="8" r="1.25" />
      <circle cx="5" cy="12.5" r="1.25" />
      <circle cx="11" cy="12.5" r="1.25" />
    </svg>
  )
}

export function EditorBlockControls(props: { editor: Editor; onInsertBlock: (commandId: string, target?: BlockTarget | null) => void }) {
  const isAvailable = useHoverBlockControlsAvailable()
  if (!isAvailable) return null
  return <EditorBlockControlsInner {...props} />
}

function EditorBlockControlsInner({ editor, onInsertBlock }: { editor: Editor; onInsertBlock: (commandId: string, target?: BlockTarget | null) => void }) {
  const [target, setTarget] = useState<BlockTarget | null>(null)
  const [gutterTargets, setGutterTargets] = useState<BlockTarget[]>([])
  const [isInsertOpen, setIsInsertOpen] = useState(false)
  const [isActionsOpen, setIsActionsOpen] = useState(false)
  const [selectedInsertIndex, setSelectedInsertIndex] = useState(0)
  const [dragState, setDragState] = useState<{
    source: BlockTarget
    startX: number
    startY: number
    isDragging: boolean
    drop: { pos: number; side: 'before' | 'after'; rect: DOMRect } | null
  } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const hoverBridgeRef = useRef<HTMLDivElement>(null)
  const insertMenuRef = useRef<HTMLDivElement>(null)
  const actionsMenuRef = useRef<HTMLDivElement>(null)
  const suppressNextClickRef = useRef(false)

  useEffect(() => {
    const editorElement = editor.view.dom
    const updateGutterTargets = () => setGutterTargets(collectGutterTargets(editor))
    const updateOnResize = () => {
      updateGutterTargets()
      if (isInsertOpen || isActionsOpen || dragState?.isDragging) setTarget(findSelectionTarget(editor))
    }
    const closeOnScroll = (event: Event) => {
      if (!isInsertOpen && !isActionsOpen) return
      const scrollTarget = event.target as Node | null
      if (scrollTarget && (insertMenuRef.current?.contains(scrollTarget) || actionsMenuRef.current?.contains(scrollTarget))) return
      setIsInsertOpen(false)
      setIsActionsOpen(false)
    }
    const updateFromPointer = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      if (isInsertOpen || isActionsOpen || dragState?.isDragging) return
      const pointerNode = event.target as Node | null
      if (
        pointerNode &&
        (rootRef.current?.contains(pointerNode) ||
          hoverBridgeRef.current?.contains(pointerNode) ||
          insertMenuRef.current?.contains(pointerNode) ||
          actionsMenuRef.current?.contains(pointerNode))
      ) return
      setTarget(findPointerTarget(editor, event) ?? findGutterTarget(editor, event))
    }
    const hideFromPointerLeave = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      if (isInsertOpen || isActionsOpen || dragState?.isDragging) return
      const related = event.relatedTarget
      if (related instanceof Node && (rootRef.current?.contains(related) || hoverBridgeRef.current?.contains(related))) return
      setTarget(null)
    }
    updateGutterTargets()
    editor.on('transaction', updateGutterTargets)
    document.addEventListener('pointermove', updateFromPointer)
    editorElement.addEventListener('pointerleave', hideFromPointerLeave)
    window.addEventListener('resize', updateOnResize)
    window.addEventListener('scroll', closeOnScroll, true)
    return () => {
      document.removeEventListener('pointermove', updateFromPointer)
      editorElement.removeEventListener('pointerleave', hideFromPointerLeave)
      editor.off('transaction', updateGutterTargets)
      window.removeEventListener('resize', updateOnResize)
      window.removeEventListener('scroll', closeOnScroll, true)
    }
  }, [dragState?.isDragging, editor, isActionsOpen, isInsertOpen])

  useEffect(() => {
    if (!isInsertOpen && !isActionsOpen) return
    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      const node = event.target as Node
      if (rootRef.current?.contains(node) || insertMenuRef.current?.contains(node) || actionsMenuRef.current?.contains(node)) return
      setIsInsertOpen(false)
      setIsActionsOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePointerDown)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointerDown)
  }, [isActionsOpen, isInsertOpen])

  useEffect(() => {
    if (!isInsertOpen) return
    setSelectedInsertIndex(0)
  }, [isInsertOpen])

  useEffect(() => {
    if (!isInsertOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setIsInsertOpen(false)
        editor.view.focus()
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelectedInsertIndex((index) => (index + 1) % insertBlockCommands.length)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSelectedInsertIndex((index) => (index - 1 + insertBlockCommands.length) % insertBlockCommands.length)
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        const command = insertBlockCommands[selectedInsertIndex]
        if (command) {
          onInsertBlock(command.id, target)
          setIsInsertOpen(false)
          editor.view.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [editor, isInsertOpen, onInsertBlock, selectedInsertIndex, target])

  useEffect(() => {
    if (!dragState) return
    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      const distance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY)
      const nextTarget = findPointerTarget(editor, event, true)
      const dropBlock = nextTarget ? toMovableBlock(editor, nextTarget) : null
      const drop = dropBlock && dropBlock.pos !== dragState.source.pos
        ? {
            pos: dropBlock.pos,
            side: event.clientY < dropBlock.rect.top + dropBlock.rect.height / 2 ? 'before' as const : 'after' as const,
            rect: dropBlock.rect,
          }
        : dragState.drop
      setDragState({ ...dragState, isDragging: dragState.isDragging || distance > 4, drop })
    }
    const handlePointerUp = () => {
      if (dragState.isDragging) {
        suppressNextClickRef.current = true
        window.setTimeout(() => { suppressNextClickRef.current = false }, 0)
        if (dragState.drop) moveTarget(editor, dragState.source, dragState.drop)
      }
      setDragState(null)
    }
    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp, { once: true })
    return () => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
    }
  }, [dragState, editor])

  const top = blockControlsTop(target)
  const left = Math.max(8, (target?.controlRect.left ?? 76) - 68)
  const header = document.querySelector<HTMLElement>('.mybook-document-editor > header')
  const headerBottom = header?.getBoundingClientRect().bottom ?? 0
  const menuBoundary = Math.max(8, headerBottom + 8)
  const controlsTop = Math.max(top, menuBoundary)
  const bridgeTop = Math.max(8, Math.min(controlsTop, target?.rect.top ?? controlsTop))
  const bridgeLeft = Math.max(0, left)
  const bridgeWidth = Math.max(0, (target?.controlRect.left ?? left) - bridgeLeft)
  const bridgeHeight = Math.max(32, target?.rect.height ?? 32)
  const menuRect = new DOMRect(left, controlsTop, 56, 28)
  const insertMenuTop = commandMenuTop(menuRect, 352, 8, menuBoundary)
  const insertMenuWidth = 320
  const insertMenuLeft = Math.max(8, Math.min(left, window.innerWidth - insertMenuWidth - 8))
  const actionsMenuTop = commandMenuTop(menuRect, 128, 8, menuBoundary)
  const actionsMenuWidth = 176
  const gripLeft = left + 32
  const gripRight = left + 60
  const rightAlignedActionsLeft = gripRight - actionsMenuWidth
  const flippedActionsLeft = gripLeft
  const actionsMenuLeft = Math.max(8, rightAlignedActionsLeft >= 8
    ? Math.min(rightAlignedActionsLeft, window.innerWidth - actionsMenuWidth - 8)
    : Math.min(flippedActionsLeft, window.innerWidth - actionsMenuWidth - 8))
  const isDragging = Boolean(dragState?.isDragging)

  const runInsertCommand = (command: SlashCommand) => {
    onInsertBlock(command.id, target)
    setIsInsertOpen(false)
    editor.view.focus()
  }

  return (
    <>
      {gutterTargets.map((gutterTarget) => {
        const bounds = gutterBoundsForTarget(editor, gutterTarget)
        return (
          <div
            key={`${gutterTarget.pos}-${gutterTarget.node.type.name}`}
            className="mybook-editor-block-gutter fixed z-10 bg-transparent"
            style={{
              top: Math.max(8, gutterTarget.rect.top - 8),
              left: bounds.left,
              width: bounds.width,
              height: Math.max(32, gutterTarget.rect.height + 16),
            }}
            aria-hidden="true"
            onPointerEnter={(event) => {
              if (event.pointerType === 'touch') return
              setTarget(gutterTarget)
            }}
            onPointerMove={(event) => {
              if (event.pointerType === 'touch') return
              setTarget(gutterTarget)
            }}
            onPointerLeave={(event) => {
              if (event.pointerType === 'touch') return
              if (isInsertOpen || isActionsOpen || dragState?.isDragging) return
              const related = event.relatedTarget
              if (related instanceof Node && (editor.view.dom.contains(related) || rootRef.current?.contains(related) || hoverBridgeRef.current?.contains(related))) return
              setTarget(null)
            }}
          />
        )
      })}
      {target ? (
        <>
      <div
        ref={hoverBridgeRef}
        className="mybook-editor-block-hover-bridge fixed z-10 bg-transparent"
        style={{ top: bridgeTop, left: bridgeLeft, width: bridgeWidth, height: bridgeHeight }}
        aria-hidden="true"
        onPointerEnter={(event) => {
          if (event.pointerType === 'touch') return
          setTarget(target)
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === 'touch') return
          if (isInsertOpen || isActionsOpen || dragState?.isDragging) return
          const related = event.relatedTarget
          if (related instanceof Node && (editor.view.dom.contains(related) || rootRef.current?.contains(related))) return
          setTarget(null)
        }}
      />
      <div
        ref={rootRef}
        className={`mybook-editor-block-controls fixed z-20 flex items-center gap-1 ${isDragging ? 'opacity-70' : ''}`}
        style={{ top: controlsTop, left }}
        aria-label="Block controls"
        onPointerLeave={(event) => {
          if (event.pointerType === 'touch') return
          if (isInsertOpen || isActionsOpen || dragState?.isDragging) return
          const related = event.relatedTarget
          if (related instanceof Node && (editor.view.dom.contains(related) || hoverBridgeRef.current?.contains(related))) return
          setTarget(null)
        }}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Add block"
          title="Add block"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (target) {
              const currentSel = editor.state.selection
              if (currentSel.empty) {
                const selection = safeSelectionForBlock(editor, target.pos)
                editor.view.dispatch(editor.state.tr.setSelection(selection))
                editor.view.focus()
              }
            }
            setIsInsertOpen((open) => !open)
            setIsActionsOpen(false)
          }}
          className="flex size-7 items-center justify-center rounded-[7px] text-muted-foreground transition hover:bg-[var(--app-subtle)] hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          <HugeiconsIcon icon={AddCircleIcon} size={16} aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Open block actions"
          title="Open block actions"
          onPointerDown={(event) => {
            if (event.pointerType === 'touch') return
            event.preventDefault()
            selectTarget(editor, target)
            setDragState({ source: toMovableBlock(editor, target), startX: event.clientX, startY: event.clientY, isDragging: false, drop: null })
          }}
          onClick={() => {
            if (suppressNextClickRef.current) return
            if (isDragging) return
            setIsActionsOpen((open) => !open)
            setIsInsertOpen(false)
          }}
          className="flex size-7 cursor-grab items-center justify-center rounded-[7px] text-muted-foreground transition hover:bg-[var(--app-subtle)] hover:text-foreground active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          <GripHandleIcon className="size-4" />
        </Button>
      </div>

      {isInsertOpen ? (
        <div ref={insertMenuRef} className="fixed z-20 max-h-[min(22rem,calc(100dvh-1rem))] w-[min(20rem,calc(100vw-1rem))] overflow-y-auto rounded-[8px] border border-[var(--app-border)] bg-[var(--app-surface)] p-1 shadow-[0_16px_40px_rgba(0,0,0,0.14)]" style={{ top: insertMenuTop, left: insertMenuLeft }} data-command-menu-scroller="true">
          <BlockCommandMenu
            ariaLabel="Insert block options"
            commands={insertBlockCommands}
            selectedIndex={selectedInsertIndex}
            onSelectIndex={setSelectedInsertIndex}
            onRun={runInsertCommand}
          />
        </div>
      ) : null}

      {isActionsOpen ? (
        <div ref={actionsMenuRef} className="fixed z-20 w-44 rounded-[8px] border border-[var(--app-border)] bg-[var(--app-surface)] p-1 shadow-[0_16px_40px_rgba(0,0,0,0.14)]" style={{ top: actionsMenuTop, left: actionsMenuLeft }} role="menu" aria-label="Block actions">
          {(() => {
            const parentColumnsTarget = findParentColumnsTarget(editor, target)
            if (!parentColumnsTarget) return null
            return (
              <>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    selectTarget(editor, parentColumnsTarget)
                    setTarget(parentColumnsTarget)
                    setIsActionsOpen(false)
                  }}
                  className="flex min-h-10 w-full items-center gap-2 rounded-[7px] px-3 text-left text-sm hover:bg-[var(--app-subtle)]"
                >
                  <ViewColumnsIcon aria-hidden="true" className="size-4" />
                  Select columns
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    const insertPos = parentColumnsTarget.pos + parentColumnsTarget.node.nodeSize
                    const paragraphType = editor.state.schema.nodes.paragraph
                    if (paragraphType) {
                      editor
                        .chain()
                        .focus()
                        .insertContentAt(insertPos, paragraphType.createAndFill()!)
                        .setTextSelection(insertPos + 1)
                        .run()
                    }
                    setIsActionsOpen(false)
                  }}
                  className="flex min-h-10 w-full items-center gap-2 rounded-[7px] px-3 text-left text-sm hover:bg-[var(--app-subtle)]"
                >
                  <ArrowDownIcon aria-hidden="true" className="size-4" />
                  Insert below columns
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    deleteColumnAt(editor, target.pos)
                    setIsActionsOpen(false)
                    setTarget(null)
                  }}
                  className="flex min-h-10 w-full items-center gap-2 rounded-[7px] px-3 text-left text-sm text-red-600 hover:bg-red-50"
                >
                  <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4" />
                  Delete column
                </button>
              </>
            )
          })()}
          {target.node.type.name === 'columns' ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                const insertPos = target.pos + target.node.nodeSize
                const paragraphType = editor.state.schema.nodes.paragraph
                if (paragraphType) {
                  editor
                    .chain()
                    .focus()
                    .insertContentAt(insertPos, paragraphType.createAndFill()!)
                    .setTextSelection(insertPos + 1)
                    .run()
                }
                setIsActionsOpen(false)
              }}
              className="flex min-h-10 w-full items-center gap-2 rounded-[7px] px-3 text-left text-sm hover:bg-[var(--app-subtle)]"
            >
              <ArrowDownIcon aria-hidden="true" className="size-4" />
              Insert below columns
            </button>
          ) : null}
          <button type="button" role="menuitem" onClick={() => { void copyTarget(target); setIsActionsOpen(false) }} className="flex min-h-10 w-full items-center gap-2 rounded-[7px] px-3 text-left text-sm hover:bg-[var(--app-subtle)]"><ClipboardDocumentIcon aria-hidden="true" className="size-4" />Copy</button>
          <button type="button" role="menuitem" onClick={() => { duplicateTarget(editor, target); setIsActionsOpen(false) }} className="flex min-h-10 w-full items-center gap-2 rounded-[7px] px-3 text-left text-sm hover:bg-[var(--app-subtle)]"><DocumentDuplicateIcon aria-hidden="true" className="size-4" />Duplicate</button>
          <button type="button" role="menuitem" onClick={() => { deleteTarget(editor, target); setIsActionsOpen(false); setTarget(null); setDragState(null) }} className="flex min-h-10 w-full items-center gap-2 rounded-[7px] px-3 text-left text-sm text-red-600 hover:bg-red-50"><HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4" />Delete</button>
        </div>
      ) : null}
      {dragState?.isDragging && dragState.drop ? (
        <div
          className="pointer-events-none fixed z-20 h-0.5 rounded-full bg-primary shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_18%,transparent)]"
          style={{
            left: Math.max(8, dragState.drop.rect.left),
            top: dragState.drop.side === 'before' ? dragState.drop.rect.top : dragState.drop.rect.bottom,
            width: Math.max(48, dragState.drop.rect.width),
          }}
        />
      ) : null}
        </>
      ) : null}
    </>
  )
}
