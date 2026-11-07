import type { Editor } from '@tiptap/react'
import { getVisualViewportBounds, type VisualViewportBounds } from '../../hooks/useVisualViewport'

export interface CaretScrollOptions {
  editor: Pick<Editor, 'state' | 'view' | 'isFocused' | 'isDestroyed'>
  toolbarElement?: HTMLElement | null
  viewportBounds?: VisualViewportBounds
  dangerZonePadding?: number
}

/**
 * Computes vertical scroll overlap needed to keep the caret visible above the mobile toolbar.
 *
 * Safety rules for mobile/Android:
 * 1. Returns 0 if selection is a range (!selection.empty) so double-tap or text selection
 *    does not force-scroll and disrupt native Android selection handles or magnifier.
 * 2. Returns 0 if view is composing (view.composing) so IME key-hold / accents or glide typing
 *    does not drop composition or flicker the on-screen keyboard.
 * 3. Uses the real toolbar top (or bounds.visibleBottom) instead of double-subtracting keyboardOffset.
 */
export function computeCaretScrollAdjustment(options: CaretScrollOptions): number {
  const { editor, toolbarElement, viewportBounds = getVisualViewportBounds(), dangerZonePadding = 16 } = options

  if (editor.isDestroyed || !editor.isFocused) {
    return 0
  }

  const { selection } = editor.state
  if (!selection || !selection.empty) {
    return 0
  }

  if (editor.view?.composing) {
    return 0
  }

  try {
    const coords = editor.view.coordsAtPos(selection.to)
    if (!coords || !Number.isFinite(coords.bottom)) {
      return 0
    }

    let toolbarTop = viewportBounds.visibleBottom - 44
    if (toolbarElement) {
      const rect = toolbarElement.getBoundingClientRect()
      if (rect.height > 0 && rect.top > 0) {
        toolbarTop = rect.top
      }
    }

    const dangerZoneTop = toolbarTop - dangerZonePadding
    if (coords.bottom > dangerZoneTop) {
      const overlap = Math.ceil(coords.bottom - dangerZoneTop)
      return overlap > 0 ? overlap : 0
    }

    return 0
  } catch {
    return 0
  }
}
