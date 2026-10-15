import { describe, expect, it } from 'vitest'

import { matchesEditorMenuShortcut } from './editorMenuShortcuts'

describe('editor menu shortcuts', () => {
  it('matches the move shortcut by physical key instead of the layout-dependent key value', () => {
    const event = { code: 'KeyM', metaKey: true, ctrlKey: true, altKey: false, shiftKey: false }

    expect(matchesEditorMenuShortcut(event, 'm', true)).toBe(true)
  })

  it('rejects a move shortcut without its required modifiers', () => {
    const event = { code: 'KeyM', metaKey: false, ctrlKey: true, altKey: true, shiftKey: false }

    expect(matchesEditorMenuShortcut(event, 'm', false)).toBe(false)
  })

  it('matches the Windows Ctrl+Alt+M chord', () => {
    const event = { code: 'KeyM', metaKey: false, ctrlKey: true, altKey: true, shiftKey: false }

    expect(matchesEditorMenuShortcut(event, 'm', false)).toBe(true)
  })
})
