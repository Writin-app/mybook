import { getVisualViewportBounds, type VisualViewportBounds } from '../../hooks/useVisualViewport'

export interface ScrollTargetDeltaOptions {
  matchRect: { top: number; bottom: number; height: number }
  dialogRect: { bottom: number } | null
  viewportBounds?: VisualViewportBounds
  toolbarRect?: { top: number; height: number } | null
  padding?: number
}

/**
 * Computes the vertical scroll delta required to bring an active search match
 * into the visible portion of the visual viewport.
 *
 * Takes into account:
 * 1. Top occlusion: The sticky/fixed AppHeader and FindReplaceDialog at the top.
 * 2. Bottom occlusion: The on-screen keyboard (visualViewport.keyboardOffset / visibleBottom)
 *    and any fixed mobile toolbar (.mybook-mobile-document-toolbar).
 * 3. Match height: If the match itself is taller than the visible window, aligns top.
 * 4. No-op (0 delta): If the match is already completely visible, avoids unnecessary scroll jumps.
 */
export function computeVisibleScrollDelta(options: ScrollTargetDeltaOptions): number {
  const {
    matchRect,
    dialogRect,
    viewportBounds = getVisualViewportBounds(),
    toolbarRect,
    padding = 16,
  } = options

  // Top barrier is the bottom of the FindReplaceDialog plus safe padding
  const topBarrier = (dialogRect ? dialogRect.bottom : 0) + padding

  // Bottom barrier is the lower limit of the visual viewport.
  // If the mobile toolbar is present and visible, its top edge is the lower boundary.
  let bottomBarrier = viewportBounds.visibleBottom
  if (toolbarRect && toolbarRect.height > 0 && toolbarRect.top < bottomBarrier) {
    bottomBarrier = toolbarRect.top
  }

  const bottomLimit = bottomBarrier - padding

  // If the available visible area is extremely constrained (e.g. tiny landscape screen with keyboard):
  if (bottomLimit <= topBarrier) {
    return Math.round(matchRect.top - ((dialogRect ? dialogRect.bottom : 0) + 8))
  }

  // 1. If match is occluded at the top (under dialog or above viewport)
  if (matchRect.top < topBarrier) {
    return Math.round(matchRect.top - topBarrier)
  }

  // 2. If match is occluded at the bottom (behind keyboard or mobile toolbar)
  if (matchRect.bottom > bottomLimit) {
    // If the match element itself is taller than the visible area, align its top
    if (matchRect.height > bottomLimit - topBarrier) {
      return Math.round(matchRect.top - topBarrier)
    }
    // Otherwise align its bottom
    return Math.round(matchRect.bottom - bottomLimit)
  }

  // 3. Match is already completely inside the visible area: no scroll needed!
  return 0
}

/**
 * Traverses upwards to find the scrollable container for the element,
 * falling back to window if no scrollable parent is found.
 */
export function findScrollContainer(element: HTMLElement | null): HTMLElement | Window {
  if (!element || typeof window === 'undefined') return window
  let current = element.parentElement
  while (current && current !== document.body && current !== document.documentElement) {
    const style = window.getComputedStyle(current)
    const overflowY = style.overflowY
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return current
    }
    current = current.parentElement
  }
  return window
}

/**
 * Scrolls the active match into the visible visual viewport.
 * Returns true if a scroll was performed, or false if already in view or not possible.
 */
export function scrollActiveMatchIntoView(
  matchElement: HTMLElement,
  dialogElement: HTMLElement | null,
  options?: { behavior?: ScrollBehavior },
): boolean {
  if (!matchElement || typeof window === 'undefined') return false

  const matchRect = matchElement.getBoundingClientRect()
  // If the element has no layout dimensions (e.g. in headless unit tests without DOM geometry)
  if (matchRect.width === 0 && matchRect.height === 0 && matchRect.top === 0 && matchRect.bottom === 0) {
    try {
      matchElement.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: options?.behavior ?? 'smooth' })
    } catch {
      /* ignore */
    }
    return false
  }

  const dialogRect = dialogElement ? dialogElement.getBoundingClientRect() : null
  const bounds = getVisualViewportBounds()
  const toolbar = document.querySelector<HTMLElement>('.mybook-mobile-document-toolbar')
  const toolbarRect = toolbar ? toolbar.getBoundingClientRect() : null

  const deltaY = computeVisibleScrollDelta({
    matchRect: {
      top: matchRect.top,
      bottom: matchRect.bottom,
      height: matchRect.height,
    },
    dialogRect: dialogRect ? { bottom: dialogRect.bottom } : null,
    viewportBounds: bounds,
    toolbarRect: toolbarRect ? { top: toolbarRect.top, height: toolbarRect.height } : null,
  })

  if (Math.abs(deltaY) < 1) {
    return false // Already completely visible
  }

  const container = findScrollContainer(matchElement)
  const behavior = options?.behavior ?? 'smooth'

  if (container instanceof HTMLElement) {
    if (typeof container.scrollBy === 'function') {
      container.scrollBy({ top: deltaY, behavior })
    } else {
      container.scrollTop += deltaY
    }
  } else {
    if (typeof window.scrollBy === 'function') {
      window.scrollBy({ top: deltaY, behavior })
    } else if (document.scrollingElement) {
      document.scrollingElement.scrollTop += deltaY
    }
  }

  return true
}
