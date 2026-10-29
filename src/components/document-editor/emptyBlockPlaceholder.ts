import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export const emptyBlockPlaceholderClass = 'mybook-empty-block-placeholder'
export const quoteEmptyPlaceholderClass = 'mybook-quote-empty-placeholder'

export interface EmptyBlockPlaceholderState {
  focused: boolean
  pickerActive?: boolean
  pickerType?: 'image' | 'video' | 'audio' | 'file' | 'document-link' | null
}

export const emptyBlockPlaceholderKey = new PluginKey<EmptyBlockPlaceholderState>('emptyBlockPlaceholder')

export const pickerPlaceholderMap: Record<string, string> = {
  image: 'Add an image',
  video: 'Add a video',
  audio: 'Add an audio',
  file: 'Add a file',
  'document-link': 'Enter page name',
}

export const EmptyBlockPlaceholder = Extension.create({
  name: 'emptyBlockPlaceholder',
  addProseMirrorPlugins() {
    return [new Plugin({
      key: emptyBlockPlaceholderKey,
      state: {
        init: () => ({ focused: false, pickerActive: false, pickerType: null }),
        apply(transaction, value) {
          const meta = transaction.getMeta(emptyBlockPlaceholderKey)
          if (!meta) return value
          return {
            focused: meta.focused !== undefined ? meta.focused : value.focused,
            pickerActive: meta.pickerActive !== undefined ? meta.pickerActive : value.pickerActive,
            pickerType: meta.pickerType !== undefined ? meta.pickerType : value.pickerType,
          }
        },
      },
      props: {
        decorations(state) {
          const decorations: Decoration[] = []
          const pluginState = emptyBlockPlaceholderKey.getState(state)
          const isEditorFocused = pluginState?.focused === true || pluginState?.pickerActive === true
          const activeTextblockPos = isEditorFocused && state.selection.empty && state.selection.$from.parent.isTextblock && state.selection.$from.parent.content.size === 0
            ? state.selection.$from.before(state.selection.$from.depth)
            : null

          state.doc.descendants((node, pos, parent) => {
            if (!node.isTextblock || node.content.size !== 0) return
            if (parent?.type.name === 'tableCell' || parent?.type.name === 'tableHeader') return
            if (parent?.type.name === 'blockquote') {
              decorations.push(Decoration.node(pos, pos + node.nodeSize, {
                class: quoteEmptyPlaceholderClass,
                'data-placeholder': 'Quote',
              }))
              return
            }
            if (parent?.type.name === 'taskItem') {
              decorations.push(Decoration.node(pos, pos + node.nodeSize, {
                class: emptyBlockPlaceholderClass,
              }))
              return
            }
            if (parent?.type.name === 'column') {
              const isFocusedInThisBlock = pos === activeTextblockPos
              if (!isFocusedInThisBlock) {
                // Determine column index (1-based)
                // pos is inside parent (column), which is inside grandparent (columns)
                const $pos = state.doc.resolve(pos)
                let colIndex = 1
                for (let d = $pos.depth; d > 0; d -= 1) {
                  if ($pos.node(d).type.name === 'column') {
                    const colNodePos = $pos.before(d)
                    const $colPos = state.doc.resolve(colNodePos)
                    if ($colPos.parent.type.name === 'columns') {
                      colIndex = $colPos.index() + 1
                    }
                    break
                  }
                }
                decorations.push(Decoration.node(pos, pos + node.nodeSize, {
                  class: `${emptyBlockPlaceholderClass} mybook-column-placeholder`,
                  'data-placeholder': `Column ${colIndex}`,
                }))
                return
              }
              // If focused in this block, allow the normal emptyBlockPlaceholder decoration below
              return
            }
            if (node.type.name === 'heading' || (node.type.name !== 'paragraph' && pos === activeTextblockPos)) {
              const isHeading = node.type.name === 'heading'
              decorations.push(Decoration.node(pos, pos + node.nodeSize, {
                class: isHeading ? `${emptyBlockPlaceholderClass} mybook-heading-placeholder` : emptyBlockPlaceholderClass,
                ...(isHeading ? { 'data-placeholder': `Heading ${node.attrs.level}` } : {}),
              }))
            }
          })

          if (isEditorFocused && state.selection.empty) {
            const { $from } = state.selection
            const grandparent = $from.depth > 1 ? $from.node($from.depth - 1) : null
            if ($from.parent.type.name === 'paragraph' && $from.parent.content.size === 0 && !['tableCell', 'tableHeader'].includes(grandparent?.type.name ?? '')) {
              const pos = $from.before($from.depth)
              const pickerPlaceholder = pluginState?.pickerActive && pluginState.pickerType
                ? pickerPlaceholderMap[pluginState.pickerType]
                : null

              if (pickerPlaceholder) {
                decorations.push(Decoration.node(pos, $from.after($from.depth), {
                  class: `${emptyBlockPlaceholderClass} mybook-picker-placeholder`,
                  'data-placeholder': pickerPlaceholder,
                }))
              } else {
                decorations.push(Decoration.node(pos, $from.after($from.depth), { class: emptyBlockPlaceholderClass }))
              }
            }
          }
          return DecorationSet.create(state.doc, decorations)
        },
        handleDOMEvents: {
          focus(view) {
            view.dispatch(view.state.tr.setMeta(emptyBlockPlaceholderKey, { focused: true }))
            return false
          },
          blur(view) {
            view.dispatch(view.state.tr.setMeta(emptyBlockPlaceholderKey, { focused: false }))
            return false
          },
        },
      },
    })]
  },
})
