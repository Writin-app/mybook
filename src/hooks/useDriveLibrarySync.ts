import { useEffect, useRef } from 'react'

import { processPendingDriveFolderSync } from '../database/repositories'
import { useAuthStore } from '../stores/useAuthStore'
import { isLocalWorkspace } from '../stores/useWorkspaceStore'
import { importDriveBackupsToLocal } from './useDriveBootstrap'

interface UseDriveLibrarySyncOptions {
  enabled?: boolean
  intervalMs?: number
}

// Keeps the library in step with Drive after bootstrap: retries queued pushes, then pulls new files and folders.
export function useDriveLibrarySync(options: UseDriveLibrarySyncOptions = {}) {
  const { enabled = true, intervalMs = 30000 } = options
  const isSyncingRef = useRef(false)

  useEffect(() => {
    if (!enabled) return

    const sync = async () => {
      if (
        !navigator.onLine ||
        isLocalWorkspace() ||
        !useAuthStore.getState().isAuthenticated ||
        document.visibilityState === 'hidden' ||
        isSyncingRef.current
      ) {
        return
      }

      isSyncingRef.current = true
      try {
        await processPendingDriveFolderSync()
        await importDriveBackupsToLocal()
      } catch {
        // Background sync failures are retried on the next tick
      } finally {
        isSyncingRef.current = false
      }
    }

    const timer = window.setInterval(() => {
      void sync()
    }, intervalMs)

    const handleResume = () => {
      if (document.visibilityState === 'visible') void sync()
    }

    document.addEventListener('visibilitychange', handleResume)
    window.addEventListener('focus', handleResume)
    window.addEventListener('online', handleResume)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', handleResume)
      window.removeEventListener('focus', handleResume)
      window.removeEventListener('online', handleResume)
    }
  }, [enabled, intervalMs])
}
