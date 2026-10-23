import { Collaboration } from '@tiptap/extension-collaboration'
import { HocuspocusProvider } from '@hocuspocus/provider'
import { useEffect, useMemo, useState } from 'react'
import { IndexeddbPersistence } from 'y-indexeddb'
import * as Y from 'yjs'

import { authApiUrl, isBackendAuthEnabled } from '../stores/useAuthStore'

const collaborationUrl = import.meta.env.VITE_COLLABORATION_URL?.trim() ?? ''

async function requestCollaborationToken() {
  const response = await fetch(authApiUrl('/collab-token'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!response.ok) throw new Error('Sign in is required to sync this document.')
  const result = await response.json() as { token?: string }
  if (!result.token) throw new Error('The sync server did not issue a token.')
  return result.token
}

export function useYjsDocumentSync(fileId: string, accountEmail: string | null) {
  const enabled = Boolean(collaborationUrl && isBackendAuthEnabled && accountEmail)
  const { document, key } = useMemo(() => ({
    document: new Y.Doc(),
    key: `${accountEmail?.toLowerCase() ?? 'local'}:${fileId}`,
  }), [accountEmail, fileId])
  const [syncedDocumentKey, setSyncedDocumentKey] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !accountEmail) return
    let active = true
    const persistence = new IndexeddbPersistence(`writin-yjs:${key}`, document)
    let provider: HocuspocusProvider | null = null
    void persistence.whenSynced.then(() => {
      if (!active) return
      provider = new HocuspocusProvider({
        url: collaborationUrl,
        name: `${accountEmail.toLowerCase()}::${fileId}`,
        document,
        token: requestCollaborationToken,
        onSynced: ({ state }) => {
          if (active && state) setSyncedDocumentKey(key)
        },
        onAuthenticationFailed: () => {
          if (active) setSyncedDocumentKey(null)
        },
      })
    })
    return () => {
      active = false
      setSyncedDocumentKey((current) => current === key ? null : current)
      provider?.destroy()
      void persistence.destroy()
    }
  }, [accountEmail, document, enabled, fileId, key])

  const extension = useMemo(() => enabled
    ? Collaboration.configure({ document, field: 'default' })
    : null, [document, enabled])

  return {
    enabled,
    document,
    extension,
    isSynced: enabled && syncedDocumentKey === key,
  }
}
