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

  useEffect(() => { fileRef.current = file }, [file])
  useEffect(() => {
    if (!file) return
    const isNewFile = hydratedFileIdRef.current !== file.id
    const next = file.content

    if (isNewFile) {
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
    inFlightContentRef.current = savingContent
    setStatus('saving-locally')

    const flight = (async () => {
      const result = await fileRepository.update(currentFile.id, {
        content: savingContent,
        syncStatus: isLocalWorkspace() ? 'local' : 'pending',
      })

      if (replaceEpochRef.current !== epoch) {
        inFlightContentRef.current = null
        return true
      }

      if (!result.success) {
        inFlightContentRef.current = null
        setStatus('failed')
        return false
      }

      lastSaved.current = savingContent
      inFlightContentRef.current = null
      setStatus('saved-locally')
      window.setTimeout(() => {
        if (replaceEpochRef.current === epoch) {
          setStatus(isLocalWorkspace() ? 'local' : (fileRef.current?.syncStatus ?? (navigator.onLine ? 'pending' : 'offline')))
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
  }, [])

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
    const flush = () => { void save() }
    const visibility = () => { if (document.visibilityState === 'hidden') flush() }
    const online = () => setStatus('pending')
    const offline = () => { setStatus('offline'); flush() }
    window.addEventListener('pagehide', flush)
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    document.addEventListener('visibilitychange', visibility)
    return () => { flush(); window.removeEventListener('pagehide', flush); window.removeEventListener('online', online); window.removeEventListener('offline', offline); document.removeEventListener('visibilitychange', visibility) }
  }, [save])

  const changeContent = (value: string) => {
    setContent(value); contentRef.current = value; setStatus('editing')
  }

  const replaceContent = useCallback((value: string, nextStatus: EditorSaveStatus = 'saved-locally') => {
    replaceEpochRef.current += 1
    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }
    inFlightContentRef.current = null
    setContent(value)
    contentRef.current = value
    lastSaved.current = value
    setStatus(nextStatus)
  }, [])

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
