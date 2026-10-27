// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as localEditState from '../services/localEditState'
import { usePwaStore } from './usePwaStore'

describe('usePwaStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usePwaStore.setState({
      needRefresh: false,
      isUpdating: false,
      updateProgress: 0,
      updateStatusMessage: null,
      registration: null,
      updateServiceWorkerFn: null,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sets and updates needRefresh', () => {
    expect(usePwaStore.getState().needRefresh).toBe(false)
    usePwaStore.getState().setNeedRefresh(true)
    expect(usePwaStore.getState().needRefresh).toBe(true)
    usePwaStore.getState().setNeedRefresh(false)
    expect(usePwaStore.getState().needRefresh).toBe(false)
  })

  it('runs startUpdate, flushes unsaved edits, and commands service worker activation', async () => {
    const flushSpy = vi.spyOn(localEditState, 'flushAllUnsavedEdits').mockResolvedValue(undefined)
    const swMock = vi.fn().mockResolvedValue(undefined)
    usePwaStore.getState().setUpdateServiceWorkerFn(swMock)

    const updatePromise = usePwaStore.getState().startUpdate()

    expect(usePwaStore.getState().isUpdating).toBe(true)
    expect(usePwaStore.getState().updateProgress).toBeGreaterThanOrEqual(25)

    await updatePromise

    expect(flushSpy).toHaveBeenCalledTimes(1)
    expect(swMock).toHaveBeenCalledWith(true)
    expect(usePwaStore.getState().updateProgress).toBe(100)
    expect(usePwaStore.getState().updateStatusMessage).toBe('Reloading Writin…')
  })

  it('checkForUpdates updates needRefresh when registration has waiting worker', async () => {
    const mockRegistration = {
      update: vi.fn().mockResolvedValue(undefined),
      waiting: {} as ServiceWorker,
    } as unknown as ServiceWorkerRegistration

    usePwaStore.getState().setRegistration(mockRegistration)

    const result = await usePwaStore.getState().checkForUpdates()

    expect(mockRegistration.update).toHaveBeenCalledTimes(1)
    expect(result).toBe(true)
    expect(usePwaStore.getState().needRefresh).toBe(true)
  })
})
