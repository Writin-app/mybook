import { useState, useMemo, useEffect } from 'react'
import { CloudIcon, FolderIcon, ArrowPathIcon, CheckIcon } from '@heroicons/react/24/outline'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import {
  canPickDeviceDirectory,
  findFolderConflict,
  pickLocalWorkspaceDirectory,
  type LocalWorkspaceStoragePreference,
  type PickedLocalWorkspaceDirectory,
} from '../../services/localWorkspace'
import {
  createCloudWorkspaceAction,
  createLocalWorkspaceAction,
} from '../../services/workspaceManager'
import { findDriveRootFolderByName, listExistingDriveVaults, type DriveVaultSummary } from '../../services/googleDrive'
import { useAuthStore } from '../../stores/useAuthStore'
import { toast } from '../ui/toast'

interface WorkspaceModalProps {
  isOpen: boolean
  onClose: () => void
  onWorkspaceCreated?: () => void
  initialTab?: 'cloud' | 'local'
}

export function WorkspaceModal({ isOpen, onClose, onWorkspaceCreated, initialTab = 'cloud' }: WorkspaceModalProps) {
  const { isAuthenticated } = useAuthStore()
  const supportsDeviceFolder = useMemo(() => canPickDeviceDirectory(), [])
  
  const [activeTab, setActiveTab] = useState<'cloud' | 'local'>(isAuthenticated ? initialTab : 'local')
  
  // Cloud form state
  const [cloudMode, setCloudMode] = useState<'create' | 'select'>('create')
  const [cloudName, setCloudName] = useState('')
  const [checkedCloudName, setCheckedCloudName] = useState('')
  const [cloudNameConflict, setCloudNameConflict] = useState<string | null>(null)
  const [isCheckingCloudName, setIsCheckingCloudName] = useState(false)
  const [cloudNameCheckError, setCloudNameCheckError] = useState<string | null>(null)
  const [existingVaults, setExistingVaults] = useState<DriveVaultSummary[]>([])
  const [selectedVaultId, setSelectedVaultId] = useState<string | null>(null)
  const [selectedVaultName, setSelectedVaultName] = useState('')
  const [isLoadingVaults, setIsLoadingVaults] = useState(false)
  const [cloudMirrorDirectory, setCloudMirrorDirectory] = useState<PickedLocalWorkspaceDirectory | null>(null)
  const [shouldMirrorCloud, setShouldMirrorCloud] = useState(false)
  
  // Local form state
  const [localName, setLocalName] = useState('')
  const [localStoragePreference, setLocalStoragePreference] = useState<LocalWorkspaceStoragePreference>(
    supportsDeviceFolder ? 'file-system' : 'private'
  )
  const [selectedLocalDirectory, setSelectedLocalDirectory] = useState<PickedLocalWorkspaceDirectory | null>(null)
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const normalizedCloudName = (cloudName.trim() || 'Writin').toLocaleLowerCase()
  const shouldCheckCloudName = isOpen && activeTab === 'cloud' && isAuthenticated && cloudMode === 'create'
  const canCreateCloudName = checkedCloudName === normalizedCloudName && !cloudNameConflict && !cloudNameCheckError && !isCheckingCloudName

  useEffect(() => {
    if (!shouldCheckCloudName) {
      setIsCheckingCloudName(false)
      return
    }

    let cancelled = false
    setCheckedCloudName('')
    setCloudNameConflict(null)
    setCloudNameCheckError(null)
    setIsCheckingCloudName(true)
    const timeout = window.setTimeout(() => {
      void findDriveRootFolderByName(cloudName.trim() || 'Writin').then((folder) => {
        if (cancelled) return
        setCloudNameConflict(folder?.name ?? null)
        setCheckedCloudName(normalizedCloudName)
      }).catch(() => {
        if (cancelled) return
        setCloudNameCheckError('Could not check Google Drive for an existing root folder. Try again.')
        setCheckedCloudName(normalizedCloudName)
      }).finally(() => {
        if (!cancelled) setIsCheckingCloudName(false)
      })
    }, 300)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [cloudName, isAuthenticated, isOpen, activeTab, cloudMode, normalizedCloudName, shouldCheckCloudName])

  const handleOpenExistingVaults = async () => {
    if (!isAuthenticated) return
    setIsLoadingVaults(true)
    setErrorMessage(null)
    try {
      const vaults = await listExistingDriveVaults()
      setExistingVaults(vaults)
      if (vaults.length > 0 && vaults[0]) {
        setSelectedVaultId(vaults[0].id)
        setSelectedVaultName(vaults[0].name)
      }
    } catch {
      setErrorMessage('Could not load Google Drive vaults.')
    } finally {
      setIsLoadingVaults(false)
    }
  }

  const handleBrowseCloudMirror = async () => {
    setErrorMessage(null)
    try {
      const picked = await pickLocalWorkspaceDirectory()
      if (picked) {
        const conflict = await findFolderConflict(picked.handle)
        if (conflict) {
          setErrorMessage(
            `This folder is already used by “${conflict.vaultName}” (${conflict.kind === 'cloud-mirror' ? 'Cloud mirror' : 'Local vault'}). Please choose a different empty folder.`,
          )
          return
        }
        setCloudMirrorDirectory(picked)
        setShouldMirrorCloud(true)
      }
    } catch {
      // Ignored
    }
  }

  const handleBrowseLocalFolder = async () => {
    setErrorMessage(null)
    try {
      const picked = await pickLocalWorkspaceDirectory()
      if (picked) {
        const conflict = await findFolderConflict(picked.handle)
        if (conflict) {
          setErrorMessage(
            `This folder is already used by “${conflict.vaultName}” (${conflict.kind === 'cloud-mirror' ? 'Cloud mirror' : 'Local vault'}). Please choose a different empty folder.`,
          )
          return
        }
        setSelectedLocalDirectory(picked)
        setLocalStoragePreference('file-system')
        if (!localName.trim()) {
          setLocalName(picked.name)
        }
      }
    } catch {
      // Ignored
    }
  }

  const handleCreateCloud = async () => {
    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      if (cloudMode === 'select' && selectedVaultId) {
        await createCloudWorkspaceAction(selectedVaultName, shouldMirrorCloud ? cloudMirrorDirectory?.handle : undefined)
        toast.add({
          title: 'Workspace Connected',
          description: `Switched to "${selectedVaultName}" Google Drive workspace.`,
          type: 'success',
          priority: 'low',
        })
      } else {
        const name = cloudName.trim() || 'Writin'
        const existingFolder = await findDriveRootFolderByName(name)
        if (existingFolder) {
          setCloudNameConflict(existingFolder.name)
          setCheckedCloudName(name.toLocaleLowerCase())
          return
        }
        await createCloudWorkspaceAction(name, shouldMirrorCloud ? cloudMirrorDirectory?.handle : undefined)
        toast.add({
          title: 'Workspace Created',
          description: `Created and switched to "${name}" workspace.`,
          type: 'success',
          priority: 'low',
        })
      }
      onWorkspaceCreated?.()
      onClose()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not create cloud workspace.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateLocal = async () => {
    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      if (localStoragePreference === 'file-system' && !selectedLocalDirectory) {
        setErrorMessage('Please browse and choose a folder on this device.')
        setIsSubmitting(false)
        return
      }
      const name = localName.trim() || selectedLocalDirectory?.name || 'Local Vault'
      await createLocalWorkspaceAction({
        name,
        directoryHandle: selectedLocalDirectory?.handle,
        storagePreference: localStoragePreference,
      })
      toast.add({
        title: 'Local Workspace Created',
        description: `Switched to "${name}" local vault.`,
        type: 'success',
        priority: 'low',
      })
      onWorkspaceCreated?.()
      onClose()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not create local workspace.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Add New Workspace</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Create a separate workspace for your documents and spreadsheets.
          </DialogDescription>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-muted p-1 text-sm font-medium">
          <button
            type="button"
            disabled={!isAuthenticated}
            onClick={() => {
              setActiveTab('cloud')
              setErrorMessage(null)
            }}
            className={`flex items-center justify-center gap-2 rounded-lg py-2 transition ${
              activeTab === 'cloud'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground disabled:opacity-40'
            }`}
          >
            <CloudIcon className="size-4" />
            <span>Google Drive</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('local')
              setErrorMessage(null)
            }}
            className={`flex items-center justify-center gap-2 rounded-lg py-2 transition ${
              activeTab === 'local'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FolderIcon className="size-4" />
            <span>Local Device</span>
          </button>
        </div>

        {errorMessage ? (
          <p role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            {errorMessage}
          </p>
        ) : null}

        {/* Cloud Workspace Tab */}
        {activeTab === 'cloud' && isAuthenticated && (
          <div className="mt-4 space-y-4">
            <div className="flex gap-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setCloudMode('create')}
                className={`rounded-lg px-3 py-1.5 transition ${
                  cloudMode === 'create' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                Create New Vault
              </button>
              <button
                type="button"
                onClick={() => {
                  setCloudMode('select')
                  void handleOpenExistingVaults()
                }}
                className={`rounded-lg px-3 py-1.5 transition ${
                  cloudMode === 'select' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                Connect Existing Drive Vault
              </button>
            </div>

            {cloudMode === 'create' ? (
              <div>
                <label htmlFor="cloud-workspace-name" className="block text-sm font-medium text-foreground">
                  Workspace Name
                </label>
                <input
                  id="cloud-workspace-name"
                  type="text"
                  placeholder="e.g. Work, Personal, Projects"
                  value={cloudName}
                  onChange={(e) => {
                    setCloudName(e.target.value)
                    setErrorMessage(null)
                  }}
                  aria-invalid={Boolean(cloudNameConflict || cloudNameCheckError)}
                  aria-describedby={cloudNameConflict || cloudNameCheckError || isCheckingCloudName ? 'cloud-workspace-name-status' : undefined}
                  className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {cloudNameConflict ? (
                  <p id="cloud-workspace-name-status" role="alert" className="mt-2 text-xs text-destructive">A Drive root folder named “{cloudNameConflict}” already exists. Choose another name or connect to the existing vault.</p>
                ) : cloudNameCheckError ? (
                  <p id="cloud-workspace-name-status" role="alert" className="mt-2 text-xs text-destructive">{cloudNameCheckError}</p>
                ) : isCheckingCloudName ? (
                  <p id="cloud-workspace-name-status" role="status" className="mt-2 text-xs text-muted-foreground">Checking Drive root for this name…</p>
                ) : null}
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-foreground">Select Drive Folder</label>
                {isLoadingVaults ? (
                  <div className="mt-2 flex items-center justify-center py-4 text-xs text-muted-foreground">
                    <ArrowPathIcon className="mr-2 size-4 animate-spin" />
                    Scanning Google Drive...
                  </div>
                ) : existingVaults.length > 0 ? (
                  <div className="mt-1.5 max-h-36 space-y-1 overflow-y-auto rounded-lg border border-input p-1">
                    {existingVaults.map((vault) => (
                      <button
                        key={vault.id}
                        type="button"
                        onClick={() => {
                          setSelectedVaultId(vault.id)
                          setSelectedVaultName(vault.name)
                        }}
                        className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm transition ${
                          selectedVaultId === vault.id ? 'bg-primary/10 font-semibold text-primary' : 'hover:bg-muted'
                        }`}
                      >
                        <span className="truncate">{vault.name}</span>
                        {selectedVaultId === vault.id && <CheckIcon className="size-4" />}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">No existing vaults found. You can create a new vault above.</p>
                )}
              </div>
            )}

            {/* Optional local folder mirroring for cloud */}
            {supportsDeviceFolder && (
              <div className="rounded-xl border border-border p-3">
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={shouldMirrorCloud}
                    onChange={(e) => {
                      setShouldMirrorCloud(e.target.checked)
                      if (e.target.checked && !cloudMirrorDirectory) {
                        void handleBrowseCloudMirror()
                      }
                    }}
                    className="mt-0.5 size-4 accent-primary"
                  />
                  <div>
                    <span className="text-sm font-medium text-foreground">Mirror to a folder on this computer</span>
                    <p className="text-xs text-muted-foreground">
                      Two-way sync: saves markdown files directly to your hard drive and syncs them to Google Drive.
                    </p>
                  </div>
                </label>
                {shouldMirrorCloud && (
                  <div className="mt-2 flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-xs">
                    <span className="truncate font-medium text-foreground">
                      {cloudMirrorDirectory ? `📁 ${cloudMirrorDirectory.name}` : 'No folder selected'}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleBrowseCloudMirror()}
                      className="rounded bg-background px-2 py-1 font-semibold text-primary shadow-xs hover:bg-muted"
                    >
                      Browse
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting || (cloudMode === 'select' ? !selectedVaultId : !canCreateCloudName)}
                onClick={() => void handleCreateCloud()}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {isSubmitting && <ArrowPathIcon className="size-4 animate-spin" />}
                <span>Create & Switch</span>
              </button>
            </div>
          </div>
        )}

        {/* Local Workspace Tab */}
        {activeTab === 'local' && (
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="local-workspace-name" className="block text-sm font-medium text-foreground">
                Vault Name
              </label>
              <input
                id="local-workspace-name"
                type="text"
                placeholder="e.g. Local Vault, Offline Notes"
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {supportsDeviceFolder ? (
              <div className="space-y-2">
                <label
                  className={`flex cursor-pointer gap-3 rounded-xl border p-3.5 transition ${
                    localStoragePreference === 'file-system'
                      ? 'border-primary ring-1 ring-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="local-storage-pref"
                    value="file-system"
                    checked={localStoragePreference === 'file-system'}
                    onChange={() => setLocalStoragePreference('file-system')}
                    className="mt-0.5 size-4 accent-primary"
                  />
                  <div className="flex-1">
                    <span className="block text-sm font-medium text-foreground">Choose a folder on this device</span>
                    <span className="block text-xs text-muted-foreground">
                      Best for desktop. Saves your files directly onto your hard drive as `.md` documents.
                    </span>
                    {localStoragePreference === 'file-system' && (
                      <div className="mt-2.5 flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-xs">
                        <span className="truncate font-medium text-foreground">
                          {selectedLocalDirectory ? `📁 ${selectedLocalDirectory.name}` : 'No folder chosen'}
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleBrowseLocalFolder()}
                          className="rounded bg-background px-2.5 py-1 font-semibold text-primary shadow-xs hover:bg-muted"
                        >
                          Browse folder
                        </button>
                      </div>
                    )}
                  </div>
                </label>

                <label
                  className={`flex cursor-pointer gap-3 rounded-xl border p-3.5 transition ${
                    localStoragePreference === 'private'
                      ? 'border-primary ring-1 ring-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="local-storage-pref"
                    value="private"
                    checked={localStoragePreference === 'private'}
                    onChange={() => setLocalStoragePreference('private')}
                    className="mt-0.5 size-4 accent-primary"
                  />
                  <div>
                    <span className="block text-sm font-medium text-foreground">Use private device storage</span>
                    <span className="block text-xs text-muted-foreground">
                      Stored in browser database. Works across all devices including mobile Safari and Chrome.
                    </span>
                  </div>
                </label>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Private device storage will be used for this local workspace.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void handleCreateLocal()}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {isSubmitting && <ArrowPathIcon className="size-4 animate-spin" />}
                <span>Create & Switch</span>
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
