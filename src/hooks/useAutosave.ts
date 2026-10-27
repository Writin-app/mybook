import { useCallback, useEffect, useRef, useState } from 'react'

import { fileRepository } from '../database/repositories'
import { isLocalWorkspace } from '../stores/useWorkspaceStore'
import type { EditorSaveStatus, MyBookFile } from '../types/files'

const SAVE_DELAY = 250

export function useAutosave(file: MyBookFile | undefined) {
  const [content, setContent] = useState('')
  const [isHydrated, setIsHydrated] = useState(false)
  const [hydratedFileId, setHydratedFileId] = useState<string | null>(null)
  const [status, setStatus] = useState<EditorSaveStatus>(
    isLocalWorkspace() ? 'local' : (file?.syncStatus ?? (navigator.onLine ? 'backed-up' : 'offline'))
  )
  const lastSaved = useRef(file?.content ?? '')
  const contentRef = useRef(content)
  const fileRef = useRef(file)
  const hydratedFileIdRef = useRef<string | null>(null)
  const inFlightContentRef = useRef<string | null>(null)
  const inFlightPromiseRef = useRef<Promise<boolean> | null>(null)
  const replaceEpochRef = useRef(0)
  const saveTimeoutRef = useRef<number | null>(null)
  const statusResetTimeoutRef = useRef<number | null>(null)
  const staleBaselineRef = useRef<{ updatedAt?: string; content?: string } | null>(null)
  const isMountedRef = useRef(true)

  const safeSetStatus = useCallback((next: EditorSaveStatus | ((prev: EditorSaveStatus) => EditorSaveStatus)) => {
    if (isMountedRef.current && typeof window !== 'undefined') {
      setStatus(next)
    }
  }, [])

  useEffect(() => { fileRef.current = file }, [file])
  useEffect(() => {
    if (!file) return
    const isNewFile = hydratedFileIdRef.current !== file.id
    const next = file.content

    if (isNewFile) {
      staleBaselineRef.current = null
      const previousFileId = hydratedFileIdRef.current
      if (previousFileId && contentRef.current !== lastSaved.current) {
        // Persist edits that were still waiting for the autosave delay to the file they belong to.
        void fileRepository.update(previousFileId, { content: contentRef.current, syncStatus: isLocalWorkspace() ? 'local' : 'pending' })
      }
      setIsHydrated(false)
      hydratedFileIdRef.current = file.id
      setContent(next)
      setHydratedFileId(file.id)
      contentRef.current = next
      lastSaved.current = next
      setStatus(isLocalWorkspace() ? 'local' : (file.syncStatus ?? (navigator.onLine ? 'backed-up' : 'offline')))
      setIsHydrated(true)
      return
    }

    if (next === contentRef.current) {
      lastSaved.current = next
      return
    }

    if (contentRef.current === lastSaved.current) {
      if (next || !contentRef.current) {
        setContent(next)
        contentRef.current = next
        lastSaved.current = next
      }
    }
    // Under active unsaved typing (contentRef.current !== lastSaved.current),
    // preserve the editor buffer without clobbering or raising false alarms.
    setIsHydrated(true)
  }, [file])

  const save = useCallback(async () => {
    const currentFile = fileRef.current
    if (!currentFile || contentRef.current === lastSaved.current) return true
    if (inFlightPromiseRef.current !== null) {
      // An update is already in flight. A trailing save will be scheduled when it finishes.
      return inFlightPromiseRef.current
    }

    const savingContent = contentRef.current
    const epoch = replaceEpochRef.current
    const expectedUpdatedAt = currentFile.updatedAt
    const expectedContent = lastSaved.current
    inFlightContentRef.current = savingContent
    if (typeof window === 'undefined') return true
    safeSetStatus('saving-locally')

    const flight = (async () => {
      const result = await fileRepository.update(
        currentFile.id,
        {
          content: savingContent,
          syncStatus: isLocalWorkspace() ? 'local' : 'pending',
        },
        { expectedUpdatedAt, expectedContent }
      )

      if (!isMountedRef.current || typeof window === 'undefined') {
        inFlightContentRef.current = null
        if (result.success) {
          lastSaved.current = savingContent
        }
        return result.success
      }

      if (replaceEpochRef.current !== epoch || result.stale) {
        inFlightContentRef.current = null
        if (replaceEpochRef.current === epoch && isMountedRef.current && typeof window !== 'undefined') {
          safeSetStatus(isLocalWorkspace() ? 'local' : (fileRef.current?.syncStatus ?? (navigator.onLine ? 'pending' : 'offline')))
          if (result.stale) {
            const currentFileRef = fileRef.current
            const alreadyRefreshed =
              currentFileRef &&
              currentFileRef.updatedAt !== expectedUpdatedAt &&
              currentFileRef.content === lastSaved.current

            if (alreadyRefreshed) {
              staleBaselineRef.current = null
              if (contentRef.current !== lastSaved.current) {
                if (saveTimeoutRef.current !== null) {
                  window.clearTimeout(saveTimeoutRef.current)
                }
                saveTimeoutRef.current = window.setTimeout(() => {
                  saveTimeoutRef.current = null
                  void save()
                }, SAVE_DELAY)
              }
            } else {
              staleBaselineRef.current = { updatedAt: expectedUpdatedAt, content: expectedContent }
            }
          }
        }
        return false
      }

      if (!result.success) {
        inFlightContentRef.current = null
        safeSetStatus('failed')
        return false
      }

      lastSaved.current = savingContent
      inFlightContentRef.current = null
      safeSetStatus('saved-locally')
      if (statusResetTimeoutRef.current !== null) {
        window.clearTimeout(statusResetTimeoutRef.current)
      }
      statusResetTimeoutRef.current = window.setTimeout(() => {
        statusResetTimeoutRef.current = null
        if (isMountedRef.current && replaceEpochRef.current === epoch && typeof window !== 'undefined') {
          safeSetStatus(isLocalWorkspace() ? 'local' : (fileRef.current?.syncStatus ?? (navigator.onLine ? 'pending' : 'offline')))
        }
      }, 700)

      if (contentRef.current !== savingContent) {
        // Newer edits were made while the save was in flight. Schedule a follow-up save.
        if (saveTimeoutRef.current !== null) {
          window.clearTimeout(saveTimeoutRef.current)
        }
        saveTimeoutRef.current = window.setTimeout(() => {
          saveTimeoutRef.current = null
          void save()
        }, SAVE_DELAY)
      }

      return true
    })().finally(() => {
      inFlightPromiseRef.current = null
    })

    inFlightPromiseRef.current = flight
    return flight
  }, [safeSetStatus])

  useEffect(() => {
    if (!file) return
    if (staleBaselineRef.current !== null) {
      const baselineRefreshed =
        staleBaselineRef.current.updatedAt === undefined ||
        file.updatedAt !== staleBaselineRef.current.updatedAt

      if (baselineRefreshed && file.content === lastSaved.current) {
        staleBaselineRef.current = null
        if (contentRef.current !== lastSaved.current && saveTimeoutRef.current === null) {
          saveTimeoutRef.current = window.setTimeout(() => {
            saveTimeoutRef.current = null
            void save()
          }, SAVE_DELAY)
        }
      }
    }
  }, [file, save])

  useEffect(() => {
    if (!file || content === lastSaved.current) return
    const timer = window.setTimeout(() => void save(), SAVE_DELAY)
    return () => {
      window.clearTimeout(timer)
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = null
      }
    }
  }, [content, file, save])

  useEffect(() => {
    isMountedRef.current = true
    const flush = () => { void save() }
    const visibility = () => { if (document.visibilityState === 'hidden') flush() }
    const online = () => safeSetStatus('pending')
    const offline = () => { safeSetStatus('offline'); flush() }
    window.addEventListener('pagehide', flush)
    window.addEventListener('beforeunload', flush)
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      isMountedRef.current = false
      if (statusResetTimeoutRef.current !== null) {
        window.clearTimeout(statusResetTimeoutRef.current)
        statusResetTimeoutRef.current = null
      }
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = null
      }
      flush()
      window.removeEventListener('pagehide', flush)
      window.removeEventListener('beforeunload', flush)
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [save, safeSetStatus])

  const changeContent = (value: string) => {
    if (!isMountedRef.current || typeof window === 'undefined') return
    setContent(value)
    contentRef.current = value
    safeSetStatus('editing')
  }

  const replaceContent = useCallback((value: string, nextStatus: EditorSaveStatus = 'saved-locally') => {
    replaceEpochRef.current += 1
    staleBaselineRef.current = null
    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }
    inFlightContentRef.current = null
    setContent(value)
    contentRef.current = value
    lastSaved.current = value
    safeSetStatus(nextStatus)
  }, [safeSetStatus])

  const waitForPendingSave = useCallback(async () => {
    if (inFlightPromiseRef.current) {
      try {
        await inFlightPromiseRef.current
      } catch {
        // Ignore
      }
    }
  }, [])

  const hasUnsavedChanges = useCallback(() => contentRef.current !== lastSaved.current, [])

  return { content, hydratedFileId, isHydrated, status, setContent: changeContent, replaceContent, save, hasUnsavedChanges, waitForPendingSave }
}
