import { create } from 'zustand'

import { db } from '../database/db'
import { processPendingDriveSync } from '../database/repositories'
import { flushAllUnsavedEdits } from '../services/localEditState'

interface PwaState {
  needRefresh: boolean
  setNeedRefresh: (value: boolean) => void
  isUpdating: boolean
  updateProgress: number
  updateStatusMessage: string | null
  registration: ServiceWorkerRegistration | null
  setRegistration: (reg: ServiceWorkerRegistration | null) => void
  updateServiceWorkerFn: ((reloadPage?: boolean) => Promise<void>) | null
  setUpdateServiceWorkerFn: (fn: ((reloadPage?: boolean) => Promise<void>) | null) => void
  checkForUpdates: () => Promise<boolean>
  startUpdate: () => Promise<void>
}

export const usePwaStore = create<PwaState>((set, get) => ({
  needRefresh: false,
  setNeedRefresh: (value) => set({ needRefresh: value }),
  isUpdating: false,
  updateProgress: 0,
  updateStatusMessage: null,
  registration: null,
  setRegistration: (reg) => set({ registration: reg }),
  updateServiceWorkerFn: null,
  setUpdateServiceWorkerFn: (fn) => set({ updateServiceWorkerFn: fn }),

  checkForUpdates: async () => {
    const reg = get().registration
    if (reg) {
      try {
        await reg.update()
        if (reg.waiting) {
          set({ needRefresh: true })
          return true
        }
      } catch {
        // Ignore check failure
      }
    } else if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const activeReg = await navigator.serviceWorker.ready
        set({ registration: activeReg })
        await activeReg.update()
        if (activeReg.waiting) {
          set({ needRefresh: true })
          return true
        }
      } catch {
        // Ignore check failure
      }
    }
    return false
  },

  startUpdate: async () => {
    if (get().isUpdating) return
    set({
      isUpdating: true,
      updateProgress: 25,
      updateStatusMessage: 'Saving open documents locally…',
    })

    try {
      // 1. Flush any active unsaved edits in open editors into IndexedDB
      await flushAllUnsavedEdits()
      set({ updateProgress: 50, updateStatusMessage: 'Flushing local storage…' })

      // Short delay for IndexedDB transaction settlement
      await new Promise((resolve) => setTimeout(resolve, 150))

      // 2. Check if there are queued sync items to push if online
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          const pendingItems = await db.syncQueue
            .filter((item) => item.status === 'pending' || item.status === 'failed')
            .count()
          if (pendingItems > 0) {
            set({ updateProgress: 70, updateStatusMessage: 'Syncing pending changes to cloud…' })
            await Promise.race([
              processPendingDriveSync(),
              new Promise((resolve) => setTimeout(resolve, 2000)),
            ])
          }
        } catch {
          // If sync fails or takes too long, continue with local safety guaranteed
        }
      }

      // 3. Command the waiting service worker to activate
      set({ updateProgress: 85, updateStatusMessage: 'Activating latest version…' })
      const fn = get().updateServiceWorkerFn
      if (fn) {
        await fn(true)
      }

      set({ updateProgress: 100, updateStatusMessage: 'Reloading Writin…' })
      // Fallback reload in case controllerchange listener was missed or delayed
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.reload()
        }
      }, 1500)
    } catch (error) {
      console.error('Update encountered an issue; reloading safely.', error)
      if (typeof window !== 'undefined') {
        window.location.reload()
      }
    }
  },
}))
