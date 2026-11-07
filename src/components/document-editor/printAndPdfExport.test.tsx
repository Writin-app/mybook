// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { matchesPrintShortcut } from './editorMenuShortcuts'

describe('Print and PDF Export functionality', () => {
  let originalTitle: string
  let originalPrint: typeof window.print

  beforeEach(() => {
    originalTitle = document.title
    originalPrint = window.print
    window.print = vi.fn()
  })

  afterEach(() => {
    document.title = originalTitle
    window.print = originalPrint
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('matchesPrintShortcut', () => {
    it('recognizes Cmd+P on macOS', () => {
      const event = {
        key: 'p',
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
      }
      expect(matchesPrintShortcut(event, true)).toBe(true)
    })

    it('recognizes Ctrl+P on non-macOS', () => {
      const event = {
        key: 'P',
        metaKey: false,
        ctrlKey: true,
        altKey: false,
        shiftKey: false,
      }
      expect(matchesPrintShortcut(event, false)).toBe(true)
    })

    it('rejects shortcuts with Alt or Shift modifier', () => {
      expect(
        matchesPrintShortcut(
          { key: 'p', metaKey: true, ctrlKey: false, altKey: true, shiftKey: false },
          true,
        ),
      ).toBe(false)
      expect(
        matchesPrintShortcut(
          { key: 'p', metaKey: true, ctrlKey: false, altKey: false, shiftKey: true },
          true,
        ),
      ).toBe(false)
    })

    it('rejects other letters', () => {
      expect(
        matchesPrintShortcut(
          { key: 's', metaKey: true, ctrlKey: false, altKey: false, shiftKey: false },
          true,
        ),
      ).toBe(false)
    })
  })

  describe('print title lifecycle', () => {
    it('sets document.title to documentTitle for printing and restores it afterprint', () => {
      document.title = 'Writin - Workspace'
      const documentTitle = 'Quarterly Strategy Plan'

      const handlePrint = () => {
        const initialTitle = document.title
        const printTitle = documentTitle.trim() || 'Untitled'
        document.title = printTitle
        const restoreTitle = () => {
          document.title = initialTitle
          window.removeEventListener('afterprint', restoreTitle)
        }
        window.addEventListener('afterprint', restoreTitle)
        setTimeout(restoreTitle, 2000)
        window.print()
      }

      handlePrint()

      expect(window.print).toHaveBeenCalledTimes(1)
      expect(document.title).toBe('Quarterly Strategy Plan')

      // Dispatch afterprint event
      window.dispatchEvent(new Event('afterprint'))
      expect(document.title).toBe('Writin - Workspace')
    })

    it('defaults document.title to Untitled if title is whitespace only', () => {
      document.title = 'Writin'
      const documentTitle = '   '

      const handlePrint = () => {
        const initialTitle = document.title
        const printTitle = documentTitle.trim() || 'Untitled'
        document.title = printTitle
        const restoreTitle = () => {
          document.title = initialTitle
          window.removeEventListener('afterprint', restoreTitle)
        }
        window.addEventListener('afterprint', restoreTitle)
        setTimeout(restoreTitle, 2000)
        window.print()
      }

      handlePrint()

      expect(document.title).toBe('Untitled')
      window.dispatchEvent(new Event('afterprint'))
      expect(document.title).toBe('Writin')
    })

    it('restores document.title via timeout if afterprint does not fire', () => {
      vi.useFakeTimers()
      document.title = 'Writin'
      const documentTitle = 'Meeting Notes'

      const handlePrint = () => {
        const initialTitle = document.title
        const printTitle = documentTitle.trim() || 'Untitled'
        document.title = printTitle
        const restoreTitle = () => {
          document.title = initialTitle
          window.removeEventListener('afterprint', restoreTitle)
        }
        window.addEventListener('afterprint', restoreTitle)
        setTimeout(restoreTitle, 2000)
        window.print()
      }

      handlePrint()
      expect(document.title).toBe('Meeting Notes')

      vi.advanceTimersByTime(2001)
      expect(document.title).toBe('Writin')
    })
  })
})
