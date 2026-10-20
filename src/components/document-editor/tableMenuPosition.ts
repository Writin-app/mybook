import { getVisualViewportBounds } from '../../hooks/useVisualViewport'

export function tableMenuTop(
  anchorTop: number,
  anchorBottom: number,
  menuHeight: number,
  gap = 8,
  minTop = gap,
  viewportHeight?: number,
) {
  const effectiveViewportHeight = viewportHeight ?? (typeof window !== 'undefined' ? getVisualViewportBounds().visibleBottom : 768)
  const below = anchorBottom + gap
  const hasRoomBelow = below + menuHeight <= effectiveViewportHeight - gap
  if (hasRoomBelow) return below
  const above = anchorTop - menuHeight - gap
  if (above >= minTop) return above
  return Math.max(minTop, effectiveViewportHeight - menuHeight - gap)
}

export function rowGripMenuTop(
  gripTop: number,
  gripBottom: number,
  menuHeight: number,
  gap = 8,
  minTop = gap,
  viewportHeight?: number,
) {
  if (typeof window === 'undefined') return gripTop
  const effectiveViewportHeight = viewportHeight ?? getVisualViewportBounds().visibleBottom
  if (gripTop + menuHeight <= effectiveViewportHeight - gap) {
    return Math.max(minTop, gripTop)
  }
  if (gripBottom - menuHeight >= minTop) {
    return gripBottom - menuHeight
  }
  return Math.max(minTop, effectiveViewportHeight - menuHeight - gap)
}