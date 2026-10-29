import { Extension, type Editor } from '@tiptap/core'
import { Selection, TextSelection } from '@tiptap/pm/state'
import type { ResolvedPos } from '@tiptap/pm/model'

const isInsideTableCell = (pos: ResolvedPos) => {
  for (let depth = pos.depth; depth > 0; depth -= 1) {
    const name = pos.node(depth).type.name
    if (name === 'tableCell' || name === 'tableHeader') return true
  }
  return false
}

// prosemirror-tables treats Arrow at the cell edge as "go to next cell" even with text selected,
// so collapse a non-empty selection to its edge ourselves
const collapseSelectionWithinCell = (editor: Editor, direction: 'start' | 'end') => {
  const { state, view } = editor
  const { selection } = state
  if (!(selection instanceof TextSelection) || selection.empty) return false
  if (!isInsideTableCell(selection.$from) || !isInsideTableCell(selection.$to)) return false

  const target = direction === 'end' ? selection.to : selection.from
  view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, target)).scrollIntoView())
  return true
}

// Extend the selection to the cell paragraph edge so it never spills into a neighbouring cell
const extendSelectionWithinCell = (editor: Editor, direction: 'start' | 'end') => {
  const { state, view } = editor
  const { selection } = state
  if (!(selection instanceof TextSelection)) return false

  const { $head, $anchor } = selection
  if (!isInsideTableCell($head) || !isInsideTableCell($anchor) || !$head.parent.isTextblock) return false

  const target = direction === 'end' ? $head.end() : $head.start()
  if (target !== $head.pos) {
    view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, $anchor.pos, target)).scrollIntoView())
  }
  return true
}

export const EditorKeyboardShortcuts = Extension.create({
  name: 'editorKeyboardShortcuts',
  priority: 200,

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-ArrowRight': () => extendSelectionWithinCell(this.editor, 'end'),
      'Mod-Shift-ArrowLeft': () => extendSelectionWithinCell(this.editor, 'start'),

      // When pressing Backspace on an empty paragraph immediately after a list,
      // delete the empty paragraph and place cursor at the end of the list without removing list formatting.
      Backspace: () => {
        const { state, view } = this.editor
        const { selection } = state
        if (!selection.empty) return false

        const { $from } = selection
        if ($from.parent.type.name === 'paragraph' && $from.parent.content.size === 0) {
          const depth = $from.depth
          const parentIndex = $from.index(depth - 1)
          if (parentIndex > 0) {
            const container = $from.node(depth - 1)
            const prevSibling = container.child(parentIndex - 1)
            if (['bulletList', 'orderedList', 'taskList'].includes(prevSibling.type.name)) {
              const paragraphStart = $from.before(depth)
              const paragraphEnd = $from.after(depth)
              const tr = state.tr.delete(paragraphStart, paragraphEnd)
              const safePos = Math.max(1, paragraphStart - 1)
              const $resolved = tr.doc.resolve(Math.min(safePos, tr.doc.content.size))
              const newSelection = Selection.near($resolved, -1)
              tr.setSelection(newSelection)
              view.dispatch(tr)
              return true
            }
          }
        }
        return false
      },

      // Formatting marks
      'Mod-b': () => this.editor.commands.toggleBold(),
      'Mod-B': () => this.editor.commands.toggleBold(),
      'Mod-i': () => this.editor.commands.toggleItalic(),
      'Mod-I': () => this.editor.commands.toggleItalic(),
      'Mod-u': () => this.editor.commands.toggleUnderline(),
      'Mod-U': () => this.editor.commands.toggleUnderline(),
      'Mod-Shift-x': () => this.editor.commands.toggleStrike(),
      'Mod-Shift-X': () => this.editor.commands.toggleStrike(),
      'Mod-Shift-s': () => this.editor.commands.toggleStrike(),
      'Mod-Shift-S': () => this.editor.commands.toggleStrike(),
      'Mod-e': () => this.editor.commands.toggleCode(),
      'Mod-E': () => this.editor.commands.toggleCode(),

      // Headings 1 to 4
      'Mod-Alt-1': () => this.editor.commands.toggleHeading({ level: 1 }),
      'Mod-Alt-2': () => this.editor.commands.toggleHeading({ level: 2 }),
      'Mod-Alt-3': () => this.editor.commands.toggleHeading({ level: 3 }),
      'Mod-Alt-4': () => this.editor.commands.toggleHeading({ level: 4 }),
      'Mod-Shift-1': () => this.editor.commands.toggleHeading({ level: 1 }),
      'Mod-Shift-2': () => this.editor.commands.toggleHeading({ level: 2 }),
      'Mod-Shift-3': () => this.editor.commands.toggleHeading({ level: 3 }),
      'Mod-Shift-4': () => this.editor.commands.toggleHeading({ level: 4 }),

      // Paragraph / Normal text
      'Mod-Alt-0': () => this.editor.commands.setParagraph(),
      'Mod-Shift-0': () => this.editor.commands.setParagraph(),

      // Lists
      'Mod-Shift-7': () => this.editor.commands.toggleOrderedList(),
      'Mod-Shift-8': () => this.editor.commands.toggleBulletList(),
      'Mod-Shift-9': () => this.editor.commands.toggleTaskList(),

      // Blockquote
      'Mod-Shift-b': () => this.editor.commands.toggleBlockquote(),
      'Mod-Shift-B': () => this.editor.commands.toggleBlockquote(),
      'Mod-Alt-5': () => this.editor.commands.toggleBlockquote(),

      // Code Block
      'Mod-Shift-c': () => this.editor.commands.toggleCodeBlock(),
      'Mod-Shift-C': () => this.editor.commands.toggleCodeBlock(),
      'Mod-Alt-c': () => this.editor.commands.toggleCodeBlock(),
      'Mod-Alt-C': () => this.editor.commands.toggleCodeBlock(),

      // Safe undo / redo handlers to prevent RangeError: Position out of range crashes
      'Mod-z': () => {
        try {
          return this.editor.commands.undo()
        } catch (err) {
          console.warn('[Editor] Intercepted invalid undo position error:', err)
          return false
        }
      },
      'Mod-Z': () => {
        try {
          return this.editor.commands.redo()
        } catch (err) {
          console.warn('[Editor] Intercepted invalid redo position error:', err)
          return false
        }
      },
      'Mod-Shift-z': () => {
        try {
          return this.editor.commands.redo()
        } catch (err) {
          console.warn('[Editor] Intercepted invalid redo position error:', err)
          return false
        }
      },
      'Mod-Shift-Z': () => {
        try {
          return this.editor.commands.redo()
        } catch (err) {
          console.warn('[Editor] Intercepted invalid redo position error:', err)
          return false
        }
      },
      'Mod-y': () => {
        try {
          return this.editor.commands.redo()
        } catch (err) {
          console.warn('[Editor] Intercepted invalid redo position error:', err)
          return false
        }
      },
      'Mod-Y': () => {
        try {
          return this.editor.commands.redo()
        } catch (err) {
          console.warn('[Editor] Intercepted invalid redo position error:', err)
          return false
        }
      },

      // Exit inline code formatting when pressing Enter in an empty paragraph (e.g. second Enter)
      Enter: () => {
        const { state } = this.editor
        const { selection } = state
        if (!selection.empty) return false

        // Let list item handlers manage lists
        if (this.editor.isActive('listItem') || this.editor.isActive('taskItem')) {
          return false
        }

        const { $from } = selection
        const codeType = state.schema.marks.code
        if (!codeType) return false

        const hasCodeInStoredMarks = Boolean(state.storedMarks?.some((m) => m.type === codeType))
        const hasCodeInCursorMarks = Boolean($from.marks().some((m) => m.type === codeType))
        const isCodeActive = hasCodeInStoredMarks || hasCodeInCursorMarks || this.editor.isActive('code')

        if (!isCodeActive) return false

        if ($from.parent.type.name === 'paragraph' && $from.parent.content.size === 0) {
          if (this.editor.commands.splitBlock()) {
            this.editor.commands.unsetCode()
            return true
          }
        }

        return false
      },

      // Step out of inline mark (like inline code) at the boundary
      ArrowRight: () => {
        const { state, view } = this.editor
        const { selection } = state
        if (!selection.empty) return collapseSelectionWithinCell(this.editor, 'end')

        const $pos = selection.$from
        const codeType = state.schema.marks.code
        if (!codeType) return false

        const hasCodeBefore = Boolean($pos.nodeBefore?.marks.some((m) => m.type === codeType))
        const hasCodeAfter = Boolean($pos.nodeAfter?.marks.some((m) => m.type === codeType))

        // When cursor is at the trailing edge of inline code
        if (hasCodeBefore && !hasCodeAfter) {
          const storedMarks = (state.storedMarks ?? $pos.marks()).filter((m) => m.type !== codeType)
          const tr = state.tr
          // If at the end of the textblock or nodeAfter has no text, insert a space without code mark so the cursor visibly exits
          if ($pos.pos === $pos.end()) {
            const spaceNode = state.schema.text(' ', [])
            tr.insert($pos.pos, spaceNode)
            tr.setSelection(TextSelection.create(tr.doc, $pos.pos + 1))
            tr.setStoredMarks(storedMarks)
            view.dispatch(tr)
            return true
          }

          // If there is already text after, move selection into the next position and strip code from storedMarks
          tr.setSelection(TextSelection.create(tr.doc, Math.min($pos.pos + 1, tr.doc.content.size)))
          tr.setStoredMarks(storedMarks)
          view.dispatch(tr)
          return true
        }
        return false
      },

      ArrowLeft: () => {
        const { state, view } = this.editor
        const { selection } = state
        if (!selection.empty) return collapseSelectionWithinCell(this.editor, 'start')

        const $pos = selection.$from
        const codeType = state.schema.marks.code
        if (!codeType) return false

        const hasCodeBefore = Boolean($pos.nodeBefore?.marks.some((m) => m.type === codeType))
        const hasCodeAfter = Boolean($pos.nodeAfter?.marks.some((m) => m.type === codeType))

        // When cursor is at the leading edge of inline code (no code before, code after)
        if (!hasCodeBefore && hasCodeAfter) {
          const storedMarks = (state.storedMarks ?? $pos.marks()).filter((m) => m.type !== codeType)
          const tr = state.tr
          if ($pos.pos === $pos.start()) {
            const spaceNode = state.schema.text(' ', [])
            tr.insert($pos.pos, spaceNode)
            tr.setSelection(TextSelection.create(tr.doc, $pos.pos))
            tr.setStoredMarks(storedMarks)
            view.dispatch(tr)
            return true
          }

          tr.setSelection(TextSelection.create(tr.doc, Math.max($pos.pos - 1, 0)))
          tr.setStoredMarks(storedMarks)
          view.dispatch(tr)
          return true
        }
        return false
      },

      // Double space at the trailing edge of inline code exits to plain text
      Space: () => {
        const { state, view } = this.editor
        const { selection } = state
        if (!selection.empty) return false

        const $pos = selection.$from
        const codeType = state.schema.marks.code
        if (!codeType) return false

        // Check if cursor is inside/at the end of inline code
        const hasCodeBefore = Boolean($pos.nodeBefore?.marks.some((m) => m.type === codeType))
        if (!hasCodeBefore) return false

        // If the character immediately before the cursor inside the code block is already a space
        const textBefore = $pos.parent.textBetween(0, $pos.parentOffset, '\n', '\0')
        if (textBefore.endsWith(' ')) {
          const storedMarks = (state.storedMarks ?? $pos.marks()).filter((m) => m.type !== codeType)
          // Delete the trailing space inside the code block and insert an un-marked space outside the code mark
          const spaceNode = state.schema.text(' ', [])
          const tr = state.tr.delete($pos.pos - 1, $pos.pos)
          tr.insert($pos.pos - 1, spaceNode)
          tr.setSelection(TextSelection.create(tr.doc, $pos.pos))
          tr.setStoredMarks(storedMarks)
          view.dispatch(tr)
          return true
        }

        return false
      },

      // Indent (Tab) & Outdent (Shift+Tab)
      Tab: () => {
        if (this.editor.can().sinkListItem('listItem')) {
          return this.editor.commands.sinkListItem('listItem')
        }
        if (this.editor.can().sinkListItem('taskItem')) {
          return this.editor.commands.sinkListItem('taskItem')
        }
        if (this.editor.isActive('table')) {
          return this.editor.commands.goToNextCell()
        }
        if (this.editor.isActive('codeBlock')) {
          return this.editor.commands.insertContent('  ')
        }
        if (this.editor.isActive('listItem') || this.editor.isActive('taskItem')) {
          return true
        }
        return false
      },
      'Shift-Tab': () => {
        if (this.editor.can().liftListItem('listItem')) {
          return this.editor.commands.liftListItem('listItem')
        }
        if (this.editor.can().liftListItem('taskItem')) {
          return this.editor.commands.liftListItem('taskItem')
        }
        if (this.editor.isActive('table')) {
          return this.editor.commands.goToPreviousCell()
        }
        if (this.editor.isActive('listItem') || this.editor.isActive('taskItem')) {
          return true
        }
        return false
      },
    }
  },
})
