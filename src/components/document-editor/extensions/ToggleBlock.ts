import { mergeAttributes, Node } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'

export function getTogglePlaceholder(level: number | null | undefined): string {
  if (level === 1) return 'Heading 1'
  if (level === 2) return 'Heading 2'
  if (level === 3) return 'Heading 3'
  if (level === 4) return 'Heading 4'
  return 'Toggle'
}

export const ToggleBlock = Node.create({
  name: 'toggleBlock',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      title: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-title') || element.querySelector('.mybook-toggle-title')?.textContent || '',
        renderHTML: (attributes) => ({ 'data-title': String(attributes.title || '') }),
      },
      open: {
        default: true,
        parseHTML: (element) => element.hasAttribute('open'),
        renderHTML: (attributes) => (attributes.open ? { open: '' } : {}),
      },
      level: {
        default: null,
        parseHTML: (element) => {
          const raw = element.getAttribute('data-level')
          if (!raw) return null
          const parsed = Number(raw)
          return (parsed === 1 || parsed === 2 || parsed === 3 || parsed === 4) ? (parsed as 1 | 2 | 3 | 4) : null
        },
        renderHTML: (attributes) => {
          const level = attributes.level
          return (level === 1 || level === 2 || level === 3 || level === 4) ? { 'data-level': String(level) } : {}
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'details[data-type="toggle"]' }]
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'details',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'toggle',
        class: 'mybook-toggle',
      }),
      ['summary', { class: 'mybook-toggle-summary' }, String(node.attrs.title || 'Toggle')],
      ['div', { class: 'mybook-toggle-content' }, 0],
    ]
  },

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { state } = this.editor
        const { selection } = state
        if (!selection.empty) return false

        const { $from } = selection
        for (let depth = $from.depth; depth > 0; depth -= 1) {
          const parentNode = $from.node(depth)
          if (parentNode.type.name === 'toggleBlock') {
            const currentBlock = $from.parent
            if (currentBlock.isTextblock && currentBlock.content.size === 0) {
              const togglePos = $from.before(depth)
              const insertPos = togglePos + parentNode.nodeSize

              if (parentNode.childCount === 1) {
                return this.editor
                  .chain()
                  .insertContentAt(insertPos, { type: 'paragraph' })
                  .setTextSelection(insertPos + 1)
                  .scrollIntoView()
                  .run()
              }

              // Empty child (last or in the middle): remove it and exit below the toggle
              const blockStart = $from.before()
              const blockEnd = $from.after()
              return this.editor
                .chain()
                .deleteRange({ from: blockStart, to: blockEnd })
                .insertContentAt(insertPos - (blockEnd - blockStart), { type: 'paragraph' })
                .setTextSelection(insertPos - (blockEnd - blockStart) + 1)
                .scrollIntoView()
                .run()
            }
          }
        }
        return false
      },
    }
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const details = document.createElement('details')
      details.className = 'mybook-toggle'
      details.dataset.type = 'toggle'
      if (node.attrs.open !== false) details.open = true
      if (node.attrs.level) details.dataset.level = String(node.attrs.level)

      const summary = document.createElement('summary')
      summary.className = 'mybook-toggle-summary'

      const caret = document.createElement('button')
      caret.type = 'button'
      caret.className = 'mybook-toggle-caret'
      caret.setAttribute('aria-label', 'Toggle expanded state')

      const title = document.createElement('input')
      title.className = 'mybook-toggle-title'
      title.type = 'text'
      title.value = String(node.attrs.title || '')
      title.placeholder = getTogglePlaceholder(node.attrs.level)
      title.setAttribute('aria-label', node.attrs.level ? `Toggle heading ${node.attrs.level} title` : 'Toggle title')

      const content = document.createElement('div')
      content.className = 'mybook-toggle-content'

      summary.append(caret, title)
      details.append(summary, content)

      const updateAttributes = (attrs: Record<string, unknown>) => {
        if (typeof getPos !== 'function') return
        const pos = getPos()
        if (typeof pos !== 'number') return
        const currentNode = editor.view.state.doc.nodeAt(pos)
        if (!currentNode) return
        editor.view.dispatch(editor.view.state.tr.setNodeMarkup(pos, undefined, { ...currentNode.attrs, ...attrs }))
      }

      const updateCaret = () => {
        caret.textContent = details.open ? '▾' : '▸'
        caret.setAttribute('aria-expanded', String(details.open))
      }
      const handleInput = () => {
        const match = /^(#{1,4})\s(.*)$/u.exec(title.value)
        if (match) {
          const hashes = match[1] ?? ''
          const newLevel = hashes.length as 1 | 2 | 3 | 4
          const restText = match[2] ?? ''
          title.value = restText
          updateAttributes({ level: newLevel, title: restText })
          details.dataset.level = String(newLevel)
          title.placeholder = getTogglePlaceholder(newLevel)
          title.setAttribute('aria-label', `Toggle heading ${newLevel} title`)
          return
        }
        updateAttributes({ title: title.value })
      }
      const handleTitleKeyDown = (event: KeyboardEvent) => {
        event.stopPropagation()
        if (event.key === 'Tab' && !event.shiftKey) {
          event.preventDefault()
          if (details.open && typeof getPos === 'function') {
            const position = getPos()
            if (typeof position === 'number') {
              const bodyPosition = Math.min(position + 1, editor.view.state.doc.content.size)
              editor.view.dispatch(editor.view.state.tr.setSelection(TextSelection.near(editor.view.state.doc.resolve(bodyPosition))))
              editor.view.focus()
            }
          }
          return
        }

        const isMod = event.metaKey || event.ctrlKey
        if (isMod && (event.altKey || event.shiftKey)) {
          if (event.key === '0' || event.code === 'Digit0') {
            event.preventDefault()
            updateAttributes({ level: null })
            delete details.dataset.level
            title.placeholder = getTogglePlaceholder(null)
            title.setAttribute('aria-label', 'Toggle title')
            return
          }
          if (['1', '2', '3', '4'].includes(event.key) || ['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(event.code)) {
            event.preventDefault()
            const digit = Number(event.key || event.code.replace('Digit', '')) as 1 | 2 | 3 | 4
            updateAttributes({ level: digit })
            details.dataset.level = String(digit)
            title.placeholder = getTogglePlaceholder(digit)
            title.setAttribute('aria-label', `Toggle heading ${digit} title`)
            return
          }
        }

        const pos = typeof getPos === 'function' ? getPos() : null
        const currentNode = typeof pos === 'number' ? editor.view.state.doc.nodeAt(pos) : node
        if (event.key === 'Backspace' && title.selectionStart === 0 && title.selectionEnd === 0 && !title.value && currentNode?.attrs.level) {
          event.preventDefault()
          updateAttributes({ level: null })
          delete details.dataset.level
          title.placeholder = getTogglePlaceholder(null)
          title.setAttribute('aria-label', 'Toggle title')
          return
        }

        if (event.key !== 'Enter') return
        event.preventDefault()
        if (typeof getPos !== 'function') return
        const position = getPos()
        if (typeof position !== 'number') return
        const targetNode = editor.view.state.doc.nodeAt(position)
        if (!targetNode) return
        if (details.open) {
          const bodyPosition = Math.min(position + 1, editor.view.state.doc.content.size)
          editor.view.dispatch(editor.view.state.tr.setSelection(TextSelection.near(editor.view.state.doc.resolve(bodyPosition))))
          editor.view.focus()
          return
        }
        const insertPosition = position + targetNode.nodeSize
        const paragraph = editor.schema.nodes.paragraph
        if (!paragraph) return
        editor.view.dispatch(editor.view.state.tr.insert(insertPosition, paragraph.create()))
        editor.view.dispatch(editor.view.state.tr.setSelection(TextSelection.near(editor.view.state.doc.resolve(insertPosition + 1))))
        editor.view.focus()
      }
      const handleCaretClick = (event: MouseEvent) => {
        event.preventDefault()
        event.stopPropagation()
        details.open = !details.open
        updateAttributes({ open: details.open })
        updateCaret()
      }
      const handleSummaryClick = (event: MouseEvent) => {
        if (event.target === summary) event.preventDefault()
      }

      title.addEventListener('input', handleInput)
      title.addEventListener('keydown', handleTitleKeyDown)
      caret.addEventListener('click', handleCaretClick)
      summary.addEventListener('click', handleSummaryClick)
      updateCaret()
      if (!node.attrs.title && typeof getPos === 'function') {
        window.requestAnimationFrame(() => {
          const position = getPos()
          if (typeof position !== 'number') return
          const selection = editor.state.selection
          if (selection.from >= position && selection.to <= position + node.nodeSize) {
            title.focus()
            title.setSelectionRange(0, 0)
          }
        })
      }

      return {
        dom: details,
        contentDOM: content,
        update: (nextNode) => {
          if (nextNode.type.name !== 'toggleBlock') return false
          if (title.value !== nextNode.attrs.title) title.value = String(nextNode.attrs.title || '')
          if (details.open !== nextNode.attrs.open) details.open = nextNode.attrs.open !== false
          if (nextNode.attrs.level) {
            details.dataset.level = String(nextNode.attrs.level)
          } else {
            delete details.dataset.level
          }
          const currentLevel = nextNode.attrs.level as 1 | 2 | 3 | 4 | null | undefined
          title.placeholder = getTogglePlaceholder(currentLevel)
          title.setAttribute('aria-label', currentLevel ? `Toggle heading ${currentLevel} title` : 'Toggle title')
          updateCaret()
          return true
        },
        destroy: () => {
          title.removeEventListener('input', handleInput)
          title.removeEventListener('keydown', handleTitleKeyDown)
          caret.removeEventListener('click', handleCaretClick)
          summary.removeEventListener('click', handleSummaryClick)
        },
      }
    }
  },
})

export function toggleBlockNode(title = 'Toggle', level: 1 | 2 | 3 | 4 | null = null) {
  return {
    type: 'toggleBlock',
    attrs: { title: title === 'Toggle' ? '' : title, open: true, level: level ?? null },
    content: [{ type: 'paragraph' }],
  }
}
