import {
  CloudArrowUpIcon,
  ExclamationCircleIcon,
  FolderOpenIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { authApiUrl, getAuthConfigError, isBackendAuthEnabled, useAuthStore } from '../stores/useAuthStore'
import {
  type DriveVaultSummary,
  findDriveRootFolderByName,
  listExistingDriveVaults,
  selectExistingDriveVault,
  setDriveVaultRootName,
} from '../services/googleDrive'
import {
  canPickDeviceDirectory,
  initializeLocalWorkspace,
  pickLocalWorkspaceDirectory,
  type LocalWorkspaceStoragePreference,
  type PickedLocalWorkspaceDirectory,
} from '../services/localWorkspace'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'
import { loadGoogleIdentity } from '../utils/googleIdentity'
import { getSafeReturnPath } from '../utils/navigation'

interface LoginLocationState {
  from?: string
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const googleButtonRef = useRef<HTMLDivElement>(null)
  const [isLocalSetupOpen, setIsLocalSetupOpen] = useState(false)
  const [isCloudSetupOpen, setIsCloudSetupOpen] = useState(false)
  const [cloudVaultName, setCloudVaultName] = useState('Writin')
  const [isCreatingCloudWorkspace, setIsCreatingCloudWorkspace] = useState(false)
  const [existingVaults, setExistingVaults] = useState<DriveVaultSummary[]>([])
  const [isLoadingExistingVaults, setIsLoadingExistingVaults] = useState(false)
  const [isCheckingVaultName, setIsCheckingVaultName] = useState(false)
  const [checkedVaultName, setCheckedVaultName] = useState('')
  const [vaultNameConflict, setVaultNameConflict] = useState<string | null>(null)
  const [vaultNameCheckError, setVaultNameCheckError] = useState<string | null>(null)
  const [cloudSetupError, setCloudSetupError] = useState<string | null>(null)
  const [vaultChoiceMode, setVaultChoiceMode] = useState<'select' | 'create'>('select')
  const [selectedVaultId, setSelectedVaultId] = useState<string | null>(null)
  const [selectedVaultName, setSelectedVaultName] = useState<string>('Writin')

  const supportsDeviceFolder = useMemo(() => canPickDeviceDirectory(), [])
  const isAppleMobile = useMemo(() => typeof navigator !== 'undefined' && /iPad|iPhone|iPod/i.test(navigator.userAgent), [])

  const [workspaceName, setWorkspaceName] = useState('Writin')
  const [storagePreference, setStoragePreference] = useState<LocalWorkspaceStoragePreference>(supportsDeviceFolder ? 'file-system' : 'private')
  const [selectedDirectory, setSelectedDirectory] = useState<PickedLocalWorkspaceDirectory | null>(null)
  const [localSetupError, setLocalSetupError] = useState<string | null>(null)
  const [isPickingDirectory, setIsPickingDirectory] = useState(false)
  const [isCreatingLocalWorkspace, setIsCreatingLocalWorkspace] = useState(false)
  const { clearError, error, isLoading, completeLogin } = useAuthStore()
  const { createLocalWorkspace, selectGoogleWorkspace } = useWorkspaceStore()
  const searchParams = new URLSearchParams(location.search)
  const setupAfterBackendLogin = searchParams.get('setup') === 'google'
  const destination = getSafeReturnPath(setupAfterBackendLogin
    ? searchParams.get('returnTo')
    : (location.state as LoginLocationState | null)?.from)
  const queryError = searchParams.get('error')
  const configError = getAuthConfigError()
  const normalizedCloudVaultName = cloudVaultName.trim().toLocaleLowerCase()
  const shouldCheckCloudVaultName = isCloudSetupOpen && !isLoadingExistingVaults && (existingVaults.length === 0 || vaultChoiceMode === 'create')
  const isCloudVaultNameValid = Boolean(normalizedCloudVaultName) &&
    checkedVaultName === normalizedCloudVaultName &&
    !vaultNameConflict &&
    !vaultNameCheckError &&
    !isCheckingVaultName

  useEffect(() => {
    if (!shouldCheckCloudVaultName) {
      setIsCheckingVaultName(false)
      return
    }

    if (!normalizedCloudVaultName) {
      setCheckedVaultName('')
      setVaultNameConflict(null)
      setVaultNameCheckError(null)
      setIsCheckingVaultName(false)
      return
    }

    let cancelled = false
    setCheckedVaultName('')
    setVaultNameConflict(null)
    setVaultNameCheckError(null)
    setIsCheckingVaultName(true)
    const timeout = window.setTimeout(() => {
      void findDriveRootFolderByName(cloudVaultName.trim()).then((folder) => {
        if (cancelled) return
        setVaultNameConflict(folder?.name ?? null)
        setCheckedVaultName(normalizedCloudVaultName)
      }).catch(() => {
        if (cancelled) return
        setVaultNameCheckError('Could not check Google Drive for an existing root folder. Try again.')
        setCheckedVaultName(normalizedCloudVaultName)
      }).finally(() => {
        if (!cancelled) setIsCheckingVaultName(false)
      })
    }, 300)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [cloudVaultName, normalizedCloudVaultName, shouldCheckCloudVaultName])

  useEffect(() => {
    clearError()
  }, [clearError])

  const handleGoogleLoginSuccess = useCallback(async () => {
    setIsCloudSetupOpen(true)
    setIsLoadingExistingVaults(true)
    try {
      const vaults = await listExistingDriveVaults()
      setExistingVaults(vaults)
      const first = vaults[0]
      if (first) {
        setVaultChoiceMode('select')
        setSelectedVaultId(first.id)
        setSelectedVaultName(first.name)
      } else {
        setVaultChoiceMode('create')
        setCloudVaultName('Writin')
      }
    } finally {
      setIsLoadingExistingVaults(false)
    }
  }, [])

  useEffect(() => {
    if (setupAfterBackendLogin && !isCloudSetupOpen && !isLoadingExistingVaults) {
      void handleGoogleLoginSuccess()
    }
  }, [handleGoogleLoginSuccess, isCloudSetupOpen, isLoadingExistingVaults, setupAfterBackendLogin])

  useEffect(() => {
    let active = true
    const render = async () => {
      try {
        if (configError || isBackendAuthEnabled) return
        await loadGoogleIdentity()
        const google = window.google
        if (!active || !google?.accounts?.id || !googleButtonRef.current) return

        google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? '',
          callback: (response) => {
            if (!response.credential) {
              return
            }
            void completeLogin(response.credential, '').then((succeeded) => {
              if (succeeded) {
                void handleGoogleLoginSuccess()
              }
            })
          },
        })

        googleButtonRef.current.innerHTML = ''
        google.accounts.id.renderButton(googleButtonRef.current, {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          text: 'signin_with',
          shape: 'rectangular',
          width: 280,
        })
      } catch {
        // The visible error state already explains missing config or auth issues.
      }
    }

    void render()
    return () => {
      active = false
    }
  }, [completeLogin, configError, handleGoogleLoginSuccess])

  const startBackendLogin = () => {
    const setupReturnTo = `/login?setup=google&returnTo=${encodeURIComponent(destination)}`
    window.location.assign(`${authApiUrl('/google/start')}?returnTo=${encodeURIComponent(setupReturnTo)}`)
  }

  useEffect(() => {
    setStoragePreference(supportsDeviceFolder ? 'file-system' : 'private')
  }, [supportsDeviceFolder])

  const openLocalSetup = () => {
    setLocalSetupError(null)
    setIsLocalSetupOpen(true)
  }

  const browseLocalFolder = async () => {
    setStoragePreference('file-system')
    setLocalSetupError(null)
    setIsPickingDirectory(true)
    try {
      const directory = await pickLocalWorkspaceDirectory()
      if (!directory) {
        setLocalSetupError('Choose a folder to create a device-folder workspace.')
        return
      }
      setSelectedDirectory(directory)
      setWorkspaceName(directory.name)
    } finally {
      setIsPickingDirectory(false)
    }
  }

  const startLocalWorkspace = async () => {
    const defaultName = 'Writin'
    const name = workspaceName.trim() || selectedDirectory?.name || defaultName
    if (storagePreference === 'file-system' && !selectedDirectory) {
      setLocalSetupError('Choose a folder before creating this workspace, or use private device storage.')
      return
    }
    setIsCreatingLocalWorkspace(true)
    setLocalSetupError(null)
    const result = await initializeLocalWorkspace({
      name,
      storagePreference,
      allowPrivateFallback: storagePreference !== 'file-system',
      directoryHandle: selectedDirectory?.handle,
    })
    if ('cancelled' in result && result.cancelled) {
      setLocalSetupError('Choose a folder to create a device-folder workspace, or switch to private device storage.')
      setIsCreatingLocalWorkspace(false)
      return
    }
    createLocalWorkspace()
    navigate('/home', { replace: true })
  }

  const startCloudWorkspace = async () => {
    setIsCreatingCloudWorkspace(true)
    setCloudSetupError(null)
    try {
      if (vaultChoiceMode === 'select' && selectedVaultId) {
        await selectExistingDriveVault(selectedVaultId, selectedVaultName)
      } else {
        const name = cloudVaultName.trim() || 'Writin'
        const existingFolder = await findDriveRootFolderByName(name)
        if (existingFolder) {
          setVaultNameConflict(existingFolder.name)
          setCheckedVaultName(name.toLocaleLowerCase())
          return
        }
        await setDriveVaultRootName(name)
      }
      selectGoogleWorkspace()
      navigate(destination, { replace: true })
    } catch (setupError) {
      setCloudSetupError(setupError instanceof Error ? setupError.message : 'Could not check or set up this Google Drive vault.')
    } finally {
      setIsCreatingCloudWorkspace(false)
    }
  }

  const vaultNameStatus = vaultNameConflict
    ? <p id="cloud-vault-name-status" role="alert" className="mt-2 text-sm text-destructive">A Drive root folder named “{vaultNameConflict}” already exists. Choose another name or select the existing vault.</p>
    : vaultNameCheckError
      ? <p id="cloud-vault-name-status" role="alert" className="mt-2 text-sm text-destructive">{vaultNameCheckError}</p>
      : isCheckingVaultName
        ? <p id="cloud-vault-name-status" role="status" className="mt-2 text-xs text-muted-foreground">Checking Drive root for this name…</p>
        : null
  const isSelectingExistingVault = vaultChoiceMode === 'select' && existingVaults.length > 0
  const isCloudSetupActionDisabled = isCreatingCloudWorkspace || isLoadingExistingVaults ||
    (isSelectingExistingVault ? !selectedVaultId : !isCloudVaultNameValid)

  return (
    <main className="flex h-full min-h-0 items-center justify-center overflow-y-auto overscroll-contain bg-background px-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-[calc(2.5rem+env(safe-area-inset-top))] text-foreground sm:px-6">
      <section className="w-full max-w-sm" aria-labelledby="login-title">
        <div className="mb-6 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <img src="/pwa-192.svg" alt="" className="size-12 rounded-xl" />
        </div>
        <h1 id="login-title" className="text-2xl font-semibold leading-8">
          Writin
        </h1>
        <p className="mt-2 text-base leading-7 text-muted-foreground">
          Your private documents and spreadsheets, on this device or backed up to your Drive.
        </p>

        {error || queryError ? (
          <div role="alert" className="mt-6 flex gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm leading-5 text-destructive">
            <ExclamationCircleIcon aria-hidden="true" className="size-5 shrink-0" />
            <span>{error ?? queryError}</span>
          </div>
        ) : null}

        <div className="mt-7 grid gap-3">
          <button
            type="button"
            onClick={openLocalSetup}
            className="min-h-11 rounded-[var(--radius-control)] bg-foreground px-5 text-base font-semibold text-background transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            {supportsDeviceFolder ? 'Select a Local Vault Folder' : 'Create a Private Device Vault'}
          </button>
          {isBackendAuthEnabled ? (
            <button
              type="button"
              onClick={startBackendLogin}
              className="min-h-11 rounded-[var(--radius-control)] bg-primary px-5 text-base font-semibold text-primary-foreground transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              {isAppleMobile ? 'Connect Cloud Vault (Recommended for iOS)' : 'Continue with Google'}
            </button>
          ) : (
            <div className="flex justify-center" ref={googleButtonRef} />
          )}
        </div>

        {isLoading ? <p className="mt-3 text-center text-sm text-muted-foreground">Signing in...</p> : null}
        {configError ? <p role="alert" className="mt-3 text-center text-sm text-yellow-700">Google sign-in is not configured.</p> : null}

        <p aria-live="polite" className="sr-only">
          {isLoading ? 'Signing in to Writin' : error ?? queryError ?? ''}
        </p>

        <div className="mt-6 flex items-start gap-3 border-t border-[var(--app-border)] pt-5">
          <ShieldCheckIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-emerald-600" />
          <p className="text-sm leading-6 text-muted-foreground">
            Local workspaces stay on this device. Google workspaces use your own Drive and only
            request access needed to manage files you create here.
          </p>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center">
          <Link
            to="/about"
            className="text-xs font-medium text-muted-foreground transition hover:text-foreground hover:underline"
          >
            Learn more
          </Link>
          <span className="text-xs text-muted-foreground/40">•</span>
          <Link
            to="/privacy"
            className="text-xs font-medium text-muted-foreground transition hover:text-foreground hover:underline"
          >
            Privacy
          </Link>
          <span className="text-xs text-muted-foreground/40">•</span>
          <Link
            to="/terms"
            className="text-xs font-medium text-muted-foreground transition hover:text-foreground hover:underline"
          >
            Terms
          </Link>
        </div>
        {configError ? (
          <p role="alert" className="mt-4 rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-700">
            {configError}
          </p>
        ) : null}
      </section>

      {isLocalSetupOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 px-3 pb-3 pt-[calc(1rem+env(safe-area-inset-top))] sm:items-center sm:justify-center sm:p-6" role="presentation">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="local-workspace-title"
            className="max-h-full w-full max-w-lg overflow-y-auto rounded-t-2xl border border-[var(--app-border)] bg-background p-5 shadow-xl sm:rounded-2xl sm:p-6"
          >
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FolderOpenIcon aria-hidden="true" className="size-6" />
              </div>
              <div>
                <h2 id="local-workspace-title" className="text-lg font-semibold leading-7">
                  {supportsDeviceFolder ? 'Select Local Vault Folder' : 'Create Private Device Vault'}
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {supportsDeviceFolder
                    ? 'Choose where this device should keep your files and folders.'
                    : "This browser doesn't support saving directly into a chosen folder. Your documents stay in this browser's private storage on this device."}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Local vaults stay private to this device. Export copies to Files or optionally connect Google Drive at any time.
                </p>
              </div>
            </div>

            {cloudSetupError ? <p role="alert" className="mt-4 text-sm text-destructive">{cloudSetupError}</p> : null}

            <label htmlFor="workspace-name" className="mt-5 block text-sm font-medium text-foreground">
              Vault name
            </label>
            <input
              id="workspace-name"
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
              className="mt-2 h-11 w-full rounded-[var(--radius-control)] border border-[var(--app-border)] bg-background px-3 text-base outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
              placeholder="Writin"
            />

            <fieldset className="mt-5">
              <legend className="text-sm font-medium text-foreground">Storage location</legend>
              <div className="mt-2 grid gap-3">
                <label
                  className={`flex cursor-pointer gap-3 rounded-lg border p-4 transition ${supportsDeviceFolder ? 'border-[var(--app-border)] hover:border-[var(--accent)]/60' : 'cursor-not-allowed border-[var(--app-border)] bg-muted/40 opacity-70'} ${storagePreference === 'file-system' ? 'ring-2 ring-[var(--accent)]/30' : ''}`}
                >
                  <input
                    type="radio"
                    name="local-storage"
                    value="file-system"
                    checked={storagePreference === 'file-system'}
                    disabled={!supportsDeviceFolder}
                    onChange={() => setStoragePreference('file-system')}
                    className="mt-1 size-4 accent-[var(--accent)]"
                  />
                  <span>
                    <span className="block text-sm font-medium text-foreground">Choose a folder on this device</span>
                    <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                      Best for macOS, Windows, and supported browsers. Files stay visible directly outside the app.
                    </span>
                    {!supportsDeviceFolder ? (
                      <span className="mt-1 block text-xs font-medium text-muted-foreground">
                        Direct folder selection is not available in this browser.
                      </span>
                    ) : null}
                    {supportsDeviceFolder ? (
                      <span className="mt-4 block border-t border-[var(--app-border)] pt-3">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault()
                            void browseLocalFolder()
                          }}
                          disabled={isPickingDirectory || isCreatingLocalWorkspace}
                          className="min-h-10 rounded-[var(--radius-control)] border border-[var(--app-border)] px-3 text-sm font-semibold transition hover:bg-muted disabled:opacity-60"
                        >
                          {isPickingDirectory ? 'Opening...' : selectedDirectory ? 'Change folder' : 'Browse folder'}
                        </button>
                        <span className="mt-2 block text-xs font-medium text-muted-foreground">
                          {selectedDirectory ? `Selected folder: ${selectedDirectory.name}` : 'No folder selected yet.'}
                        </span>
                      </span>
                    ) : null}
                  </span>
                </label>

                <label className={`flex cursor-pointer gap-3 rounded-lg border border-[var(--app-border)] p-4 transition hover:border-[var(--accent)]/60 ${storagePreference === 'private' ? 'ring-2 ring-[var(--accent)]/30' : ''}`}>
                  <input
                    type="radio"
                    name="local-storage"
                    value="private"
                    checked={storagePreference === 'private'}
                    onChange={() => setStoragePreference('private')}
                    className="mt-1 size-4 accent-[var(--accent)]"
                  />
                  <span>
                    <span className="block text-sm font-medium text-foreground">Use private device storage</span>
                    <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                      Works across devices including iPhone and iPad. Export copies or connect Google Drive to back up work.
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>

            {localSetupError ? (
              <p role="alert" className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {localSetupError}
              </p>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsLocalSetupOpen(false)}
                disabled={isCreatingLocalWorkspace}
                className="min-h-11 rounded-[var(--radius-control)] border border-[var(--app-border)] px-4 text-sm font-semibold transition hover:bg-muted disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void startLocalWorkspace()}
                disabled={isCreatingLocalWorkspace}
                className="min-h-11 rounded-[var(--radius-control)] bg-foreground px-4 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-60"
              >
                {isCreatingLocalWorkspace ? 'Opening...' : 'Open Vault'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isCloudSetupOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 px-3 pb-3 pt-[calc(1rem+env(safe-area-inset-top))] sm:items-center sm:justify-center sm:p-6" role="presentation">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="cloud-workspace-title"
            className="max-h-full w-full max-w-lg overflow-y-auto rounded-t-2xl border border-[var(--app-border)] bg-background p-5 shadow-xl sm:rounded-2xl sm:p-6"
          >
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CloudArrowUpIcon aria-hidden="true" className="size-6" />
              </div>
              <div>
                <h2 id="cloud-workspace-title" className="text-lg font-semibold leading-7">
                  Set Up Google Drive Vault
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {existingVaults.length > 0
                    ? 'Select an existing vault from your Google Drive or create a new one.'
                    : 'Choose the name for your root folder in Google Drive. All documents and spreadsheets will be kept inside this folder.'}
                </p>
              </div>
            </div>

            {isLoadingExistingVaults ? (
              <div className="my-8 flex items-center justify-center gap-3 text-sm text-muted-foreground">
                <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span>Checking your Google Drive for existing vaults...</span>
              </div>
            ) : existingVaults.length > 0 ? (
              <fieldset className="mt-5 space-y-3">
                <legend className="text-sm font-medium text-foreground">Vault selection</legend>
                <div
                  className={`rounded-lg border p-4 transition border-[var(--app-border)] hover:border-[var(--accent)]/60 ${vaultChoiceMode === 'select' ? 'ring-2 ring-[var(--accent)]/30' : ''}`}
                >
                  <label className="flex cursor-pointer gap-3">
                    <input
                      type="radio"
                      name="vault-choice"
                      value="select"
                      checked={vaultChoiceMode === 'select'}
                      onChange={() => setVaultChoiceMode('select')}
                      className="mt-1 size-4 accent-[var(--accent)]"
                    />
                    <div>
                      <span className="block text-sm font-medium text-foreground">Select an existing vault</span>
                      <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                        Connect to a vault previously created in Google Drive.
                      </span>
                    </div>
                  </label>
                  {vaultChoiceMode === 'select' ? (
                    <div className="mt-3 space-y-2 pl-7">
                      {existingVaults.map((vault) => (
                        <label
                          key={vault.id}
                          className={`flex cursor-pointer items-center justify-between rounded-md border p-2.5 text-sm transition ${selectedVaultId === vault.id ? 'border-[var(--accent)] bg-muted/60 font-medium' : 'border-[var(--app-border)] hover:bg-muted/30'}`}
                        >
                          <span className="flex items-center gap-2">
                            <FolderOpenIcon className="size-4 text-primary shrink-0" />
                            <span>{vault.name}</span>
                          </span>
                          <input
                            type="radio"
                            name="selected-vault"
                            value={vault.id}
                            checked={selectedVaultId === vault.id}
                            onChange={() => {
                              setSelectedVaultId(vault.id)
                              setSelectedVaultName(vault.name)
                            }}
                            className="size-4 accent-[var(--accent)]"
                          />
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div
                  className={`rounded-lg border p-4 transition border-[var(--app-border)] hover:border-[var(--accent)]/60 ${vaultChoiceMode === 'create' ? 'ring-2 ring-[var(--accent)]/30' : ''}`}
                >
                  <label className="flex cursor-pointer gap-3">
                    <input
                      type="radio"
                      name="vault-choice"
                      value="create"
                      checked={vaultChoiceMode === 'create'}
                      onChange={() => setVaultChoiceMode('create')}
                      className="mt-1 size-4 accent-[var(--accent)]"
                    />
                    <div>
                      <span className="block text-sm font-medium text-foreground">Create a new vault</span>
                      <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                        Start a new root folder on Google Drive.
                      </span>
                    </div>
                  </label>
                  {vaultChoiceMode === 'create' ? (
                    <div className="mt-3 pl-7">
                      <label htmlFor="new-cloud-vault-name" className="block text-xs font-medium text-foreground">
                        Vault name
                      </label>
                      <input
                        id="new-cloud-vault-name"
                        value={cloudVaultName}
                        onChange={(event) => {
                          setCloudVaultName(event.target.value)
                          setCloudSetupError(null)
                        }}
                        aria-invalid={Boolean(vaultNameConflict || vaultNameCheckError)}
                        aria-describedby={vaultNameStatus ? 'cloud-vault-name-status' : undefined}
                        className="mt-1.5 h-10 w-full rounded-[var(--radius-control)] border border-[var(--app-border)] bg-background px-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                        placeholder="Writin"
                      />
                      {vaultNameStatus}
                    </div>
                  ) : null}
                </div>
              </fieldset>
            ) : (
              <div className="mt-5">
                <label htmlFor="cloud-vault-name" className="block text-sm font-medium text-foreground">
                  Vault name
                </label>
                <input
                  id="cloud-vault-name"
                  value={cloudVaultName}
                  onChange={(event) => {
                    setCloudVaultName(event.target.value)
                    setCloudSetupError(null)
                  }}
                  aria-invalid={Boolean(vaultNameConflict || vaultNameCheckError)}
                  aria-describedby={vaultNameStatus ? 'cloud-vault-name-status' : undefined}
                  className="mt-2 h-11 w-full rounded-[var(--radius-control)] border border-[var(--app-border)] bg-background px-3 text-base outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                  placeholder="Writin"
                />
                {vaultNameStatus}
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsCloudSetupOpen(false)}
                disabled={isCreatingCloudWorkspace}
                className="min-h-11 rounded-[var(--radius-control)] border border-[var(--app-border)] px-4 text-sm font-semibold transition hover:bg-muted disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void startCloudWorkspace()}
                disabled={isCloudSetupActionDisabled}
                className="min-h-11 rounded-[var(--radius-control)] bg-foreground px-4 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-60"
              >
                {isCreatingCloudWorkspace ? 'Opening...' : vaultChoiceMode === 'select' && existingVaults.length > 0 ? 'Open Vault' : 'Create Vault'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}
