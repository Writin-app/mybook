import { useEffect, useState } from 'react'

export interface VisualViewportBounds {
  width: number
  height: number
  offsetTop: number
  offsetLeft: number
  keyboardOffset: number
  visibleBottom: number
}

export function getVisualViewportBounds(): VisualViewportBounds {
  if (typeof window === 'undefined') {
    return {
      width: 1024,
      height: 768,
      offsetTop: 0,
      offsetLeft: 0,
      keyboardOffset: 0,
      visibleBottom: 768,
    }
  }

  const viewport = window.visualViewport
  if (!viewport) {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      offsetTop: 0,
      offsetLeft: 0,
      keyboardOffset: 0,
      visibleBottom: window.innerHeight,
    }
  }

  const offsetTop = Math.max(0, Math.round(viewport.offsetTop))
  const offsetLeft = Math.max(0, Math.round(viewport.offsetLeft))
  const height = Math.round(viewport.height)
  const width = Math.round(viewport.width)
  const keyboardOffset = Math.max(0, Math.round(window.innerHeight - height - offsetTop))
  const visibleBottom = offsetTop + height

  return {
    width,
    height,
    offsetTop,
    offsetLeft,
    keyboardOffset,
    visibleBottom,
  }
}

function areBoundsEqual(a: VisualViewportBounds, b: VisualViewportBounds): boolean {
  return (
    a.width === b.width &&
    a.height === b.height &&
    a.offsetTop === b.offsetTop &&
    a.offsetLeft === b.offsetLeft &&
    a.keyboardOffset === b.keyboardOffset &&
    a.visibleBottom === b.visibleBottom
  )
}

type ViewportListener = (bounds: VisualViewportBounds) => void

const subscribers = new Set<ViewportListener>()
let attachedViewport: VisualViewport | null = null
let cachedBounds: VisualViewportBounds | null = null

function updateAndBroadcast() {
  const nextBounds = getVisualViewportBounds()
  if (cachedBounds && areBoundsEqual(cachedBounds, nextBounds)) {
    return
  }
  cachedBounds = nextBounds
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--mybook-keyboard-offset', `${nextBounds.keyboardOffset}px`)
  }
  const snapshot = Array.from(subscribers)
  for (const listener of snapshot) {
    try {
      listener(nextBounds)
    } catch (err) {
      console.error('Error in visualViewport subscriber:', err)
    }
  }
}

function handleViewportChange() {
  updateAndBroadcast()
}

function subscribeViewport(listener: ViewportListener): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }

  if (subscribers.size === 0) {
    const viewport = window.visualViewport ?? null
    attachedViewport = viewport
    attachedViewport?.addEventListener('resize', handleViewportChange)
    attachedViewport?.addEventListener('scroll', handleViewportChange)
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('orientationchange', handleViewportChange)

    const initialBounds = getVisualViewportBounds()
    cachedBounds = initialBounds
    document.documentElement.style.setProperty('--mybook-keyboard-offset', `${initialBounds.keyboardOffset}px`)
  }

  subscribers.add(listener)

  return () => {
    subscribers.delete(listener)
    if (subscribers.size === 0) {
      attachedViewport?.removeEventListener('resize', handleViewportChange)
      attachedViewport?.removeEventListener('scroll', handleViewportChange)
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('orientationchange', handleViewportChange)
      document.documentElement.style.removeProperty('--mybook-keyboard-offset')
      attachedViewport = null
      cachedBounds = null
    }
  }
}

export function _resetViewportSubscribersForTesting() {
  if (typeof window !== 'undefined') {
    attachedViewport?.removeEventListener('resize', handleViewportChange)
    attachedViewport?.removeEventListener('scroll', handleViewportChange)
    window.removeEventListener('resize', handleViewportChange)
    window.removeEventListener('orientationchange', handleViewportChange)
    document.documentElement.style.removeProperty('--mybook-keyboard-offset')
  }
  subscribers.clear()
  attachedViewport = null
  cachedBounds = null
}

export function useVisualViewport(enabled = true): VisualViewportBounds {
  const [bounds, setBounds] = useState<VisualViewportBounds>(getVisualViewportBounds)

  useEffect(() => {
    if (!enabled) return

    const current = getVisualViewportBounds()
    setBounds(current)

    return subscribeViewport((nextBounds) => {
      setBounds(nextBounds)
    })
  }, [enabled])

  return bounds
}

export function useKeyboardOffset(enabled = true): number {
  const bounds = useVisualViewport(enabled)
  return bounds.keyboardOffset
}
