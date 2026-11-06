import type { Editor } from '@tiptap/react'
import { useEffect, useState } from 'react'
import { getDocumentTextCounts } from './documentTextCountUtils'

export function DocumentTextCounts({ editor }: { editor: Editor }) {
  const [text, setText] = useState(() => editor.getText({ blockSeparator: '\n' }))

  useEffect(() => {
    const update = () => setText(editor.getText({ blockSeparator: '\n' }))
    editor.on('transaction', update)
    editor.on('update', update)
    return () => {
      editor.off('transaction', update)
      editor.off('update', update)
    }
  }, [editor])

  const { words, characters } = getDocumentTextCounts(text)

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Document word and character count"
      className="pointer-events-none fixed right-3 z-30 rounded-full border border-[var(--app-border)] bg-[var(--app-surface)]/95 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur md:!bottom-4 md:right-4 md:z-40 md:text-sm"
      style={{ bottom: 'calc(var(--mybook-keyboard-offset, 0px) + 5.5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      {words} {words === 1 ? 'word' : 'words'} · {characters} {characters === 1 ? 'character' : 'characters'}
    </div>
  )
}
