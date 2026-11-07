import { describe, expect, it, vi } from 'vitest'
import { computeCaretScrollAdjustment } from './mobileCaretScroll'

describe('computeCaretScrollAdjustment', () => {
  const createMockEditor = (overrides?: {
    isFocused?: boolean
    isDestroyed?: boolean
    selectionEmpty?: boolean
    composing?: boolean
    coords?: { bottom: number } | null
  }) => {
    const isFocused = overrides?.isFocused ?? true
    const isDestroyed = overrides?.isDestroyed ?? false
    const selectionEmpty = overrides?.selectionEmpty ?? true
    const composing = overrides?.composing ?? false
    const coords = overrides?.coords !== undefined ? overrides.coords : { bottom: 300 }

    return {
      isFocused,
      isDestroyed,
      state: {
        selection: {
          empty: selectionEmpty,
          to: 10,
        },
      },
      view: {
        composing,
        coordsAtPos: vi.fn().mockImplementation(() => coords),
      },
    } as never
  }

  it('returns 0 when editor is not focused', () => {
    const editor = createMockEditor({ isFocused: false })
    const result = computeCaretScrollAdjustment({ editor })
    expect(result).toBe(0)
  })

  it('returns 0 when editor is destroyed', () => {
    const editor = createMockEditor({ isDestroyed: true })
    const result = computeCaretScrollAdjustment({ editor })
    expect(result).toBe(0)
  })

  it('returns 0 when text selection is a range (e.g. double-tap or text selection) to prevent Android selection handle flashing', () => {
    const editor = createMockEditor({
      selectionEmpty: false,
      coords: { bottom: 600 },
    })
    const result = computeCaretScrollAdjustment({
      editor,
      viewportBounds: {
        width: 400,
        height: 500,
        offsetLeft: 0,
        offsetTop: 0,
        keyboardOffset: 300,
        visibleBottom: 500,
      },
    })
    expect(result).toBe(0)
  })

  it('returns 0 when view is composing to prevent IME key-hold and composition from dropping and flashing', () => {
    const editor = createMockEditor({
      composing: true,
      coords: { bottom: 600 },
    })
    const result = computeCaretScrollAdjustment({
      editor,
      viewportBounds: {
        width: 400,
        height: 500,
        offsetLeft: 0,
        offsetTop: 0,
        keyboardOffset: 300,
        visibleBottom: 500,
      },
    })
    expect(result).toBe(0)
  })

  it('returns 0 when caret is safely above the mobile toolbar danger zone', () => {
    const editor = createMockEditor({
      coords: { bottom: 250 },
    })
    const result = computeCaretScrollAdjustment({
      editor,
      viewportBounds: {
        width: 400,
        height: 500,
        offsetLeft: 0,
        offsetTop: 0,
        keyboardOffset: 300,
        visibleBottom: 500,
      },
    })
    expect(result).toBe(0)
  })

  it('calculates positive overlap when caret reaches behind the toolbar element', () => {
    const editor = createMockEditor({
      coords: { bottom: 460 },
    })
    const mockToolbar = {
      getBoundingClientRect: () => ({ top: 450, height: 44 }),
    } as HTMLElement

    // toolbarTop = 450, dangerZoneTop = 450 - 16 = 434
    // overlap = 460 - 434 = 26
    const result = computeCaretScrollAdjustment({
      editor,
      toolbarElement: mockToolbar,
      dangerZonePadding: 16,
    })
    expect(result).toBe(26)
  })

  it('falls back to viewportBounds.visibleBottom - 44 when toolbar element is absent or hidden', () => {
    const editor = createMockEditor({
      coords: { bottom: 480 },
    })

    // visibleBottom = 500, toolbarTop = 500 - 44 = 456
    // dangerZoneTop = 456 - 16 = 440
    // overlap = 480 - 440 = 40
    const result = computeCaretScrollAdjustment({
      editor,
      toolbarElement: null,
      viewportBounds: {
        width: 400,
        height: 500,
        offsetLeft: 0,
        offsetTop: 0,
        keyboardOffset: 300,
        visibleBottom: 500,
      },
      dangerZonePadding: 16,
    })
    expect(result).toBe(40)
  })

  it('does NOT subtract keyboardOffset twice (which would create false danger zone near top)', () => {
    const editor = createMockEditor({
      coords: { bottom: 120 }, // Normal line near top-middle
    })

    // If keyboardOffset was subtracted from bounds.height:
    // visibleBottom would be 500 - 300 = 200, dangerZoneTop = 200 - 44 - 16 = 140,
    // which would trigger a false scroll!
    // With correct logic: visibleBottom = 500, toolbarTop = 456, dangerZoneTop = 440
    const result = computeCaretScrollAdjustment({
      editor,
      viewportBounds: {
        width: 400,
        height: 500,
        offsetLeft: 0,
        offsetTop: 0,
        keyboardOffset: 300,
        visibleBottom: 500,
      },
    })
    expect(result).toBe(0)
  })

  it('handles coordsAtPos throwing gracefully and returns 0', () => {
    const editor = {
      isFocused: true,
      isDestroyed: false,
      state: { selection: { empty: true, to: 5 } },
      view: {
        composing: false,
        coordsAtPos: () => {
          throw new Error('Position out of range')
        },
      },
    } as never

    const result = computeCaretScrollAdjustment({ editor })
    expect(result).toBe(0)
  })
})
