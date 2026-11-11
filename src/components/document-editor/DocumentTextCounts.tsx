import type { Editor } from '@tiptap/react'
import { useEffect, useState } from 'react'
import { getDocumentTextCounts } from './documentTextCountUtils'

export function DocumentTextCounts({
  editor,
  className = 'px-2 pb-1.5 text-xs text-muted-foreground',
}: {
  editor: Editor
  className?: string
}) {
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
      className={className}
    >
      <span>
        {words} {words === 1 ? 'word' : 'words'} · {characters} {characters === 1 ? 'character' : 'characters'}
      </span>
    </div>
  )
}
