import { describe, expect, it, vi } from 'vitest'

import {
  flushAllUnsavedEdits,
  hasAnyUnsavedLocalEdits,
  hasUnsavedLocalEdits,
  registerUnsavedEditsFlush,
  registerUnsavedEditsProbe,
} from './localEditState'

describe('localEditState', () => {
  it('reports no unsaved edits without a registered editor', () => {
    expect(hasUnsavedLocalEdits('file-1')).toBe(false)
    expect(hasAnyUnsavedLocalEdits()).toBe(false)
  })

  it('asks the live probe each time', () => {
    let dirty = true
    const unregister = registerUnsavedEditsProbe('file-1', () => dirty)
    expect(hasUnsavedLocalEdits('file-1')).toBe(true)
    expect(hasAnyUnsavedLocalEdits()).toBe(true)
    dirty = false
    expect(hasUnsavedLocalEdits('file-1')).toBe(false)
    expect(hasAnyUnsavedLocalEdits()).toBe(false)
    unregister()
  })

  it('ignores a stale unregister from a replaced editor', () => {
    const unregisterOld = registerUnsavedEditsProbe('file-1', () => false)
    const unregisterNew = registerUnsavedEditsProbe('file-1', () => true)
    unregisterOld()
    expect(hasUnsavedLocalEdits('file-1')).toBe(true)
    expect(hasAnyUnsavedLocalEdits()).toBe(true)
    unregisterNew()
    expect(hasUnsavedLocalEdits('file-1')).toBe(false)
    expect(hasAnyUnsavedLocalEdits()).toBe(false)
  })

  it('flushes all registered flush handlers and tolerates individual errors', async () => {
    const flush1 = vi.fn().mockResolvedValue(undefined)
    const flush2 = vi.fn().mockRejectedValue(new Error('Flush error'))
    const flush3 = vi.fn().mockResolvedValue(undefined)

    const unregister1 = registerUnsavedEditsFlush('file-1', flush1)
    const unregister2 = registerUnsavedEditsFlush('file-2', flush2)
    const unregister3 = registerUnsavedEditsFlush('file-3', flush3)

    await flushAllUnsavedEdits()

    expect(flush1).toHaveBeenCalledTimes(1)
    expect(flush2).toHaveBeenCalledTimes(1)
    expect(flush3).toHaveBeenCalledTimes(1)

    unregister1()
    unregister2()
    unregister3()

    await flushAllUnsavedEdits()
    expect(flush1).toHaveBeenCalledTimes(1)
    expect(flush3).toHaveBeenCalledTimes(1)
  })
})
