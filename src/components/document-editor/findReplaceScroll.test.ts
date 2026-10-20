// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import {
  computeVisibleScrollDelta,
  findScrollContainer,
  scrollActiveMatchIntoView,
} from './findReplaceScroll'
import type { VisualViewportBounds } from '../../hooks/useVisualViewport'

describe('computeVisibleScrollDelta', () => {
  const desktopBounds: VisualViewportBounds = {
    width: 1024,
    height: 768,
    offsetTop: 0,
    offsetLeft: 0,
    keyboardOffset: 0,
    visibleBottom: 768,
  }

  const mobileKeyboardBounds: VisualViewportBounds = {
    width: 375,
    height: 380, // Keyboard taking bottom ~287px of a 667px screen
    offsetTop: 0,
    offsetLeft: 0,
    keyboardOffset: 287,
    visibleBottom: 380,
  }

  it('returns 0 when match is already fully within the visible window on desktop', () => {
    const delta = computeVisibleScrollDelta({
      matchRect: { top: 300, bottom: 320, height: 20 },
      dialogRect: { bottom: 100 },
      viewportBounds: desktopBounds,
      padding: 16,
    })
    // Visible range: [100 + 16, 768 - 16] = [116, 752]
    // Match range: [300, 320] -> fully inside
    expect(delta).toBe(0)
  })

  it('returns negative delta to scroll container up when match is occluded under the FindReplaceDialog', () => {
    const delta = computeVisibleScrollDelta({
      matchRect: { top: 80, bottom: 100, height: 20 },
      dialogRect: { bottom: 120 },
      viewportBounds: desktopBounds,
      padding: 16,
    })
    // Top barrier: 120 + 16 = 136
    // Match top: 80
    // Expected delta: 80 - 136 = -56
    expect(delta).toBe(-56)
  })

  it('returns positive delta to scroll container down when match is below desktop viewport', () => {
    const delta = computeVisibleScrollDelta({
      matchRect: { top: 800, bottom: 820, height: 20 },
      dialogRect: { bottom: 100 },
      viewportBounds: desktopBounds,
      padding: 16,
    })
    // Bottom limit: 768 - 16 = 752
    // Match bottom: 820
    // Expected delta: 820 - 752 = +68
    expect(delta).toBe(68)
  })

  it('accounts for virtual keyboard height on mobile', () => {
    const delta = computeVisibleScrollDelta({
      matchRect: { top: 360, bottom: 380, height: 20 },
      dialogRect: { bottom: 110 },
      viewportBounds: mobileKeyboardBounds, // visibleBottom is 380
      padding: 16,
    })
    // Top barrier: 110 + 16 = 126
    // Bottom limit: 380 - 16 = 364
    // Match bottom: 380 (partially occluded behind keyboard)
    // Expected delta: 380 - 364 = +16
    expect(delta).toBe(16)
  })

  it('accounts for mobile document toolbar positioned above the keyboard', () => {
    const delta = computeVisibleScrollDelta({
      matchRect: { top: 300, bottom: 320, height: 20 },
      dialogRect: { bottom: 110 },
      viewportBounds: mobileKeyboardBounds, // visibleBottom is 380
      toolbarRect: { top: 316, height: 64 }, // toolbar top is 316
      padding: 16,
    })
    // Bottom limit: 316 - 16 = 300
    // Match bottom: 320 (occluded behind mobile toolbar)
    // Expected delta: 320 - 300 = +20
    expect(delta).toBe(20)
  })

  it('aligns top barrier when the match is taller than the visible viewport', () => {
    const delta = computeVisibleScrollDelta({
      matchRect: { top: 250, bottom: 500, height: 250 },
      dialogRect: { bottom: 110 },
      viewportBounds: mobileKeyboardBounds, // visible range is [126, 364] = 238px
      padding: 16,
    })
    // Visible range: [126, 364]
    // Match is 250px (> 238px visible height)
    // Top barrier is 126. Match top is 250.
    // Expected delta: 250 - 126 = +124 (aligns match top to top barrier)
    expect(delta).toBe(124)
  })

  it('handles extremely constrained viewport gracefully', () => {
    const delta = computeVisibleScrollDelta({
      matchRect: { top: 180, bottom: 200, height: 20 },
      dialogRect: { bottom: 160 },
      viewportBounds: {
        width: 320,
        height: 170,
        offsetTop: 0,
        offsetLeft: 0,
        keyboardOffset: 300,
        visibleBottom: 170,
      },
      padding: 16,
    })
    // topBarrier = 176, bottomLimit = 154 (bottomLimit <= topBarrier)
    // Fallback: matchRect.top - (dialogBottom + 8) = 180 - (160 + 8) = +12
    expect(delta).toBe(12)
  })
})

describe('findScrollContainer and scrollActiveMatchIntoView', () => {
  it('identifies nearest scrollable parent element with overflow auto/scroll', () => {
    const outer = document.createElement('div')
    const scrollParent = document.createElement('main')
    scrollParent.style.overflowY = 'auto'
    const child = document.createElement('p')
    scrollParent.appendChild(child)
    outer.appendChild(scrollParent)
    document.body.appendChild(outer)

    const found = findScrollContainer(child)
    expect(found).toBe(scrollParent)

    outer.remove()
  })

  it('falls back to window if no scrollable parent is found', () => {
    const div = document.createElement('div')
    document.body.appendChild(div)
    expect(findScrollContainer(div)).toBe(window)
    div.remove()
  })

  it('scrolls the container by computed delta when element is occluded', () => {
    const container = document.createElement('main')
    container.style.overflowY = 'auto'
    const scrollBySpy = vi.fn()
    container.scrollBy = scrollBySpy

    const matchEl = document.createElement('span')
    container.appendChild(matchEl)
    document.body.appendChild(container)

    // Mock bounding rects
    vi.spyOn(matchEl, 'getBoundingClientRect').mockReturnValue({
      top: 50,
      bottom: 70,
      height: 20,
      width: 50,
      left: 10,
      right: 60,
      x: 10,
      y: 50,
      toJSON: () => {},
    })

    const dialogEl = document.createElement('div')
    vi.spyOn(dialogEl, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      bottom: 100,
      height: 100,
      width: 375,
      left: 0,
      right: 375,
      x: 0,
      y: 0,
      toJSON: () => {},
    })

    const scrolled = scrollActiveMatchIntoView(matchEl, dialogEl)
    expect(scrolled).toBe(true)
    // Top barrier is 100 + 16 = 116. Match top is 50. Delta is 50 - 116 = -66.
    expect(scrollBySpy).toHaveBeenCalledWith({ top: -66, behavior: 'smooth' })

    container.remove()
  })

  it('does not scroll when match is already in view', () => {
    const container = document.createElement('main')
    container.style.overflowY = 'auto'
    const scrollBySpy = vi.fn()
    container.scrollBy = scrollBySpy

    const matchEl = document.createElement('span')
    container.appendChild(matchEl)
    document.body.appendChild(container)

    vi.spyOn(matchEl, 'getBoundingClientRect').mockReturnValue({
      top: 250,
      bottom: 270,
      height: 20,
      width: 50,
      left: 10,
      right: 60,
      x: 10,
      y: 250,
      toJSON: () => {},
    })

    const dialogEl = document.createElement('div')
    vi.spyOn(dialogEl, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      bottom: 100,
      height: 100,
      width: 375,
      left: 0,
      right: 375,
      x: 0,
      y: 0,
      toJSON: () => {},
    })

    const scrolled = scrollActiveMatchIntoView(matchEl, dialogEl)
    expect(scrolled).toBe(false)
    expect(scrollBySpy).not.toHaveBeenCalled()

    container.remove()
  })
})
