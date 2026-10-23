import { useEffect, useRef } from 'react'

import { refreshDriveFileToLocal } from '../services/googleDrive'
import { useAuthStore } from '../stores/useAuthStore'
import { isLocalWorkspace } from '../stores/useWorkspaceStore'

interface UseDriveLiveSyncOptions {
  enabled?: boolean
  intervalMs?: number
  isEditing?: boolean
}

export function useDriveLiveSync(
  fileId: string | undefined,
  driveFileId: string | null | undefined,
  options: UseDriveLiveSyncOptions = {}
) {
  const { enabled = true, intervalMs = 2500, isEditing = false } = options
  const isSyncingRef = useRef(false)
  const isEditingRef = useRef(isEditing)
  isEditingRef.current = isEditing

  useEffect(() => {
    if (!fileId || !driveFileId || !enabled) return

    const checkSync = async () => {
      if (
        !navigator.onLine ||
        isLocalWorkspace() ||
        !useAuthStore.getState().isAuthenticated ||
        document.visibilityState === 'hidden' ||
        isEditingRef.current ||
        isSyncingRef.current
      ) {
        return
      }

      isSyncingRef.current = true
      try {
        await refreshDriveFileToLocal(fileId)
      } catch {
        // Silently catch background poll failures
      } finally {
        isSyncingRef.current = false
      }
    }

    const timer = window.setInterval(() => {
      void checkSync()
    }, intervalMs)

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        void checkSync()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityOrFocus)
    window.addEventListener('focus', handleVisibilityOrFocus)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus)
      window.removeEventListener('focus', handleVisibilityOrFocus)
    }
  }, [fileId, driveFileId, enabled, intervalMs])
}
