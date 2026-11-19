import { useCallback, useEffect, useRef } from 'react'
import {
  checkDeviceDirectoryHandleValid,
  forgetDeviceDirectoryHandle,
  hasReadWritePermission,
  isMissingDirectoryError,
  scanAndHydrateLocalWorkspace,
} from '../services/localWorkspace'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'

export function useLocalMirrorSync() {
  const { bumpWorkspaceRevision, setMirrorFolderMissing } = useWorkspaceStore()
  const lastScanTimeRef = useRef(0)
  const isScanningRef = useRef(false)

  const runLocalScan = useCallback(async (force = false) => {
    if (isScanningRef.current) return
    const now = Date.now()
    if (!force && now - lastScanTimeRef.current < 800) return

    isScanningRef.current = true
    lastScanTimeRef.current = now

    try {
      const validity = await checkDeviceDirectoryHandleValid()
      if (!validity.valid) {
        if (validity.error === 'NotFoundError' || isMissingDirectoryError(validity.error)) {
          await forgetDeviceDirectoryHandle()
          setMirrorFolderMissing(true)
        }
        return
      }

      const handle = validity.handle
      if (!handle) return

      const permitted = await hasReadWritePermission(handle, { request: false })
      if (!permitted) return

      const result = await scanAndHydrateLocalWorkspace(handle)
      if (result.restoredCount > 0 || (result as { deletedCount?: number }).deletedCount! > 0) {
        bumpWorkspaceRevision()
      }
    } catch (error) {
      if (isMissingDirectoryError(error)) {
        const validity = await checkDeviceDirectoryHandleValid()
        if (!validity.valid && isMissingDirectoryError(validity.error)) {
          await forgetDeviceDirectoryHandle()
          setMirrorFolderMissing(true)
        }
      }
    } finally {
      isScanningRef.current = false
    }
  }, [bumpWorkspaceRevision, setMirrorFolderMissing])

  useEffect(() => {
    void runLocalScan(true)

    const handleFocus = () => {
      void runLocalScan(true)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void runLocalScan(true)
      }
    }

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void runLocalScan(false)
      }
    }, 1500)

    window.addEventListener('focus', handleFocus)
    window.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [runLocalScan])
}
