import { ArrowDownTrayIcon, ArrowLeftIcon, ArrowUpTrayIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/outline'
import { Dropdown } from '../ui/compat-dropdown'
import '@univerjs/preset-sheets-core/lib/index.css'
import UniverPresetSheetsCoreEnUS from '@univerjs/preset-sheets-core/locales/en-US'
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core'
import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type Key } from 'react'
import { useNavigate } from 'react-router-dom'

import { fileRepository } from '../../database/repositories'
import { useAutosave } from '../../hooks/useAutosave'
import { useLibraryData } from '../../hooks/useLibraryData'
import { backupSpreadsheetToDrive, copyDriveFileLink, openDriveFileInBrowser } from '../../services/googleDrive'
import { registerUnsavedEditsProbe } from '../../services/localEditState'
import type { UniverWorkbookSnapshot, XlsxResult } from '../../utils/xlsx'
import { AppButton } from '../common/AppButton'
import { EmptyState } from '../common/EmptyState'
import { EditorStatus } from '../document-editor/EditorStatus'
import { DeleteFileDialog } from '../files/DeleteFileDialog'
import { FolderBreadcrumb } from '../files/FolderBreadcrumb'
import { toast } from '../ui/toast'
import { deletedToast } from '../../utils/deleteToast'

function workbookData(content: string, id: string, name: string) {
  if (content) {
    try { return JSON.parse(content) as object } catch { /* Use a clean workbook below. */ }
  }
  return { id, name }
}

export function UniverSpreadsheetEditor({ fileId }: { fileId: string }) {
  const navigate = useNavigate()
  const { folders } = useLibraryData()
  const containerRef = useRef<HTMLDivElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const workbookRef = useRef<{ save: () => object } | null>(null)
  const skipCleanupSaveRef = useRef(false)
  const file = useLiveQuery(async () => (await fileRepository.get(fileId)).data, [fileId])
  const { content, hasUnsavedChanges, isHydrated, save, setContent, status } = useAutosave(file)

  useEffect(() => {
    if (!file?.id) return
    return registerUnsavedEditsProbe(file.id, () => hasUnsavedChanges())
  }, [file?.id, hasUnsavedChanges])
  const [editorHeight, setEditorHeight] = useState(() => Math.max(320, (window.visualViewport?.height ?? window.innerHeight) - 72))
  const [workbookRevision, setWorkbookRevision] = useState(0)
  const [xlsxBlob, setXlsxBlob] = useState<Blob | null>(null)
  const [xlsxMessage, setXlsxMessage] = useState<string | null>(null)
  const [xlsxWarnings, setXlsxWarnings] = useState<string[]>([])
  const [isConverting, setIsConverting] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const cloudTimerRef = useRef<number | null>(null)
  const cloudFlightRef = useRef(false)
  const lastBackedUpContentRef = useRef<string | null>(null)
  const lastBackedUpTitleRef = useRef<string | null>(null)
  const lastBackedUpFileIdRef = useRef<string | null>(null)
  const latestSnapshot = useRef('')
  const contentRef = useRef(content)
  const setContentRef = useRef(setContent)
  contentRef.current = content
  setContentRef.current = setContent
  const fileName = file?.name

  useEffect(() => {
    const viewport = window.visualViewport
    const resize = () => setEditorHeight(Math.max(320, (viewport?.height ?? window.innerHeight) - 72))
    viewport?.addEventListener('resize', resize)
    window.addEventListener('resize', resize)
    return () => { viewport?.removeEventListener('resize', resize); window.removeEventListener('resize', resize) }
  }, [])

  useEffect(() => {
    if (!fileId || !fileName || !isHydrated || !containerRef.current) return
    const { univer, univerAPI } = createUniver({
      locale: LocaleType.EN_US,
      locales: { [LocaleType.EN_US]: mergeLocales(UniverPresetSheetsCoreEnUS) },
      presets: [UniverSheetsCorePreset({
        container: containerRef.current,
        formulaBar: true,
        header: false,
        toolbar: true,
        footer: {
          sheetBar: true,
          statisticBar: true,
          menus: true,
          zoomSlider: true,
          addSheetButtonConfig: { show: true },
        },
        disableTextFormatAlert: true,
      })],
    })
    const workbook = univerAPI.createWorkbook(workbookData(contentRef.current, fileId, fileName))
    workbookRef.current = workbook
    skipCleanupSaveRef.current = false
    latestSnapshot.current = JSON.stringify(workbook.save())
    const commandSubscription = univerAPI.addEvent(univerAPI.Event.CommandExecuted, () => {
      const snapshot = JSON.stringify(workbook.save())
      if (snapshot === latestSnapshot.current) return
      latestSnapshot.current = snapshot
      setContentRef.current(snapshot)
    })

    return () => {
      const snapshot = JSON.stringify(workbook.save())
      if (!skipCleanupSaveRef.current && snapshot !== latestSnapshot.current) setContentRef.current(snapshot)
      workbookRef.current = null
      commandSubscription.dispose()
      univer.dispose()
    }
  }, [fileId, fileName, isHydrated, workbookRevision])

  if (file && lastBackedUpFileIdRef.current !== file.id) {
    lastBackedUpFileIdRef.current = file.id
    if (file.syncStatus === 'backed-up') {
      lastBackedUpContentRef.current = file.content
      lastBackedUpTitleRef.current = file.name
    } else {
      lastBackedUpContentRef.current = null
      lastBackedUpTitleRef.current = null
    }
  }

  useEffect(() => {
    if (!file || file.isDeleted || file.type !== 'spreadsheet' || !isHydrated || file.workspaceType === 'local' || file.syncStatus === 'local') return
    if (cloudTimerRef.current !== null) window.clearTimeout(cloudTimerRef.current)

    const hasUnsyncedChanges =
      file.syncStatus === 'pending' ||
      status === 'saved-locally' ||
      content !== (lastBackedUpContentRef.current ?? '') ||
      file.name !== (lastBackedUpTitleRef.current ?? '')

    if (!hasUnsyncedChanges || file.syncStatus === 'backed-up') return

    cloudTimerRef.current = window.setTimeout(() => {
      if (cloudFlightRef.current || !file || file.isDeleted) return
      cloudFlightRef.current = true
      void (async () => {
        try {
          const saved = await save()
          if (!saved) return
          const latest = await fileRepository.get(file.id)
          const latestFile = latest.data
          if (!latestFile) return
          const result = await backupSpreadsheetToDrive({ fileId: file.id, title: latestFile.name, content: latestFile.content, folderId: latestFile.folderId })
          if (result.success) {
            lastBackedUpContentRef.current = latestFile.content
            lastBackedUpTitleRef.current = latestFile.name
          } else {
            toast.add({ title: "Couldn't sync", description: result.error, type: 'error', priority: 'low' })
          }
        } finally {
          cloudFlightRef.current = false
        }
      })()
    }, 3000)
    return () => {
      if (cloudTimerRef.current !== null) window.clearTimeout(cloudTimerRef.current)
      cloudTimerRef.current = null
    }
  }, [content, file, isHydrated, save, status])

  if (file === undefined) return <div role="status" className="p-4 text-muted-foreground">Loading spreadsheet…</div>
  if (!file || file.isDeleted) return <EmptyState title="Spreadsheet not found" description="This spreadsheet may have been moved to Trash or deleted." />

  const navigateBack = () => {
    if (typeof window !== 'undefined' && window.history.state && typeof window.history.state.idx === 'number' && window.history.state.idx > 0) {
      navigate(-1)
    } else {
      navigate(file.folderId ? `/folders/${file.folderId}` : '/home')
    }
  }
  const close = async () => { await save(); navigateBack() }
  const deleteSpreadsheet = async () => {
    await save()
    const result = await fileRepository.delete(file.id)
    if (!result.success) return
    navigate(file.folderId ? `/folders/${file.folderId}` : '/home')
    toast.add(deletedToast({
      itemName: file.name,
      onUndo: () => { void fileRepository.restore(file.id) },
    }))
  }
  const duplicateSpreadsheet = async () => {
    await save()
    const result = await fileRepository.duplicate(file.id)
    if (result.data) navigate(`/spreadsheet/${result.data.id}`)
  }

  const makeXlsx = async (shouldDownload: boolean) => {
    const snapshot = workbookRef.current?.save() as UniverWorkbookSnapshot | undefined
    if (!snapshot) { setXlsxMessage('The spreadsheet is not ready yet.'); return }
    setIsConverting(true)
    setXlsxMessage(null)
    try {
      const { downloadXlsx, exportWorkbookToXlsx } = await import('../../utils/xlsx')
      const result = await exportWorkbookToXlsx(snapshot)
      setXlsxWarnings(result.warnings)
      if (!result.success || !result.data) { setXlsxMessage(result.error ?? 'Could not export this spreadsheet.'); return }
      setXlsxBlob(result.data)
      if (shouldDownload) downloadXlsx(result.data, file.name)
      setXlsxMessage(shouldDownload ? 'XLSX downloaded.' : 'XLSX is ready for backup.')
    } catch {
      setXlsxMessage('Could not export this spreadsheet.')
    } finally { setIsConverting(false) }
  }

  const importXlsx = async (selected: File | undefined) => {
    if (!selected) return
    setIsConverting(true)
    setXlsxMessage(null)
    setXlsxWarnings([])
    try {
      const { importXlsxToWorkbook } = await import('../../utils/xlsx')
      const result: XlsxResult<UniverWorkbookSnapshot> = await importXlsxToWorkbook(selected, fileId)
      if (!result.success || !result.data) { setXlsxMessage(result.error ?? 'Could not import this XLSX file.'); return }
      const snapshot = JSON.stringify(result.data)
      skipCleanupSaveRef.current = true
      latestSnapshot.current = snapshot
      setContent(snapshot)
      setXlsxBlob(null)
      setXlsxWarnings(result.warnings)
      setXlsxMessage(`Imported ${selected.name}.`)
      setWorkbookRevision((revision) => revision + 1)
    } catch {
      setXlsxMessage('The XLSX file is invalid or unsupported.')
    } finally {
      if (importInputRef.current) importInputRef.current.value = ''
      setIsConverting(false)
    }
  }

  const backupNow = async () => {
    if (!file) return
    const snapshot = workbookRef.current?.save() as UniverWorkbookSnapshot | undefined
    if (!snapshot) { toast.add({ title: 'Spreadsheet is not ready yet', type: 'warning', priority: 'low' }); return }
    setContent(JSON.stringify(snapshot))
    await save()
    const latest = (await fileRepository.get(file.id)).data
    if (!latest) return
    const result = await backupSpreadsheetToDrive({ fileId: latest.id, title: latest.name, content: latest.content, folderId: latest.folderId })
    if (result.success) {
      lastBackedUpContentRef.current = latest.content
      lastBackedUpTitleRef.current = latest.name
    } else {
      toast.add({ title: "Couldn't sync", description: result.error ?? 'Sync failed.', type: 'error', priority: 'low' })
    }
  }

  const copyDriveLink = async () => {
    if (!file.driveFileId) return
    const result = await copyDriveFileLink(file.driveFileId)
    toast.add({
      title: result.success ? 'Backup link copied' : 'Could not copy the backup link',
      description: result.success ? undefined : result.error,
      type: result.success ? 'success' : 'error',
      priority: 'low',
    })
  }
  const handleMenuAction = (key: Key) => {
    if (key === 'save') void save()
    if (key === 'backup') void backupNow()
    if (key === 'copy-link') void copyDriveLink()
    if (key === 'open-drive' && file?.driveFileId) void openDriveFileInBrowser(file.driveFileId)
    if (key === 'download-local') void makeXlsx(true)
    if (key === 'import') importInputRef.current?.click()
    if (key === 'duplicate') void duplicateSpreadsheet()
    if (key === 'export') void makeXlsx(false)
    if (key === 'download') void makeXlsx(true)
    if (key === 'delete') setIsDeleteDialogOpen(true)
    if (key === 'close') void close()
  }
  const localSaveStatusActive = status === 'editing' || status === 'saving-locally' || status === 'saved-locally'
  const editorStatus = localSaveStatusActive ? status : file.syncStatus
  const editorStatusWorkspace = file.workspaceType === 'local' || file.syncStatus === 'local' ? 'local' : 'drive'

  return (
    <section className="-mx-4 -my-6 flex min-h-0 flex-col sm:-mx-6 lg:-mx-8" style={{ height: editorHeight }}>
      <header className="z-30 flex min-h-16 shrink-0 items-center gap-2 border-b border-[var(--app-border)] bg-background px-2 sm:px-4">
        <button type="button" onClick={() => void close()} aria-label="Close spreadsheet" className="flex size-11 shrink-0 items-center justify-center rounded-[10px]"><ArrowLeftIcon aria-hidden="true" className="size-5" /></button>
        <div className="min-w-0 flex-1"><h1 className="truncate text-base font-semibold">{file.name}</h1><EditorStatus status={editorStatus} workspace={editorStatusWorkspace} onRetry={() => void backupNow()} /><div className="mt-1 hidden md:block"><FolderBreadcrumb currentFolderId={file.folderId} folders={folders} currentPageLabel={file.name} onNavigate={navigate} /></div></div>
        <Dropdown>
          <Dropdown.Trigger aria-label="More spreadsheet actions" className="flex size-11 items-center justify-center rounded-[10px]">
            <EllipsisHorizontalIcon aria-hidden="true" className="size-6" />
          </Dropdown.Trigger>
          <Dropdown.Popover placement="bottom end">
            <Dropdown.Menu aria-label="Spreadsheet actions" onAction={handleMenuAction}>
              <Dropdown.Item id="save">Save now</Dropdown.Item>
              <Dropdown.Item id="backup">Sync now</Dropdown.Item>
              <Dropdown.Item id="open-drive" isDisabled={!file.driveFileId}>Open backup in Drive</Dropdown.Item>
              <Dropdown.Item id="copy-link" isDisabled={!file.driveFileId}>Copy backup link</Dropdown.Item>
              <Dropdown.Item id="duplicate">Duplicate</Dropdown.Item>
              <Dropdown.Item id="download-local">Download local copy</Dropdown.Item>
              <Dropdown.Item id="import">
                <span className="flex items-center gap-2">
                  <ArrowUpTrayIcon aria-hidden="true" className="size-5" />
                  Import XLSX
                </span>
              </Dropdown.Item>
              <Dropdown.Item id="export">Export XLSX</Dropdown.Item>
              <Dropdown.Item id="download">
                <span className="flex items-center gap-2">
                  <ArrowDownTrayIcon aria-hidden="true" className="size-5" />
                  Download XLSX
                </span>
              </Dropdown.Item>
              <Dropdown.Item id="delete" variant="danger">Move to Trash</Dropdown.Item>
              <Dropdown.Item id="close">Close spreadsheet</Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
        <AppButton className="hidden sm:flex" variant="secondary" onPress={() => void save()}>Save</AppButton>
        <AppButton className="hidden sm:flex" variant="secondary" onPress={() => void backupNow()}>Sync now</AppButton>
        <AppButton className="hidden sm:flex" variant="secondary" isDisabled={!file.driveFileId} onPress={() => file.driveFileId ? openDriveFileInBrowser(file.driveFileId) : undefined}>Open backup</AppButton>
      </header>
      <input ref={importInputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" aria-label="Import XLSX file" onChange={(event) => void importXlsx(event.target.files?.[0])} />
      {(isConverting || xlsxMessage || xlsxWarnings.length > 0) && (
        <div className="shrink-0 border-b border-[var(--app-border)] bg-background px-4 py-2 text-sm" role={xlsxMessage?.toLowerCase().includes('could not') || xlsxMessage?.toLowerCase().includes('invalid') ? 'alert' : 'status'}>
          <p className="font-medium">{isConverting ? 'Processing XLSX…' : xlsxMessage}</p>
          {xlsxWarnings.map((warning) => <p key={warning} className="mt-1 text-yellow-700 dark:text-yellow-300">{warning}</p>)}
          {xlsxBlob && <span className="sr-only">Prepared XLSX size: {xlsxBlob.size} bytes.</span>}
        </div>
      )}
      <div ref={containerRef} className="univer-mobile min-h-0 flex-1 overflow-hidden bg-white" role="region" aria-label="Spreadsheet editor. Use the spreadsheet toolbar and cell controls to edit." />
      <DeleteFileDialog
        isOpen={isDeleteDialogOpen}
        fileName={file.name}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={() => { void deleteSpreadsheet() }}
      />
    </section>
  )
}
