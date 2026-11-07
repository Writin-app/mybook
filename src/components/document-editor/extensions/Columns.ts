import { mergeAttributes, Node, type Editor } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'

export const columnCounts = [2, 3, 4, 5] as const
export type ColumnCount = typeof columnCounts[number]

export function normalizeColumnCount(value: unknown): ColumnCount {
  const num = Number(value)
  return columnCounts.includes(num as ColumnCount) ? (num as ColumnCount) : 2
}

export const Column = Node.create({
  name: 'column',
  content: 'block+',
  isolating: true,
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-type="column"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'column',
        class: 'mybook-column',
      }),
      0,
    ]
  },
})

export const Columns = Node.create({
  name: 'columns',
  group: 'block',
  content: 'column{2,5}',
  defining: true,

  addAttributes() {
    return {
      count: {
        default: 2,
        parseHTML: (element) => normalizeColumnCount(element.getAttribute('data-columns') ?? element.getAttribute('data-count')),
        renderHTML: (attributes) => ({
          'data-columns': String(normalizeColumnCount(attributes.count)),
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="columns"]' }]
  },

  renderHTML({ HTMLAttributes, node }) {
    const count = normalizeColumnCount(node.attrs.count ?? node.childCount ?? 2)
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'columns',
        'data-columns': String(count),
        class: `mybook-columns mybook-columns-${count}`,
      }),
      0,
    ]
  },

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { state, view } = this.editor
        const { selection } = state
        if (!selection.empty) return false
        const { $from } = selection

        // Check if inside a column
        let columnDepth = -1
        let columnsDepth = -1
        for (let d = $from.depth; d > 0; d -= 1) {
          if ($from.node(d).type.name === 'column') {
            columnDepth = d
          } else if ($from.node(d).type.name === 'columns') {
            columnsDepth = d
          }
        }
        if (columnDepth === -1 || columnsDepth === -1) return false

        const columnsNode = $from.node(columnsDepth)
        const columnNode = $from.node(columnDepth)
        const columnsPos = $from.before(columnsDepth)

        // Check if this is the last column in columns
        const columnIndex = $from.index(columnsDepth)
        const isLastColumn = columnIndex === columnsNode.childCount - 1

        // Check if current block is an empty paragraph at the end of the column
        const currentBlock = $from.parent
        const isCurrentBlockEmpty = currentBlock.isTextblock && currentBlock.content.size === 0
        if (!isCurrentBlockEmpty) return false

        // Check if it's the last child in the column
        const blockIndex = $from.index(columnDepth)
        const isLastBlockInColumn = blockIndex === columnNode.childCount - 1
        if (!isLastBlockInColumn) return false

        const blockPos = $from.before($from.depth)
        const tr = state.tr

        if (!isLastColumn) {
          if (columnNode.childCount > 1) {
            tr.delete(blockPos, blockPos + currentBlock.nodeSize)
          }
          let nextColPos = columnsPos + 1
          for (let i = 0; i <= columnIndex; i += 1) {
            nextColPos += columnsNode.child(i).nodeSize
          }
          const mappedNextColPos = tr.mapping.map(nextColPos)
          const targetSelection = TextSelection.findFrom(tr.doc.resolve(mappedNextColPos + 1), 1)
          if (targetSelection) {
            tr.setSelection(targetSelection)
            view.dispatch(tr.scrollIntoView())
            return true
          }
          return false
        }

        const insertAfterPos = columnsPos + columnsNode.nodeSize
        if (columnNode.childCount > 1) {
          tr.delete(blockPos, blockPos + currentBlock.nodeSize)
        }
        const mappedInsertPos = tr.mapping.map(insertAfterPos)
        const paragraphType = state.schema.nodes.paragraph
        if (!paragraphType) return false
        tr.insert(mappedInsertPos, paragraphType.createAndFill()!)
        tr.setSelection(TextSelection.create(tr.doc, mappedInsertPos + 1))
        view.dispatch(tr)
        return true
      },

      ArrowDown: () => {
        const { state, view } = this.editor
        const { selection } = state
        if (!selection.empty) return false
        const { $from } = selection

        let columnDepth = -1
        let columnsDepth = -1
        for (let d = $from.depth; d > 0; d -= 1) {
          if ($from.node(d).type.name === 'column') {
            columnDepth = d
          } else if ($from.node(d).type.name === 'columns') {
            columnsDepth = d
          }
        }
        if (columnDepth === -1 || columnsDepth === -1) return false

        const columnsNode = $from.node(columnsDepth)
        const columnNode = $from.node(columnDepth)
        const columnsPos = $from.before(columnsDepth)

        // Check if this is the last column
        const columnIndex = $from.index(columnsDepth)
        const isLastColumn = columnIndex === columnsNode.childCount - 1
        if (!isLastColumn) return false

        // Check if this is the last child block in the last column
        const blockIndex = $from.index(columnDepth)
        const isLastBlockInColumn = blockIndex === columnNode.childCount - 1
        if (!isLastBlockInColumn) return false

        // Check if caret is at the end of this block
        const isAtBlockEnd = $from.parentOffset === $from.parent.content.size
        if (!isAtBlockEnd) return false

        // Check if columns is the last root-level block in the doc
        const isLastRootBlock = columnsPos + columnsNode.nodeSize >= state.doc.content.size
        if (!isLastRootBlock) return false

        // Create and focus a root-level paragraph below columns
        const insertAfterPos = state.doc.content.size
        const paragraphType = state.schema.nodes.paragraph
        if (!paragraphType) return false
        const tr = state.tr.insert(insertAfterPos, paragraphType.createAndFill()!)
        tr.setSelection(TextSelection.create(tr.doc, insertAfterPos + 1))
        view.dispatch(tr)
        return true
      },

      Tab: () => {
        const { state, view } = this.editor
        const { selection } = state
        if (!selection.empty) return false
        const { $from } = selection

        let columnDepth = -1
        let columnsDepth = -1
        for (let d = $from.depth; d > 0; d -= 1) {
          if ($from.node(d).type.name === 'column') {
            columnDepth = d
          } else if ($from.node(d).type.name === 'columns') {
            columnsDepth = d
          }
        }
        if (columnDepth === -1 || columnsDepth === -1) return false

        const columnsNode = $from.node(columnsDepth)
        const columnIndex = $from.index(columnsDepth)
        const columnsPos = $from.before(columnsDepth)

        // If not the last column, move to the next column
        if (columnIndex < columnsNode.childCount - 1) {
          let targetColPos = columnsPos + 1
          for (let i = 0; i <= columnIndex; i += 1) {
            targetColPos += columnsNode.child(i).nodeSize
          }
          // targetColPos is now at the start of the next column
          // We want to focus inside the first block of that column
          const targetSelection = TextSelection.findFrom(state.doc.resolve(targetColPos + 1), 1)
          if (targetSelection) {
            view.dispatch(state.tr.setSelection(targetSelection).scrollIntoView())
            return true
          }
        }

        // If in the last column:
        // Check if there is already a block after columns
        const afterColumnsPos = columnsPos + columnsNode.nodeSize
        if (afterColumnsPos < state.doc.content.size) {
          const targetSelection = TextSelection.findFrom(state.doc.resolve(afterColumnsPos), 1)
          if (targetSelection) {
            view.dispatch(state.tr.setSelection(targetSelection).scrollIntoView())
            return true
          }
        }

        // If columns is the last block in document, create a paragraph after it
        const paragraphType = state.schema.nodes.paragraph
        if (!paragraphType) return false
        const tr = state.tr.insert(afterColumnsPos, paragraphType.createAndFill()!)
        tr.setSelection(TextSelection.create(tr.doc, afterColumnsPos + 1)).scrollIntoView()
        view.dispatch(tr)
        return true
      },

      'Shift-Tab': () => {
        const { state, view } = this.editor
        const { selection } = state
        if (!selection.empty) return false
        const { $from } = selection

        let columnDepth = -1
        let columnsDepth = -1
        for (let d = $from.depth; d > 0; d -= 1) {
          if ($from.node(d).type.name === 'column') {
            columnDepth = d
          } else if ($from.node(d).type.name === 'columns') {
            columnsDepth = d
          }
        }
        if (columnDepth === -1 || columnsDepth === -1) return false

        const columnsNode = $from.node(columnsDepth)
        const columnIndex = $from.index(columnsDepth)
        const columnsPos = $from.before(columnsDepth)

        // If not the first column, move to previous column
        if (columnIndex > 0) {
          let prevColPos = columnsPos + 1
          for (let i = 0; i < columnIndex - 1; i += 1) {
            prevColPos += columnsNode.child(i).nodeSize
          }
          const prevColNode = columnsNode.child(columnIndex - 1)
          // Focus at the end of the previous column's last block
          const endOfPrevColPos = prevColPos + prevColNode.nodeSize - 1
          const targetSelection = TextSelection.findFrom(state.doc.resolve(endOfPrevColPos), -1)
          if (targetSelection) {
            view.dispatch(state.tr.setSelection(targetSelection).scrollIntoView())
            return true
          }
        }

        // If in the first column, check if there is a block before columns
        if (columnsPos > 0) {
          const targetSelection = TextSelection.findFrom(state.doc.resolve(columnsPos), -1)
          if (targetSelection) {
            view.dispatch(state.tr.setSelection(targetSelection).scrollIntoView())
            return true
          }
        }

        return false
      },
    }
  },
})

export function columnNode(content: Record<string, unknown>[] = [{ type: 'paragraph' }]) {
  return {
    type: 'column',
    content,
  }
}

export function columnsNode(count: ColumnCount = 2) {
  const normalized = normalizeColumnCount(count)
  return {
    type: 'columns',
    attrs: { count: normalized },
    content: Array.from({ length: normalized }, () => columnNode()),
  }
}

export function deleteColumnAt(editor: Pick<Editor, 'state' | 'view'>, pos: number): boolean {
  const { state, view } = editor
  const $pos = state.doc.resolve(Math.min(pos, state.doc.content.size))
  let columnDepth = -1
  let columnsDepth = -1
  for (let d = $pos.depth; d > 0; d -= 1) {
    const node = $pos.node(d)
    if (node.type.name === 'column' && columnDepth === -1) {
      columnDepth = d
    } else if (node.type.name === 'columns' && columnsDepth === -1) {
      columnsDepth = d
    }
  }
  if (columnDepth === -1 || columnsDepth === -1) return false

  const columnsNode = $pos.node(columnsDepth)
  const columnNode = $pos.node(columnDepth)
  const columnsPos = $pos.before(columnsDepth)
  const columnPos = $pos.before(columnDepth)
  const columnIndex = $pos.index(columnsDepth)

  if (columnsNode.childCount <= 1) return false

  if (columnsNode.childCount === 2) {
    // 2 columns: deleting 1 leaves 1. Unwrap remaining column into parent document.
    const remainingIndex = columnIndex === 0 ? 1 : 0
    const remainingColumn = columnsNode.child(remainingIndex)
    const tr = state.tr.replaceWith(
      columnsPos,
      columnsPos + columnsNode.nodeSize,
      remainingColumn.content
    )
    const targetSelection = TextSelection.findFrom(tr.doc.resolve(columnsPos), 1)
    if (targetSelection) tr.setSelection(targetSelection)
    view.dispatch(tr.scrollIntoView())
    return true
  }

  // 3, 4, 5 columns: remove column and decrement count
  const newCount = normalizeColumnCount(columnsNode.childCount - 1)
  const tr = state.tr
  tr.delete(columnPos, columnPos + columnNode.nodeSize)
  tr.setNodeMarkup(columnsPos, undefined, {
    ...columnsNode.attrs,
    count: newCount,
  })
  const targetSelection = TextSelection.findFrom(tr.doc.resolve(Math.min(columnPos, tr.doc.content.size)), 1)
  if (targetSelection) tr.setSelection(targetSelection)
  view.dispatch(tr.scrollIntoView())
  return true
}
