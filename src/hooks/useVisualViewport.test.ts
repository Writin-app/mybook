// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  _resetViewportSubscribersForTesting,
  getVisualViewportBounds,
  useKeyboardOffset,
  useVisualViewport,
} from './useVisualViewport'

afterEach(() => {
  cleanup()
  _resetViewportSubscribersForTesting()
  vi.restoreAllMocks()
})

describe('useVisualViewport', () => {
  beforeEach(() => {
    _resetViewportSubscribersForTesting()
  })

  it('falls back to window dimensions when visualViewport is undefined', () => {
    const originalViewport = window.visualViewport
    // @ts-expect-error test override
    delete window.visualViewport

    const bounds = getVisualViewportBounds()
    expect(bounds.width).toBe(window.innerWidth)
    expect(bounds.height).toBe(window.innerHeight)
    expect(bounds.offsetTop).toBe(0)
    expect(bounds.keyboardOffset).toBe(0)
    expect(bounds.visibleBottom).toBe(window.innerHeight)

    window.visualViewport = originalViewport
  })

  it('calculates keyboardOffset and visibleBottom with visualViewport', () => {
    const mockViewport = {
      width: 390,
      height: 480,
      offsetTop: 0,
      offsetLeft: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    // @ts-expect-error test override
    window.visualViewport = mockViewport
    window.innerHeight = 844

    const bounds = getVisualViewportBounds()
    expect(bounds.width).toBe(390)
    expect(bounds.height).toBe(480)
    expect(bounds.keyboardOffset).toBe(844 - 480)
    expect(bounds.visibleBottom).toBe(480)
  })

  it('accounts for non-zero offsetTop in visualViewport', () => {
    const mockViewport = {
      width: 390,
      height: 400,
      offsetTop: 50,
      offsetLeft: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    // @ts-expect-error test override
    window.visualViewport = mockViewport
    window.innerHeight = 800

    const bounds = getVisualViewportBounds()
    expect(bounds.offsetTop).toBe(50)
    expect(bounds.height).toBe(400)
    // keyboardOffset = innerHeight - height - offsetTop = 800 - 400 - 50 = 350
    expect(bounds.keyboardOffset).toBe(350)
    // visibleBottom = offsetTop + height = 450
    expect(bounds.visibleBottom).toBe(450)
  })

  it('sets and removes --mybook-keyboard-offset CSS property and registers/cleans up listeners', () => {
    const addEventListenerMock = vi.fn()
    const removeEventListenerMock = vi.fn()
    const mockViewport = {
      width: 390,
      height: 500,
      offsetTop: 0,
      offsetLeft: 0,
      addEventListener: addEventListenerMock,
      removeEventListener: removeEventListenerMock,
    }
    // @ts-expect-error test override
    window.visualViewport = mockViewport
    window.innerHeight = 800

    const { unmount } = renderHook(() => useVisualViewport(true))

    expect(document.documentElement.style.getPropertyValue('--mybook-keyboard-offset')).toBe('300px')
    expect(addEventListenerMock).toHaveBeenCalledWith('resize', expect.any(Function))
    expect(addEventListenerMock).toHaveBeenCalledWith('scroll', expect.any(Function))

    unmount()

    expect(document.documentElement.style.getPropertyValue('--mybook-keyboard-offset')).toBe('')
    expect(removeEventListenerMock).toHaveBeenCalledWith('resize', expect.any(Function))
    expect(removeEventListenerMock).toHaveBeenCalledWith('scroll', expect.any(Function))
  })

  it('useKeyboardOffset returns keyboardOffset number', () => {
    const mockViewport = {
      width: 390,
      height: 500,
      offsetTop: 0,
      offsetLeft: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    // @ts-expect-error test override
    window.visualViewport = mockViewport
    window.innerHeight = 800

    const { result } = renderHook(() => useKeyboardOffset(true))
    expect(result.current).toBe(300)
  })

  it('supports multiple concurrent subscribers without duplicating event listeners', () => {
    const addEventListenerMock = vi.fn()
    const removeEventListenerMock = vi.fn()
    const mockViewport = {
      width: 390,
      height: 500,
      offsetTop: 0,
      offsetLeft: 0,
      addEventListener: addEventListenerMock,
      removeEventListener: removeEventListenerMock,
    }
    // @ts-expect-error test override
    window.visualViewport = mockViewport
    window.innerHeight = 800

    const hookA = renderHook(() => useVisualViewport(true))
    const hookB = renderHook(() => useVisualViewport(true))
    const hookC = renderHook(() => useKeyboardOffset(true))

    // Listeners should only be added once when the first subscriber attaches
    expect(addEventListenerMock).toHaveBeenCalledTimes(2) // 1 for resize, 1 for scroll
    expect(hookA.result.current.keyboardOffset).toBe(300)
    expect(hookB.result.current.keyboardOffset).toBe(300)
    expect(hookC.result.current).toBe(300)
    expect(document.documentElement.style.getPropertyValue('--mybook-keyboard-offset')).toBe('300px')
  })

  it('preserves --mybook-keyboard-offset when one subscriber unmounts while another remains active', () => {
    const addEventListenerMock = vi.fn()
    const removeEventListenerMock = vi.fn()
    const mockViewport = {
      width: 390,
      height: 500,
      offsetTop: 0,
      offsetLeft: 0,
      addEventListener: addEventListenerMock,
      removeEventListener: removeEventListenerMock,
    }
    // @ts-expect-error test override
    window.visualViewport = mockViewport
    window.innerHeight = 800

    const subscriberA = renderHook(() => useVisualViewport(true))
    const subscriberB = renderHook(() => useVisualViewport(true))

    expect(document.documentElement.style.getPropertyValue('--mybook-keyboard-offset')).toBe('300px')

    // Unmount subscriber B
    subscriberB.unmount()

    // Subscriber A is still active -> listeners must NOT be removed, CSS property must NOT be cleared
    expect(removeEventListenerMock).not.toHaveBeenCalled()
    expect(document.documentElement.style.getPropertyValue('--mybook-keyboard-offset')).toBe('300px')
    expect(subscriberA.result.current.keyboardOffset).toBe(300)

    // Unmount final subscriber A
    subscriberA.unmount()

    // Now listeners should be detached and CSS property removed
    expect(removeEventListenerMock).toHaveBeenCalledWith('resize', expect.any(Function))
    expect(removeEventListenerMock).toHaveBeenCalledWith('scroll', expect.any(Function))
    expect(document.documentElement.style.getPropertyValue('--mybook-keyboard-offset')).toBe('')
  })

  it('updates all active subscribers when keyboard opens and closes', () => {
    let resizeCallback: (() => void) | undefined
    const mockViewport = {
      width: 390,
      height: 800,
      offsetTop: 0,
      offsetLeft: 0,
      addEventListener: vi.fn((event: string, cb: () => void) => {
        if (event === 'resize') resizeCallback = cb
      }),
      removeEventListener: vi.fn(),
    }
    // @ts-expect-error test override
    window.visualViewport = mockViewport
    window.innerHeight = 800

    const hook1 = renderHook(() => useVisualViewport(true))
    const hook2 = renderHook(() => useKeyboardOffset(true))

    // Initial state: keyboard closed
    expect(hook1.result.current.keyboardOffset).toBe(0)
    expect(hook2.result.current).toBe(0)
    expect(document.documentElement.style.getPropertyValue('--mybook-keyboard-offset')).toBe('0px')

    // Simulate keyboard open (viewport height decreases to 500)
    mockViewport.height = 500
    act(() => {
      resizeCallback?.()
    })

    expect(hook1.result.current.keyboardOffset).toBe(300)
    expect(hook2.result.current).toBe(300)
    expect(document.documentElement.style.getPropertyValue('--mybook-keyboard-offset')).toBe('300px')

    // Simulate keyboard close (viewport height restores to 800)
    mockViewport.height = 800
    act(() => {
      resizeCallback?.()
    })

    expect(hook1.result.current.keyboardOffset).toBe(0)
    expect(hook2.result.current).toBe(0)
    expect(document.documentElement.style.getPropertyValue('--mybook-keyboard-offset')).toBe('0px')
  })

  it('does not subscribe when enabled is false, and subscribes when toggled to true', () => {
    const addEventListenerMock = vi.fn()
    const removeEventListenerMock = vi.fn()
    const mockViewport = {
      width: 390,
      height: 500,
      offsetTop: 0,
      offsetLeft: 0,
      addEventListener: addEventListenerMock,
      removeEventListener: removeEventListenerMock,
    }
    // @ts-expect-error test override
    window.visualViewport = mockViewport
    window.innerHeight = 800

    const { rerender, unmount } = renderHook(({ enabled }) => useVisualViewport(enabled), {
      initialProps: { enabled: false },
    })

    // Should not register any listeners or set CSS property
    expect(addEventListenerMock).not.toHaveBeenCalled()
    expect(document.documentElement.style.getPropertyValue('--mybook-keyboard-offset')).toBe('')

    // Toggle to true
    rerender({ enabled: true })
    expect(addEventListenerMock).toHaveBeenCalled()
    expect(document.documentElement.style.getPropertyValue('--mybook-keyboard-offset')).toBe('300px')

    // Toggle back to false
    rerender({ enabled: false })
    expect(removeEventListenerMock).toHaveBeenCalled()
    expect(document.documentElement.style.getPropertyValue('--mybook-keyboard-offset')).toBe('')

    unmount()
  })
})
