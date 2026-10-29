import type { Editor } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Selection, TextSelection } from '@tiptap/pm/state'
import type { BlockTarget } from './EditorBlockControls'
import { capitalizeFirstLetter } from './extensions/BlockAutoCapitalize'

export const FORMAT_COMMAND_IDS = new Set([
  'paragraph',
  'h1',
  'h2',
  'h3',
  'h4',
  'bullet',
  'numbered',
  'task',
  'quote',
  'code-block',
  'toggle',
  'toggle-h1',
  'toggle-h2',
  'toggle-h3',
  'toggle-h4',
  'callout',
])

export function isFormatCommand(commandId: string): boolean {
  return FORMAT_COMMAND_IDS.has(commandId)
}

function getToggleLevel(commandId: string): 1 | 2 | 3 | 4 | null {
  if (commandId === 'toggle') return null
  const num = Number(commandId.replace('toggle-h', ''))
  return num === 1 || num === 2 || num === 3 || num === 4 ? (num as 1 | 2 | 3 | 4) : null
}

export function focusToggleTitle(editor: Editor, pos: number) {
  const tryFocus = () => {
    if (editor.isDestroyed) return false
    const nodeDOM = editor.view.nodeDOM(pos)
    const element = nodeDOM instanceof HTMLElement ? nodeDOM : null
    const titleInput = element?.querySelector<HTMLInputElement>('input.mybook-toggle-title')
    if (titleInput) {
      titleInput.focus()
      const len = titleInput.value.length
      titleInput.setSelectionRange(len, len)
      return true
    }
    return false
  }

  if (!tryFocus()) {
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        if (!tryFocus()) {
          setTimeout(tryFocus, 10)
        }
      })
    }
  }
}

/**
 * Safely resolves a text selection within a block node, avoiding invalid inline endpoint errors.
 */
export function safeSelectionForBlock(editor: Editor, pos: number): Selection {
  const doc = editor.state.doc
  const node = doc.nodeAt(pos)
  if (!node) {
    return TextSelection.near(doc.resolve(Math.min(pos, doc.content.size)))
  }

  if (node.isTextblock) {
    return TextSelection.create(doc, Math.min(pos + 1, doc.content.size))
  }

  // If node is taskItem or listItem, find inner textblock
  let innerPos: number | null = null
  node.descendants((child, childPos) => {
    if (innerPos !== null) return false
    if (child.isTextblock) {
      innerPos = pos + 1 + childPos + 1
      return false
    }
  })

  if (innerPos !== null) {
    return TextSelection.create(doc, Math.min(innerPos, doc.content.size))
  }

  return TextSelection.near(doc.resolve(Math.min(pos + 1, doc.content.size)))
}

export type BlockTargetLike = Pick<BlockTarget, 'pos'> & Partial<Pick<BlockTarget, 'node' | 'rect' | 'controlRect'>>

export function capitalizeCurrentBlockFirstLetter(editor: Editor, targetPos?: number | null): boolean {
  const { state } = editor
  const { doc, selection } = state

  let blockPos: number | null = null
  if (typeof targetPos === 'number') {
    blockPos = targetPos
  } else {
    for (let d = selection.$from.depth; d >= 0; d--) {
      const node = selection.$from.node(d)
      if (node.isTextblock) {
        blockPos = selection.$from.before(d)
        break
      }
    }
  }

  if (blockPos === null) return false
  const node = doc.nodeAt(blockPos)
  if (!node || !node.isTextblock || node.type.name === 'codeBlock' || node.type.name === 'code_block' || node.type.name === 'mathBlock') {
    return false
  }

  const text = node.textContent
  if (!text || !/\p{L}/u.test(text)) return false
  const capitalized = capitalizeFirstLetter(text)
  if (capitalized === text) return false

  let offset = 0
  let replaced = false
  const tr = state.tr
  node.forEach((child) => {
    if (replaced || !child.isText || !child.text) {
      offset += child.nodeSize
      return
    }
    if (/\p{L}/u.test(child.text)) {
      const newChildText = capitalizeFirstLetter(child.text)
      if (newChildText !== child.text) {
        const from = blockPos! + 1 + offset
        const to = from + child.nodeSize
        tr.replaceWith(from, to, editor.schema.text(newChildText, child.marks))
        replaced = true
      }
    }
    offset += child.nodeSize
  })

  if (replaced && tr.docChanged) {
    editor.view.dispatch(tr)
    return true
  }
  return false
}

/**
 * Converts selected blocks or the targeted block to another block type.
 * Works uniformly for single blocks and multiple selected blocks/items (e.g. checklist -> bullet list).
 */
export function convertSelectedBlocks(
  editor: Editor,
  commandId: string,
  blockTarget?: BlockTargetLike | null,
): boolean {
  const { state } = editor
  const { selection } = state

  // Handle conversion TO a toggle block (basic toggle or toggle heading)
  if (commandId.startsWith('toggle')) {
    const toggleLevel = getToggleLevel(commandId)
    const toggleType = editor.schema.nodes.toggleBlock
    const pType = editor.schema.nodes.paragraph
    if (!toggleType || !pType) return false

    if (blockTarget) {
      const targetNode = editor.state.doc.nodeAt(blockTarget.pos)
      if (targetNode) {
        if (targetNode.type.name === 'toggleBlock') {
          editor.view.dispatch(editor.state.tr.setNodeMarkup(blockTarget.pos, undefined, { ...targetNode.attrs, level: toggleLevel }))
          focusToggleTitle(editor, blockTarget.pos)
          return true
        }
        const text = capitalizeFirstLetter(targetNode.textContent.trim())
        const newToggle = toggleType.create({ title: text, open: true, level: toggleLevel }, [pType.create()])
        const tr = editor.state.tr.replaceWith(blockTarget.pos, blockTarget.pos + targetNode.nodeSize, newToggle)
        editor.view.dispatch(tr)
        focusToggleTitle(editor, blockTarget.pos)
        return true
      }
    }

    // Check if cursor is already inside a toggleBlock
    for (let d = selection.$from.depth; d > 0; d--) {
      const parent = selection.$from.node(d)
      if (parent.type.name === 'toggleBlock') {
        const pos = selection.$from.before(d)
        editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...parent.attrs, level: toggleLevel }))
        focusToggleTitle(editor, pos)
        return true
      }
    }

    if (!selection.empty) {
      const text = capitalizeFirstLetter(editor.state.doc.textBetween(selection.from, selection.to, ' ').trim())
      const newToggle = toggleType.create({ title: text, open: true, level: toggleLevel }, [pType.create()])
      const tr = editor.state.tr.replaceWith(selection.from, selection.to, newToggle)
      editor.view.dispatch(tr)
      focusToggleTitle(editor, selection.from)
      return true
    }

    const blockPos = selection.$from.before(Math.min(selection.$from.depth, 1))
    const blockNode = editor.state.doc.nodeAt(blockPos)
    if (blockNode) {
      const text = capitalizeFirstLetter(blockNode.textContent.trim())
      const newToggle = toggleType.create({ title: text, open: true, level: toggleLevel }, [pType.create()])
      const tr = editor.state.tr.replaceWith(blockPos, blockPos + blockNode.nodeSize, newToggle)
      editor.view.dispatch(tr)
      focusToggleTitle(editor, blockPos)
      return true
    }
    return false
  }

  // Handle conversion TO a callout block
  if (commandId === 'callout') {
    const calloutType = editor.schema.nodes.callout
    const pType = editor.schema.nodes.paragraph
    if (!calloutType || !pType) return false

    if (blockTarget) {
      const targetNode = editor.state.doc.nodeAt(blockTarget.pos)
      if (targetNode) {
        if (targetNode.type.name === 'callout') return true
        const text = capitalizeFirstLetter(targetNode.textContent.trim())
        const newCallout = calloutType.create(null, [pType.create(null, text ? editor.schema.text(text) : undefined)])
        const tr = editor.state.tr.replaceWith(blockTarget.pos, blockTarget.pos + targetNode.nodeSize, newCallout)
        editor.view.dispatch(tr)
        return true
      }
    }

    for (let d = selection.$from.depth; d > 0; d--) {
      if (selection.$from.node(d).type.name === 'callout') return true
    }

    if (!selection.empty) {
      const text = capitalizeFirstLetter(editor.state.doc.textBetween(selection.from, selection.to, ' ').trim())
      const newCallout = calloutType.create(null, [pType.create(null, text ? editor.schema.text(text) : undefined)])
      const tr = editor.state.tr.replaceWith(selection.from, selection.to, newCallout)
      editor.view.dispatch(tr)
      return true
    }

    const blockPos = selection.$from.before(Math.min(selection.$from.depth, 1))
    const blockNode = editor.state.doc.nodeAt(blockPos)
    if (blockNode) {
      const text = capitalizeFirstLetter(blockNode.textContent.trim())
      const newCallout = calloutType.create(null, [pType.create(null, text ? editor.schema.text(text) : undefined)])
      const tr = editor.state.tr.replaceWith(blockPos, blockPos + blockNode.nodeSize, newCallout)
      editor.view.dispatch(tr)
      return true
    }
    return false
  }

  // Check if converting FROM a container block (toggleBlock or callout) to a textblock/list
  let containerPos: number | null = null
  let containerNode: ProseMirrorNode | null = null

  if (blockTarget) {
    const node = editor.state.doc.nodeAt(blockTarget.pos)
    if (node && (node.type.name === 'toggleBlock' || node.type.name === 'callout')) {
      containerPos = blockTarget.pos
      containerNode = node
    }
  } else {
    for (let d = selection.$from.depth; d > 0; d--) {
      const n = selection.$from.node(d)
      if (n.type.name === 'toggleBlock' || n.type.name === 'callout') {
        containerPos = selection.$from.before(d)
        containerNode = n
        break
      }
    }
  }

  if (containerPos !== null && containerNode) {
    const {
      paragraph: pNode,
      heading: hNode,
      blockquote: bNode,
      codeBlock: cbNode,
      bulletList: blNode,
      orderedList: olNode,
      listItem: liNode,
      taskList: tlNode,
      taskItem: tiNode,
    } = editor.schema.nodes

    if (containerNode.type.name === 'toggleBlock') {
      const title = capitalizeFirstLetter(String(containerNode.attrs.title || '').trim())
      const children: ProseMirrorNode[] = []
      containerNode.forEach((c) => {
        if (c.textContent.trim() || c.content.size > 0) children.push(c)
      })

      let replacement: ProseMirrorNode[] = []
      if (commandId === 'paragraph' && pNode) {
        replacement = [pNode.create(null, title ? editor.schema.text(title) : undefined), ...children]
      } else if (commandId.startsWith('h') && hNode) {
        const level = Number(commandId.replace('h', '')) as 1 | 2 | 3 | 4
        replacement = [hNode.create({ level }, title ? editor.schema.text(title) : undefined), ...children]
      } else if (commandId === 'quote' && bNode && pNode) {
        const p = pNode.create(null, title ? editor.schema.text(title) : undefined)
        replacement = [bNode.create(null, [p, ...children])]
      } else if (commandId === 'code-block' && cbNode) {
        replacement = [cbNode.create(null, title ? editor.schema.text(title) : undefined), ...children]
      } else if (commandId === 'bullet' && blNode && liNode && pNode) {
        const p = pNode.create(null, title ? editor.schema.text(title) : undefined)
        replacement = [blNode.create(null, [liNode.create(null, [p])]), ...children]
      } else if (commandId === 'numbered' && olNode && liNode && pNode) {
        const p = pNode.create(null, title ? editor.schema.text(title) : undefined)
        replacement = [olNode.create(null, [liNode.create(null, [p])]), ...children]
      } else if (commandId === 'task' && tlNode && tiNode && pNode) {
        const p = pNode.create(null, title ? editor.schema.text(title) : undefined)
        replacement = [tlNode.create(null, [tiNode.create({ checked: false }, [p])]), ...children]
      }

      if (replacement.length > 0) {
        const tr = editor.state.tr.replaceWith(containerPos, containerPos + containerNode.nodeSize, replacement)
        editor.view.dispatch(tr)
        return true
      }
    }

    if (containerNode.type.name === 'callout') {
      const text = capitalizeFirstLetter(containerNode.textContent.trim())
      let replacement: ProseMirrorNode[] = []
      if (commandId === 'paragraph' && pNode) {
        replacement = [pNode.create(null, text ? editor.schema.text(text) : undefined)]
      } else if (commandId.startsWith('h') && hNode) {
        const level = Number(commandId.replace('h', '')) as 1 | 2 | 3 | 4
        replacement = [hNode.create({ level }, text ? editor.schema.text(text) : undefined)]
      } else if (commandId === 'quote' && bNode && pNode) {
        replacement = [bNode.create(null, [pNode.create(null, text ? editor.schema.text(text) : undefined)])]
      } else if (commandId === 'code-block' && cbNode) {
        replacement = [cbNode.create(null, text ? editor.schema.text(text) : undefined)]
      }

      if (replacement.length > 0) {
        const tr = editor.state.tr.replaceWith(containerPos, containerPos + containerNode.nodeSize, replacement)
        editor.view.dispatch(tr)
        return true
      }
    }
  }

  // If selection is collapsed/empty but a blockTarget is provided, position selection inside target
  if (selection.empty && blockTarget) {
    const sel = safeSelectionForBlock(editor, blockTarget.pos)
    editor.view.dispatch(editor.state.tr.setSelection(sel))
  }

  // Lift any list items out of their lists before applying non-matching list or textblock types
  const liftAllFromLists = () => {
    let changed = false
    let depthGuard = 0
    while (
      (editor.can().liftListItem('taskItem') || editor.can().liftListItem('listItem')) &&
      depthGuard < 20
    ) {
      if (editor.can().liftListItem('taskItem')) {
        editor.commands.liftListItem('taskItem')
        changed = true
      } else if (editor.can().liftListItem('listItem')) {
        editor.commands.liftListItem('listItem')
        changed = true
      }
      depthGuard += 1
    }
    return changed
  }

  switch (commandId) {
    case 'bullet': {
      // If inside taskList, lift first so items become paragraphs, then wrap in bulletList
      while (editor.can().liftListItem('taskItem')) {
        editor.commands.liftListItem('taskItem')
      }
      // If inside orderedList, lift first so items become paragraphs, then wrap in bulletList
      if (editor.isActive('orderedList')) {
        while (editor.can().liftListItem('listItem')) {
          editor.commands.liftListItem('listItem')
        }
      }
      if (editor.isActive('heading') || editor.isActive('codeBlock')) {
        editor.commands.setParagraph()
      }
      return editor.chain().focus().wrapInList('bulletList').run()
    }

    case 'numbered': {
      // If inside taskList, lift first
      while (editor.can().liftListItem('taskItem')) {
        editor.commands.liftListItem('taskItem')
      }
      // If inside bulletList, lift first
      if (editor.isActive('bulletList')) {
        while (editor.can().liftListItem('listItem')) {
          editor.commands.liftListItem('listItem')
        }
      }
      if (editor.isActive('heading') || editor.isActive('codeBlock')) {
        editor.commands.setParagraph()
      }
      return editor.chain().focus().wrapInList('orderedList').run()
    }

    case 'task': {
      // If inside bulletList or orderedList, lift first
      while (editor.can().liftListItem('listItem')) {
        editor.commands.liftListItem('listItem')
      }
      if (editor.isActive('heading') || editor.isActive('codeBlock')) {
        editor.commands.setParagraph()
      }
      return editor.chain().focus().wrapInList('taskList').run()
    }

    case 'paragraph': {
      liftAllFromLists()
      const result = editor.chain().focus().setParagraph().run()
      if (result) {
        capitalizeCurrentBlockFirstLetter(editor, blockTarget?.pos)
      }
      return result
    }

    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4': {
      liftAllFromLists()
      const level = Number(commandId.replace('h', '')) as 1 | 2 | 3 | 4
      const result = editor.chain().focus().setHeading({ level }).run()
      if (result) {
        capitalizeCurrentBlockFirstLetter(editor, blockTarget?.pos)
      }
      return result
    }

    case 'quote': {
      liftAllFromLists()
      const result = editor.chain().focus().setBlockquote().run()
      if (result) {
        capitalizeCurrentBlockFirstLetter(editor, blockTarget?.pos)
      }
      return result
    }

    case 'code-block': {
      liftAllFromLists()
      return editor.chain().focus().setCodeBlock().run()
    }

    default:
      return false
  }
}
