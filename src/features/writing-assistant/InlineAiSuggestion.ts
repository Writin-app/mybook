import { Extension } from '@tiptap/core'
import type { Editor } from '@tiptap/react'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { Plugin, PluginKey } from '@tiptap/pm/state'

interface InlineAiSuggestionData {
  from: number
  to: number
  sourceText: string
  proposedText: string
  isLoading?: boolean
}

interface DiffPart {
  type: 'same' | 'removed' | 'added'
  text: string
}

const suggestionKey = new PluginKey<InlineAiSuggestionData | null>('inlineAiSuggestion')
function tokenize(text: string) {
  return text.match(/\s+|[^\s]+/gu) ?? []
}

export function buildInlineTextDiff(sourceText: string, proposedText: string): DiffPart[] {
  const source = tokenize(sourceText)
  const proposed = tokenize(proposedText)
  let prefix = 0
  while (prefix < source.length && prefix < proposed.length && source[prefix] === proposed[prefix]) prefix += 1

  let suffix = 0
  while (
    suffix < source.length - prefix &&
    suffix < proposed.length - prefix &&
    source[source.length - suffix - 1] === proposed[proposed.length - suffix - 1]
  ) suffix += 1

  const parts: DiffPart[] = [
    { type: 'same', text: source.slice(0, prefix).join('') },
    { type: 'removed', text: source.slice(prefix, source.length - suffix).join('') },
    { type: 'added', text: proposed.slice(prefix, proposed.length - suffix).join('') },
    { type: 'same', text: suffix ? source.slice(source.length - suffix).join('') : '' },
  ]
  return parts.filter((part) => part.text)
}

function createSuggestionDecorations(doc: Editor['state']['doc'], suggestion: InlineAiSuggestionData) {
  if (doc.textBetween(suggestion.from, suggestion.to, '\n') !== suggestion.sourceText) return DecorationSet.empty

  if (suggestion.isLoading) {
    return DecorationSet.create(doc, [
      Decoration.inline(suggestion.from, suggestion.to, { class: 'mybook-ai-suggestion-loading', 'aria-label': 'AI is working on selected text' }),
    ])
  }

  if (doc.resolve(suggestion.from).parent !== doc.resolve(suggestion.to).parent) {
    const replacement = document.createElement('span')
    replacement.className = 'mybook-ai-suggestion-added'
    replacement.setAttribute('contenteditable', 'false')
    replacement.setAttribute('aria-label', `AI suggested: ${suggestion.proposedText}`)
    replacement.textContent = suggestion.proposedText
    return DecorationSet.create(doc, [
      Decoration.widget(suggestion.from, () => replacement, { key: 'ai-suggestion-multiblock', side: -1 }),
      Decoration.inline(suggestion.from, suggestion.to, { class: 'mybook-ai-suggestion-removed' }),
    ])
  }

  const decorations: Decoration[] = []
  let position = suggestion.from
  let insertionIndex = 0
  for (const part of buildInlineTextDiff(suggestion.sourceText, suggestion.proposedText)) {
    if (part.type === 'same') {
      position += part.text.length
    } else if (part.type === 'removed') {
      const end = position + part.text.length
      if (end > position) decorations.push(Decoration.inline(position, end, { class: 'mybook-ai-suggestion-removed' }))
      position = end
    } else {
      const insertionText = part.text
      decorations.push(Decoration.widget(position, () => {
        const added = document.createElement('span')
        added.className = 'mybook-ai-suggestion-added'
        added.setAttribute('contenteditable', 'false')
        added.setAttribute('aria-label', `AI suggested: ${insertionText}`)
        added.textContent = insertionText
        return added
      }, { key: `ai-suggestion-${insertionIndex++}`, side: -1 }))
    }
  }
  return DecorationSet.create(doc, decorations)
}

export const InlineAiSuggestion = Extension.create({
  name: 'inlineAiSuggestion',

  addProseMirrorPlugins() {
    return [new Plugin<InlineAiSuggestionData | null>({
      key: suggestionKey,
      state: {
        init: () => null,
        apply(transaction, current) {
          const update = transaction.getMeta(suggestionKey) as { type: 'set'; suggestion: InlineAiSuggestionData } | { type: 'clear' } | undefined
          if (update?.type === 'clear') return null
          if (update?.type === 'set') return update.suggestion
          return transaction.docChanged ? null : current
        },
      },
      props: {
        decorations(state) {
          const suggestion = suggestionKey.getState(state)
          return suggestion ? createSuggestionDecorations(state.doc, suggestion) : null
        },
      },
    })]
  },
})

export function setInlineAiSuggestion(editor: Editor, suggestion: InlineAiSuggestionData) {
  if (suggestionKey.getState(editor.state) === undefined) return
  editor.view.dispatch(editor.state.tr.setMeta(suggestionKey, { type: 'set', suggestion }))
}

export function clearInlineAiSuggestion(editor: Editor) {
  if (!suggestionKey.getState(editor.state)) return
  editor.view.dispatch(editor.state.tr.setMeta(suggestionKey, { type: 'clear' }))
}
