import { describe, expect, it } from 'vitest'

import { reconcileExternalUpdate, type ReconcileInput } from './syncReconciler'

const input = (overrides: Partial<ReconcileInput> = {}): ReconcileInput => ({
  baseContent: 'base',
  localContent: 'base',
  syncStatus: 'backed-up',
  hasUnsavedLocalEdits: false,
  remoteChanged: true,
  remoteContent: 'remote',
  ...overrides,
})

describe('reconcileExternalUpdate', () => {
  it('does nothing when the remote has not changed', () => {
    expect(reconcileExternalUpdate(input({ remoteChanged: false, localContent: 'mine' }))).toEqual({ action: 'noop' })
  })

  it('applies the remote only when local is unchanged since the base', () => {
    expect(reconcileExternalUpdate(input())).toEqual({ action: 'apply-remote' })
  })

  it('flags a conflict when both sides changed in conflicting ways', () => {
    expect(reconcileExternalUpdate(input({ localContent: 'mine' }))).toEqual({ action: 'conflict' })
  })

  it('never applies the remote over unsaved keystrokes, even if stored content equals the base', () => {
    expect(reconcileExternalUpdate(input({ hasUnsavedLocalEdits: true }))).toEqual({ action: 'conflict' })
  })

  it('safely merges remote content when local content is unchanged and a push is pending (e.g. metadata rename/move)', () => {
    expect(reconcileExternalUpdate(input({ hasPendingPush: true }))).toEqual({ action: 'merge', mergedContent: 'remote' })
  })

  it('never silently overwrites genuinely pending local content edits', () => {
    expect(reconcileExternalUpdate(input({ localContent: 'locally edited', hasPendingPush: true }))).toEqual({ action: 'conflict' })
  })

  it('adopts identical content without a conflict', () => {
    expect(reconcileExternalUpdate(input({ localContent: 'same', remoteContent: 'same' }))).toEqual({ action: 'noop' })
  })

  it('still reports a conflict for identical content while edits are unsaved', () => {
    expect(reconcileExternalUpdate(input({ localContent: 'same', remoteContent: 'same', hasUnsavedLocalEdits: true }))).toEqual({ action: 'conflict' })
  })

  it('keeps local when remote content matches the base content', () => {
    expect(reconcileExternalUpdate(input({ baseContent: 'base', localContent: 'edited local', remoteContent: 'base' }))).toEqual({ action: 'keep-local' })
  })

  it('merges non-overlapping block edits cleanly', () => {
    const base = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'P1' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'P2' }] }] })
    const local = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'P1 edited' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'P2' }] }] })
    const remote = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'P1' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'P2 edited' }] }] })

    const decision = reconcileExternalUpdate(input({ baseContent: base, localContent: local, remoteContent: remote }))
    expect(decision.action).toBe('merge')
    if (decision.action === 'merge') {
      const parsed = JSON.parse(decision.mergedContent)
      expect(parsed.content[0].content[0].text).toBe('P1 edited')
      expect(parsed.content[1].content[0].text).toBe('P2 edited')
    }
  })

  it('merges non-overlapping block edits cleanly even when a local push is pending', () => {
    const base = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'P1' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'P2' }] }] })
    const local = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'P1 edited' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'P2' }] }] })
    const remote = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'P1' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'P2 edited' }] }] })

    const decision = reconcileExternalUpdate(input({ baseContent: base, localContent: local, remoteContent: remote, hasPendingPush: true, syncStatus: 'pending' }))
    expect(decision.action).toBe('merge')
    if (decision.action === 'merge') {
      const parsed = JSON.parse(decision.mergedContent)
      expect(parsed.content[0].content[0].text).toBe('P1 edited')
      expect(parsed.content[1].content[0].text).toBe('P2 edited')
    }
  })

  it('flags a genuine conflict on overlapping block edits even when a local push is pending', () => {
    const base = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'P1' }] }] })
    const local = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'P1 local edit' }] }] })
    const remote = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'P1 remote edit' }] }] })

    const decision = reconcileExternalUpdate(input({ baseContent: base, localContent: local, remoteContent: remote, hasPendingPush: true, syncStatus: 'pending' }))
    expect(decision.action).toBe('conflict')
  })

  describe('files created before base tracking', () => {
    it('applies the remote for a backed-up file', () => {
      expect(reconcileExternalUpdate(input({ baseContent: undefined }))).toEqual({ action: 'apply-remote' })
    })

    it.each(['pending', 'failed', 'offline'] as const)('is conservative for a %s file', (syncStatus) => {
      expect(reconcileExternalUpdate(input({ baseContent: undefined, syncStatus }))).toEqual({ action: 'conflict' })
    })
  })

  describe('newly created documents and empty normalization', () => {
    const emptyCanonicalDoc = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] })
    const emptyArrayDoc = JSON.stringify({ type: 'doc', content: [] })
    const typedDoc = JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Typing on new document' }] }],
    })

    it('treats empty string and canonical empty TipTap document as identical content (noop)', () => {
      expect(reconcileExternalUpdate(input({
        localContent: '',
        remoteContent: emptyCanonicalDoc,
        baseContent: '',
      }))).toEqual({ action: 'noop' })

      expect(reconcileExternalUpdate(input({
        localContent: emptyArrayDoc,
        remoteContent: emptyCanonicalDoc,
        baseContent: undefined,
      }))).toEqual({ action: 'noop' })
    })

    it('preserves local typing when remote is the initial canonical empty document and push is pending', () => {
      expect(reconcileExternalUpdate(input({
        baseContent: undefined,
        localContent: typedDoc,
        remoteContent: emptyCanonicalDoc,
        hasPendingPush: true,
        syncStatus: 'pending',
      }))).toEqual({ action: 'keep-local' })

      expect(reconcileExternalUpdate(input({
        baseContent: '',
        localContent: typedDoc,
        remoteContent: emptyCanonicalDoc,
        hasPendingPush: true,
        syncStatus: 'pending',
      }))).toEqual({ action: 'keep-local' })
    })

    it('flags a conflict when remote has a genuinely competing non-empty edit on an uninitialized base', () => {
      const competingRemoteDoc = JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Competing remote edit' }] }],
      })
      expect(reconcileExternalUpdate(input({
        baseContent: undefined,
        localContent: typedDoc,
        remoteContent: competingRemoteDoc,
        hasPendingPush: true,
        syncStatus: 'pending',
      }))).toEqual({ action: 'conflict' })
    })

    it('flags a conflict on an existing document with competing edits', () => {
      const baseDoc = JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Original line' }] }],
      })
      const competingRemoteDoc = JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Competing remote edit' }] }],
      })
      expect(reconcileExternalUpdate(input({
        baseContent: baseDoc,
        localContent: typedDoc,
        remoteContent: competingRemoteDoc,
        hasPendingPush: true,
        syncStatus: 'pending',
      }))).toEqual({ action: 'conflict' })
    })
  })
})
