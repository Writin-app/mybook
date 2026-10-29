import { Extension } from '@tiptap/core'
import { Fragment, type Node as ProseMirrorNode, type Schema, Slice } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

/**
 * Capitalizes the first Unicode letter in a string, preserving any leading whitespace or symbols.
 */
export function capitalizeFirstLetter(str: string): string {
  if (!str) return str
  return str.replace(/^\P{L}*(\p{L})/u, (match, letter: string) => {
    const prefix = match.slice(0, match.length - letter.length)
    return prefix + letter.toLocaleUpperCase()
  })
}

/**
 * Checks whether a node type is exempt from auto-capitalization (e.g. code or math).
 */
export function isExemptBlockType(typeName: string): boolean {
  return (
    typeName === 'codeBlock' ||
    typeName === 'code_block' ||
    typeName === 'mathBlock' ||
    typeName === 'math_block'
  )
}

/**
 * Returns a new textblock node with its first letter capitalized, if applicable.
 */
export function capitalizeFirstLetterInTextblock(
  node: ProseMirrorNode,
  schema: Schema,
): ProseMirrorNode {
  if (!node.isTextblock || isExemptBlockType(node.type.name)) {
    return node
  }

  let capitalized = false
  const newChildren: ProseMirrorNode[] = []

  node.forEach((child) => {
    if (capitalized || !child.isText || !child.text) {
      newChildren.push(child)
      return
    }

    if (/\p{L}/u.test(child.text)) {
      const newText = capitalizeFirstLetter(child.text)
      if (newText !== child.text) {
        newChildren.push(schema.text(newText, child.marks))
      } else {
        newChildren.push(child)
      }
      capitalized = true
    } else {
      newChildren.push(child)
    }
  })

  if (!capitalized) return node
  return node.copy(Fragment.from(newChildren))
}

function mapFragmentBlocks(
  fragment: Fragment,
  schema: Schema,
  transformFirst: boolean,
  state: { isFirst: boolean },
): Fragment {
  const nodes: ProseMirrorNode[] = []
  fragment.forEach((node) => {
    if (node.isTextblock) {
      const isCurrentFirst = state.isFirst
      state.isFirst = false
      if (isCurrentFirst && !transformFirst) {
        nodes.push(node)
      } else {
        nodes.push(capitalizeFirstLetterInTextblock(node, schema))
      }
    } else if (node.content && node.content.size > 0) {
      const newInnerContent = mapFragmentBlocks(node.content, schema, transformFirst, state)
      nodes.push(node.copy(newInnerContent))
    } else {
      nodes.push(node)
    }
  })
  return Fragment.from(nodes)
}

interface OverrideState {
  pos: number
  originalChar: string
}

interface CapitalizePluginState {
  override: OverrideState | null
}

export const blockAutoCapitalizePluginKey = new PluginKey<CapitalizePluginState>('blockAutoCapitalize')

export const BlockAutoCapitalize = Extension.create({
  name: 'blockAutoCapitalize',

  addProseMirrorPlugins() {
    return [
      new Plugin<CapitalizePluginState>({
        key: blockAutoCapitalizePluginKey,

        state: {
          init: () => ({ override: null }),
          apply: (tr, prev) => {
            const meta = tr.getMeta(blockAutoCapitalizePluginKey)
            if (meta !== undefined) {
              return { override: meta }
            }
            if (tr.docChanged && prev.override) {
              // If the user deleted characters at/near the override pos (e.g. backspace), preserve override
              if (tr.selection.from === prev.override.pos) {
                return prev
              }
              return { override: null }
            }
            return prev
          },
        },

        props: {
          handleKeyDown(view: EditorView, event: KeyboardEvent) {
            if (event.key === 'Backspace') {
              // Allow backspace to delete the capitalized char and preserve the override at that position
              return false
            }
            if (event.key !== 'Shift' && event.key !== 'Alt' && event.key !== 'Meta' && event.key !== 'Control') {
              const current = blockAutoCapitalizePluginKey.getState(view.state)
              if (current?.override) {
                view.dispatch(view.state.tr.setMeta(blockAutoCapitalizePluginKey, null))
              }
            }
            return false
          },

          handleTextInput(view: EditorView, from: number, to: number, text: string) {
            if (!text || !/\p{L}/u.test(text)) {
              return false
            }

            const { state } = view
            const $from = state.doc.resolve(from)
            const parent = $from.parent

            if (!parent.isTextblock || isExemptBlockType(parent.type.name)) {
              return false
            }

            // Check if any letter exists before this insertion in the current block
            const textBefore = parent.textContent.slice(0, $from.parentOffset)
            if (/\p{L}/u.test(textBefore)) {
              return false
            }

            // Check if user previously backspaced this exact capitalization to type lowercase
            const pluginState = blockAutoCapitalizePluginKey.getState(state)
            if (pluginState?.override && pluginState.override.pos === from && pluginState.override.originalChar === text) {
              view.dispatch(state.tr.setMeta(blockAutoCapitalizePluginKey, null))
              return false
            }

            const capitalized = capitalizeFirstLetter(text)
            if (capitalized === text) {
              return false
            }

            const tr = state.tr.insertText(capitalized, from, to)
            tr.setMeta(blockAutoCapitalizePluginKey, { pos: from, originalChar: text })
            view.dispatch(tr)
            return true
          },

          transformPasted(slice: Slice, view: EditorView): Slice {
            const { state } = view
            const $from = state.selection.$from
            const hasLetterBefore =
              $from.parent.isTextblock && /\p{L}/u.test($from.parent.textContent.slice(0, $from.parentOffset))

            const walkerState = { isFirst: true }
            const newContent = mapFragmentBlocks(slice.content, state.schema, !hasLetterBefore, walkerState)
            return new Slice(newContent, slice.openStart, slice.openEnd)
          },
        },
      }),
    ]
  },
})
