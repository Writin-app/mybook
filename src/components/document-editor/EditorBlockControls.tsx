import { ArrowDownIcon, ClipboardDocumentIcon, DocumentDuplicateIcon, PlusIcon, ViewColumnsIcon } from '@heroicons/react/24/outline'
import { Delete02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { Editor } from '@tiptap/react'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { NodeSelection, Selection, TextSelection } from '@tiptap/pm/state'
import { useEffect, useRef, useState } from 'react'

import { useHoverBlockControlsAvailable } from '../../hooks/useHoverBlockControls'
import { Button } from '../ui/button'
import { BlockCommandMenu } from './SlashCommandMenu'
import { commandMenuTop, type SlashCommand } from './slashCommands'
import { safeSelectionForBlock } from './blockConversion'
import { BLOCK_CONTAINERS, movableBlockAt } from './blockDrag'
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
  const clampedPos = Math.max(0, Math.min(pos, editor.state.doc.content.size))
  let coords = { left: 0, top: 0, right: 0, bottom: 0 }
  try {
    coords = view.coordsAtPos(clampedPos)
  } catch {
    // View might not have finished updating DOM
  }
  const blockElement = view.nodeDOM(clampedPos)
  const editorDomRect = view.dom.getBoundingClientRect()
  const fallbackWidth = Math.max(0, editorDomRect.width - 32)
  let rect = blockElement instanceof Element
    ? blockElement.getBoundingClientRect()
    : new DOMRect(coords.left, coords.top, Math.max(coords.right - coords.left, fallbackWidth), coords.bottom - coords.top)

  if (node.type.name === 'toggleBlock' && blockElement instanceof Element) {
    const summary = blockElement.querySelector<HTMLElement>('.mybook-toggle-summary')
    if (summary) {
      rect = summary.getBoundingClientRect()
    }
  }
  const $from = editor.state.doc.resolve(Math.min(pos + 1, editor.state.doc.content.size))

  let containerDepth = -1
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if (BLOCK_CONTAINERS.has($from.node(depth).type.name)) {
      containerDepth = depth
      break
    }
  }

  let topPos = pos
  if (containerDepth !== -1 && $from.depth > containerDepth) {
    topPos = $from.before(containerDepth + 1)
  } else if ($from.depth > 0) {
    topPos = $from.before(1)
  }

  const topElement = view.nodeDOM(Math.max(0, Math.min(topPos, editor.state.doc.content.size)))
  let topCoords = coords
  try {
    topCoords = view.coordsAtPos(Math.max(0, Math.min(topPos, editor.state.doc.content.size)))
  } catch {
    // View might not have finished updating DOM
  }
  const controlRect = topElement instanceof Element
    ? topElement.getBoundingClientRect()
    : new DOMRect(topCoords.left, topCoords.top, Math.max(topCoords.right - topCoords.left, fallbackWidth), topCoords.bottom - topCoords.top)
  return { node, pos, rect, controlRect }
}

function blockTargetAtResolvedPos(editor: Editor, pos: number): BlockTarget | null {
  const { state } = editor
  const clampedPos = Math.max(0, Math.min(pos, state.doc.content.size))
  const $from = state.doc.resolve(clampedPos)

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth)
    if (node.type.name !== 'table') continue
    const tablePos = $from.before(depth)
    return targetAtBlockPos(editor, node, tablePos)
  }

  if ($from.depth === 0) {
    if ($from.nodeAfter && $from.nodeAfter.isBlock) {
      return targetAtBlockPos(editor, $from.nodeAfter, clampedPos)
    }
    if ($from.nodeBefore && $from.nodeBefore.isBlock) {
      return targetAtBlockPos(editor, $from.nodeBefore, clampedPos - $from.nodeBefore.nodeSize)
    }
    return null
  }

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth)
    if (node.type.name !== 'taskItem') continue
    const taskPos = $from.before(depth)
    return targetAtBlockPos(editor, node, taskPos)
  }

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth)
    if (node.type.name === 'column') continue
    if (node.isBlock) {
      const blockPos = $from.before(depth)
      return targetAtBlockPos(editor, node, blockPos)
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

  const toggleElement = event.target instanceof Element ? event.target.closest<HTMLElement>('.mybook-toggle') : null
  if (toggleElement && event.target instanceof Element && event.target.closest('.mybook-toggle-summary')) {
    let match: BlockTarget | null = null
    editor.state.doc.descendants((node, pos) => {
      if (match || node.type.name !== 'toggleBlock') return
      const nodeElement = editor.view.nodeDOM(pos)
      if (nodeElement === toggleElement) {
        match = targetAtBlockPos(editor, node, pos)
      }
    })
    if (match) return match
  }

  // While dragging from the gutter the pointer is left of the text, where posAtCoords finds nothing
  const editorRect = editor.view.dom.getBoundingClientRect()
  const left = clampToEditor
    ? Math.min(Math.max(event.clientX, editorRect.left + 8), editorRect.right - 8)
    : event.clientX
  const result = editor.view.posAtCoords({ left, top: event.clientY })
  if (!result) return null
  const target = blockTargetAtResolvedPos(editor, result.pos)
  if (target?.node.type.name === 'toggleBlock') {
    const toggleDom = editor.view.nodeDOM(target.pos)
    const summary = toggleDom instanceof Element ? toggleDom.querySelector<HTMLElement>('.mybook-toggle-summary') : null
    if (summary) {
      const summaryRect = summary.getBoundingClientRect()
      if (event.clientY > summaryRect.bottom + 4) {
        return findGutterTarget(editor, event)
      }
    } else if (event.target instanceof Element && !event.target.closest('.mybook-toggle-summary')) {
      return findGutterTarget(editor, event)
    }
  }
  return target
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
  if (target.pos < 0 || target.pos > editor.state.doc.content.size) return target
  const block = movableBlockAt(editor.state.doc, target.pos)
  if (!block || block.pos === target.pos) return target
  return targetAtBlockPos(editor, block.node, block.pos)
}

function selectTarget(editor: Editor, target: BlockTarget) {
  if (target.pos < 0 || target.pos > editor.state.doc.content.size) return
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
  if (target.pos < 0 || target.pos > editor.state.doc.content.size) return null
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
  if (target.pos < 0 || target.pos > editor.state.doc.content.size) return
  const $pos = editor.state.doc.resolve(target.pos)
  let parentContainer: { node: ProseMirrorNode; pos: number } | null = null
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const typeName = $pos.node(depth).type.name
    if (BLOCK_CONTAINERS.has(typeName)) {
      parentContainer = { node: $pos.node(depth), pos: $pos.before(depth) }
      break
    }
  }

  // Empty container safety: if this is the only block inside a container, replace it with an empty paragraph instead of leaving container empty
  if (parentContainer && parentContainer.node.childCount <= 1) {
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

function safePostMoveSelection(editor: Editor, pos: number, node: ProseMirrorNode): Selection {
  const doc = editor.state.doc
  const maxPos = doc.content.size
  if (node.isTextblock && node.content.size > 0) {
    return TextSelection.create(doc, Math.min(pos + 1, maxPos))
  }
  if (node.type.name === 'table') {
    let firstCellPos: number | null = null
    node.descendants((child, childPos) => {
      if (firstCellPos !== null) return false
      if (child.isTextblock) {
        firstCellPos = pos + 1 + childPos + 1
        return false
      }
    })
    if (firstCellPos !== null && firstCellPos <= maxPos) {
      return TextSelection.create(doc, firstCellPos)
    }
  }
  if (NodeSelection.isSelectable(node)) {
    return NodeSelection.create(doc, Math.min(pos, maxPos))
  }
  return TextSelection.near(doc.resolve(Math.min(pos + 1, maxPos)))
}

function moveTarget(editor: Editor, source: BlockTarget, drop: { pos: number; side: 'before' | 'after' }) {
  if (source.node.type.name === 'column') return
  const dropNode = editor.state.doc.nodeAt(drop.pos)
  if (!dropNode) return
  const targetInsertPos = drop.side === 'before' ? drop.pos : drop.pos + dropNode.nodeSize
  if (targetInsertPos >= source.pos && targetInsertPos <= source.pos + source.node.nodeSize) return
  if (source.node.type.name === 'columns') {
    const resolved = editor.state.doc.resolve(targetInsertPos)
    for (let depth = resolved.depth; depth > 0; depth -= 1) {
      if (resolved.node(depth).type.name === 'column' || resolved.node(depth).type.name === 'columns') return
    }
  }

  const $sourcePos = editor.state.doc.resolve(source.pos)
  let sourceParentContainer: { node: ProseMirrorNode; pos: number } | null = null
  for (let depth = $sourcePos.depth; depth > 0; depth -= 1) {
    const typeName = $sourcePos.node(depth).type.name
    if (BLOCK_CONTAINERS.has(typeName)) {
      sourceParentContainer = { node: $sourcePos.node(depth), pos: $sourcePos.before(depth) }
      break
    }
  }

  const paragraphType = editor.state.schema.nodes.paragraph
  if (sourceParentContainer && sourceParentContainer.node.childCount <= 1 && paragraphType) {
    const emptyParagraph = paragraphType.createAndFill()!
    const tr = editor.state.tr.replaceWith(source.pos, source.pos + source.node.nodeSize, emptyParagraph)
    const adjustedTarget = targetInsertPos > source.pos
      ? targetInsertPos - source.node.nodeSize + emptyParagraph.nodeSize
      : targetInsertPos
    tr.insert(adjustedTarget, source.node)
    editor.view.dispatch(tr.scrollIntoView())
    const selection = safePostMoveSelection(editor, adjustedTarget, source.node)
    editor.view.dispatch(editor.state.tr.setSelection(selection))
    editor.view.focus()
    return
  }

  // Dropping into an empty toggle block placeholder:
  const $dropPos = editor.state.doc.resolve(drop.pos)
  let dropParentToggle: { node: ProseMirrorNode; pos: number } | null = null
  for (let depth = $dropPos.depth; depth > 0; depth -= 1) {
    if ($dropPos.node(depth).type.name === 'toggleBlock') {
      dropParentToggle = { node: $dropPos.node(depth), pos: $dropPos.before(depth) }
      break
    }
  }
  if (dropParentToggle && dropParentToggle.node.childCount === 1 && dropNode.isTextblock && dropNode.content.size === 0) {
    let tr = editor.state.tr.delete(source.pos, source.pos + source.node.nodeSize)
    const adjustedDropPos = drop.pos > source.pos ? drop.pos - source.node.nodeSize : drop.pos
    tr.replaceWith(adjustedDropPos, adjustedDropPos + dropNode.nodeSize, source.node)
    const togglePos = dropParentToggle.pos > source.pos ? dropParentToggle.pos - source.node.nodeSize : dropParentToggle.pos
    const currentToggle = tr.doc.nodeAt(togglePos)
    if (currentToggle && currentToggle.type.name === 'toggleBlock' && !currentToggle.attrs.open) {
      tr = tr.setNodeMarkup(togglePos, undefined, { ...currentToggle.attrs, open: true })
    }
    editor.view.dispatch(tr.scrollIntoView())
    const selection = safePostMoveSelection(editor, adjustedDropPos, source.node)
    editor.view.dispatch(editor.state.tr.setSelection(selection))
    editor.view.focus()
    return
  }

  const insertPos = targetInsertPos > source.pos ? targetInsertPos - source.node.nodeSize : targetInsertPos
  const tr = editor.state.tr.delete(source.pos, source.pos + source.node.nodeSize).insert(insertPos, source.node)
  editor.view.dispatch(tr.scrollIntoView())
  const selection = safePostMoveSelection(editor, insertPos, source.node)
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
      if (isInsertOpen || isActionsOpen || dragState) return
      const pointerNode = event.target as Node | null
      if (
        pointerNode &&
        (rootRef.current?.contains(pointerNode) ||
          hoverBridgeRef.current?.contains(pointerNode) ||
          insertMenuRef.current?.contains(pointerNode) ||
          actionsMenuRef.current?.contains(pointerNode) ||
          (pointerNode instanceof Element && pointerNode.closest('.mybook-editor-block-gutter')))
      ) return
      setTarget(findPointerTarget(editor, event) ?? findGutterTarget(editor, event))
    }
    const hideFromPointerLeave = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      if (isInsertOpen || isActionsOpen || dragState) return
      const related = event.relatedTarget
      if (
        related instanceof Node &&
        (rootRef.current?.contains(related) ||
          hoverBridgeRef.current?.contains(related) ||
          (related instanceof Element && related.closest('.mybook-editor-block-gutter')))
      ) return
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
  }, [dragState, editor, isActionsOpen, isInsertOpen])

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
          if (!command.id.startsWith('toggle')) {
            editor.view.focus()
          }
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
      let drop = dragState.drop
      if (dropBlock && dropBlock.pos !== dragState.source.pos) {
        let side: 'before' | 'after' = event.clientY < dropBlock.rect.top + dropBlock.rect.height / 2 ? 'before' : 'after'
        let dropRect = dropBlock.rect
        let dropPos = dropBlock.pos

        // If target is a toggleBlock and hovering over its summary
        if (dropBlock.node.type.name === 'toggleBlock') {
          const dom = editor.view.nodeDOM(dropBlock.pos)
          const summary = dom instanceof Element ? dom.querySelector<HTMLElement>('.mybook-toggle-summary') : null
          if (summary) {
            const summaryRect = summary.getBoundingClientRect()
            if (event.clientY <= summaryRect.bottom + 4) {
              const isOpen = Boolean(dropBlock.node.attrs.open !== false)
              if (event.clientY < summaryRect.top + summaryRect.height / 2) {
                side = 'before'
                dropRect = summaryRect
              } else if (isOpen && dropBlock.node.childCount > 0) {
                // Drop inside the toggle as the first child
                const firstChildPos = dropBlock.pos + 1
                const firstChildDom = editor.view.nodeDOM(firstChildPos)
                const firstChildRect = firstChildDom instanceof Element
                  ? firstChildDom.getBoundingClientRect()
                  : new DOMRect(summaryRect.left, summaryRect.bottom, summaryRect.width, 24)
                dropPos = firstChildPos
                side = 'before'
                dropRect = firstChildRect
              } else {
                side = 'after'
                dropRect = summaryRect
              }
            }
          }
        }

        drop = {
          pos: dropPos,
          side,
          rect: dropRect,
        }
      }
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

  const validTarget = target && target.pos <= editor.state.doc.content.size ? target : null
  const top = blockControlsTop(validTarget)
  const left = Math.max(8, (validTarget?.controlRect.left ?? 76) - 68)
  const header = document.querySelector<HTMLElement>('.mybook-document-editor > header')
  const headerBottom = header?.getBoundingClientRect().bottom ?? 0
  const menuBoundary = Math.max(8, headerBottom + 8)
  const viewportHeight = typeof window !== 'undefined'
    ? (window.visualViewport ? window.visualViewport.offsetTop + window.visualViewport.height : window.innerHeight)
    : 768
  const maxControlsTop = Math.max(menuBoundary, viewportHeight - 36)
  const controlsTop = Math.max(menuBoundary, Math.min(top, maxControlsTop))
  const bridgeTop = Math.max(8, Math.min(controlsTop, validTarget?.rect.top ?? controlsTop))
  const bridgeLeft = Math.max(0, left)
  const bridgeWidth = Math.max(0, Math.max(validTarget?.controlRect.left ?? left, validTarget?.rect.left ?? left) - bridgeLeft)
  const bridgeHeight = Math.max(32, validTarget?.rect.height ?? 32)
  const menuRect = new DOMRect(left, controlsTop, 56, 28)
  const insertMenuTop = commandMenuTop(menuRect, 352, 8, menuBoundary)
  const insertMenuWidth = 320
  const insertMenuLeft = Math.max(8, Math.min(left, window.innerWidth - insertMenuWidth - 8))
  const insertMenuMaxHeight = Math.min(352, Math.max(160, viewportHeight - insertMenuTop - 8))

  const parentColumnsTarget = validTarget ? findParentColumnsTarget(editor, validTarget) : null
  const actionsMenuEstimatedHeight = parentColumnsTarget ? 272 : validTarget?.node.type.name === 'columns' ? 180 : 144
  const actionsMenuTop = commandMenuTop(menuRect, actionsMenuEstimatedHeight, 8, menuBoundary)
  const actionsMenuWidth = 176
  const actionsMenuMaxHeight = Math.max(120, viewportHeight - actionsMenuTop - 8)
  const gripLeft = left + 32
  const gripRight = left + 60
  const rightAlignedActionsLeft = gripRight - actionsMenuWidth
  const flippedActionsLeft = gripLeft
  const actionsMenuLeft = Math.max(8, rightAlignedActionsLeft >= 8
    ? Math.min(rightAlignedActionsLeft, window.innerWidth - actionsMenuWidth - 8)
    : Math.min(flippedActionsLeft, window.innerWidth - actionsMenuWidth - 8))
  const isDragging = Boolean(dragState?.isDragging)

  const runInsertCommand = (command: SlashCommand) => {
    if (!validTarget) return
    onInsertBlock(command.id, validTarget)
    setIsInsertOpen(false)
    if (!command.id.startsWith('toggle')) {
      editor.view.focus()
    }
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
      {validTarget ? (
        <>
      <div
        ref={hoverBridgeRef}
        className="mybook-editor-block-hover-bridge fixed z-10 bg-transparent"
        style={{ top: bridgeTop, left: bridgeLeft, width: bridgeWidth, height: bridgeHeight }}
        aria-hidden="true"
        onPointerEnter={(event) => {
          if (event.pointerType === 'touch') return
          setTarget(validTarget)
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === 'touch') return
          if (isInsertOpen || isActionsOpen || dragState?.isDragging) return
          const related = event.relatedTarget
          if (
            related instanceof Node &&
            (editor.view.dom.contains(related) ||
              rootRef.current?.contains(related) ||
              (related instanceof Element && related.closest('.mybook-editor-block-gutter')))
          ) return
          setTarget(null)
        }}
      />
      <div
        ref={rootRef}
        className={`mybook-editor-block-controls fixed ${isInsertOpen || isActionsOpen ? 'z-50' : 'z-20'} flex items-center gap-1 ${isDragging ? 'opacity-70' : ''}`}
        style={{ top: controlsTop, left }}
        aria-label="Block controls"
        onPointerLeave={(event) => {
          if (event.pointerType === 'touch') return
          if (isInsertOpen || isActionsOpen || dragState?.isDragging) return
          const related = event.relatedTarget
          if (
            related instanceof Node &&
            (editor.view.dom.contains(related) ||
              hoverBridgeRef.current?.contains(related) ||
              (related instanceof Element && related.closest('.mybook-editor-block-gutter')))
          ) return
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
            if (validTarget) {
              const currentSel = editor.state.selection
              if (currentSel.empty) {
                const selection = safeSelectionForBlock(editor, validTarget.pos)
                editor.view.dispatch(editor.state.tr.setSelection(selection))
                editor.view.focus()
              }
            }
            setIsInsertOpen((open) => !open)
            setIsActionsOpen(false)
          }}
          className="flex size-7 items-center justify-center rounded-[7px] text-muted-foreground transition hover:bg-[var(--app-subtle)] hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          <PlusIcon aria-hidden="true" className="size-4" />
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
            selectTarget(editor, validTarget)
            setDragState({ source: toMovableBlock(editor, validTarget), startX: event.clientX, startY: event.clientY, isDragging: false, drop: null })
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
        <div
          ref={insertMenuRef}
          data-block-insert-menu="true"
          data-editor-popover="true"
          className="fixed z-50 max-h-[min(22rem,calc(100dvh-1rem))] w-[min(20rem,calc(100vw-1rem))] overflow-y-auto rounded-[8px] border border-[var(--app-border)] bg-[var(--app-surface)] p-1 shadow-[0_16px_40px_rgba(0,0,0,0.14)]"
          style={{ top: insertMenuTop, left: insertMenuLeft, maxHeight: insertMenuMaxHeight }}
          data-command-menu-scroller="true"
        >
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
        <div
          ref={actionsMenuRef}
          data-block-actions-menu="true"
          data-editor-popover="true"
          className="fixed z-50 w-44 overflow-y-auto rounded-[8px] border border-[var(--app-border)] bg-[var(--app-surface)] p-1 shadow-[0_16px_40px_rgba(0,0,0,0.14)]"
          style={{ top: actionsMenuTop, left: actionsMenuLeft, maxHeight: `${actionsMenuMaxHeight}px` }}
          role="menu"
          aria-label="Block actions"
        >
          {(() => {
            const parentColumnsTarget = validTarget ? findParentColumnsTarget(editor, validTarget) : null
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
                    deleteColumnAt(editor, validTarget.pos)
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
          {validTarget.node.type.name === 'columns' ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                const insertPos = validTarget.pos + validTarget.node.nodeSize
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
          <button type="button" role="menuitem" onClick={() => { void copyTarget(validTarget); setIsActionsOpen(false) }} className="flex min-h-10 w-full items-center gap-2 rounded-[7px] px-3 text-left text-sm hover:bg-[var(--app-subtle)]"><ClipboardDocumentIcon aria-hidden="true" className="size-4" />Copy</button>
          <button type="button" role="menuitem" onClick={() => { duplicateTarget(editor, validTarget); setIsActionsOpen(false) }} className="flex min-h-10 w-full items-center gap-2 rounded-[7px] px-3 text-left text-sm hover:bg-[var(--app-subtle)]"><DocumentDuplicateIcon aria-hidden="true" className="size-4" />Duplicate</button>
          <button type="button" role="menuitem" onClick={() => { setIsActionsOpen(false); setTarget(null); setDragState(null); deleteTarget(editor, validTarget); }} className="flex min-h-10 w-full items-center gap-2 rounded-[7px] px-3 text-left text-sm text-red-600 hover:bg-red-50"><HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4" />Delete</button>
        </div>
      ) : null}
        </>
      ) : null}
      {dragState?.isDragging && dragState.drop ? (
        <div
          data-drop-indicator="true"
          className="pointer-events-none fixed z-50 h-0.5 rounded-full bg-primary shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_18%,transparent)]"
          style={{
            left: Math.max(8, dragState.drop.rect.left),
            top: dragState.drop.side === 'before' ? dragState.drop.rect.top : dragState.drop.rect.bottom,
            width: Math.max(48, dragState.drop.rect.width),
          }}
        />
      ) : null}
    </>
  )
}
