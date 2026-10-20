import { useEffect, useState } from 'react'

import { useIsMobile } from './use-mobile'

/**
 * Determines whether desktop hover-based block controls should be enabled.
 * Returns false on mobile viewports (< 768px) and pure touch devices without hover support.
 * Returns true on desktop/hybrid devices with fine hover-capable pointers (mouse/trackpad).
 */
export function useHoverBlockControlsAvailable(): boolean {
  const isMobile = useIsMobile()
  const [hasHoverPointer, setHasHoverPointer] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    if (typeof window.matchMedia !== 'function') return true
    return !window.matchMedia('(hover: none) and (pointer: coarse)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia('(hover: none) and (pointer: coarse)')
    const onChange = () => {
      setHasHoverPointer(!mql.matches)
    }
    mql.addEventListener?.('change', onChange)
    setHasHoverPointer(!mql.matches)
    return () => mql.removeEventListener?.('change', onChange)
  }, [])

  if (isMobile) return false
  return hasHoverPointer
}
