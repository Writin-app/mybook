// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { broadcastDocUpdate, getTabId, subscribeToTabDocUpdates } from './tabSyncChannel'

describe('tabSyncChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('provides a unique tab identifier', () => {
    expect(typeof getTabId()).toBe('string')
    expect(getTabId().length).toBeGreaterThan(0)
  })

  it('allows subscribing and unsubscribing to doc updates', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToTabDocUpdates(listener)
    expect(typeof unsubscribe).toBe('function')
    unsubscribe()
  })

  it('does not throw when broadcasting without broadcast support', () => {
    expect(() => broadcastDocUpdate('file-1', 'content', 'Title')).not.toThrow()
  })

  it('delivers updates synchronously to sibling views in the same page', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToTabDocUpdates(listener)

    broadcastDocUpdate('file-1', 'new content', 'Title')

    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      type: 'doc-update',
      fileId: 'file-1',
      content: 'new content',
      title: 'Title',
      senderId: getTabId(),
    }))
    unsubscribe()
  })

  it('delivers messages from another tab to subscribers and ignores self-sent messages', async () => {
    let messageHandler: ((event: { data: unknown }) => void) | undefined
    const postMessageMock = vi.fn()
    class FakeBroadcastChannel {
      set onmessage(handler: (event: { data: unknown }) => void) {
        messageHandler = handler
      }
      postMessage = postMessageMock
    }
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
    vi.resetModules()

    const { subscribeToTabDocUpdates: freshSubscribe, getTabId: freshGetTabId } = await import('./tabSyncChannel')

    const received: unknown[] = []
    const unsub = freshSubscribe((msg) => {
      received.push(msg)
    })

    const trigger = (data: unknown) => {
      if (typeof messageHandler === 'function') {
        messageHandler({ data })
      }
    }

    // Message from another tab
    trigger({
      type: 'doc-update',
      fileId: 'file-1',
      content: 'hello from tab 2',
      title: 'Title 2',
      senderId: 'other-tab-id',
    })
    expect(received).toHaveLength(1)
    expect(received[0]).toMatchObject({ content: 'hello from tab 2', senderId: 'other-tab-id' })

    // Message from same tab
    trigger({
      type: 'doc-update',
      fileId: 'file-1',
      content: 'echo of own update',
      senderId: freshGetTabId(),
    })
    expect(received).toHaveLength(1)

    unsub()
  })
})
