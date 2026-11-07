import { describe, expect, it } from 'vitest'

import { matchesEditorMenuShortcut, matchesPrintShortcut } from './editorMenuShortcuts'

const base = { code: 'KeyM', metaKey: false, ctrlKey: false, altKey: false, shiftKey: true }
const printBase = { key: 'p', metaKey: false, ctrlKey: false, altKey: false, shiftKey: false }

describe('editor menu shortcuts', () => {
  it('matches Cmd+Shift on Mac by physical key', () => {
    expect(matchesEditorMenuShortcut({ ...base, metaKey: true }, 'm', true)).toBe(true)
    expect(matchesEditorMenuShortcut({ ...base, code: 'KeyD', metaKey: true }, 'd', true)).toBe(true)
  })

  it('matches Ctrl+Shift on other platforms', () => {
    expect(matchesEditorMenuShortcut({ ...base, ctrlKey: true }, 'm', false)).toBe(true)
  })

  it('rejects missing Shift, extra Alt, or the wrong Mod key', () => {
    expect(matchesEditorMenuShortcut({ ...base, metaKey: true, shiftKey: false }, 'm', true)).toBe(false)
    expect(matchesEditorMenuShortcut({ ...base, ctrlKey: true, altKey: true }, 'm', false)).toBe(false)
    expect(matchesEditorMenuShortcut({ ...base, ctrlKey: true }, 'm', true)).toBe(false)
  })

  it('matches Cmd+P on Mac and Ctrl+P on other platforms for print', () => {
    expect(matchesPrintShortcut({ ...printBase, metaKey: true }, true)).toBe(true)
    expect(matchesPrintShortcut({ ...printBase, ctrlKey: true }, false)).toBe(true)
    expect(matchesPrintShortcut({ ...printBase, metaKey: true, shiftKey: true }, true)).toBe(false)
    expect(matchesPrintShortcut({ ...printBase, metaKey: true, altKey: true }, true)).toBe(false)
    expect(matchesPrintShortcut({ ...printBase, ctrlKey: true }, true)).toBe(false)
    expect(matchesPrintShortcut({ ...printBase, key: 's', metaKey: true }, true)).toBe(false)
  })
})
