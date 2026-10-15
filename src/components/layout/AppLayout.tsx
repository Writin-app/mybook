import { useEffect, useRef, useState } from 'react'
import { CloudUploadIcon, Delete02Icon, Download01Icon, File01Icon, Folder01Icon, HelpCircleIcon, Home01Icon, Logout01Icon, MoreHorizontalIcon, Search01Icon, Settings01Icon, Sun01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'

import { useAppStore } from '../../stores/useAppStore'
import { authApiUrl, isBackendAuthEnabled, useAuthStore } from '../../stores/useAuthStore'
import { useWorkspaceStore } from '../../stores/useWorkspaceStore'
import { loadGoogleIdentity } from '../../utils/googleIdentity'
import { useDriveBootstrap } from '../../hooks/useDriveBootstrap'
import { useLibraryData } from '../../hooks/useLibraryData'
import { activeFavoriteItems } from '../../utils/favorites'
import { AppHeader } from '../common/AppHeader'
import { LoadingOverlay } from '../common/LoadingOverlay'
import { SyncProgressToast } from '../common/SyncProgressToast'
import { getFolderPath } from '../files/FolderBreadcrumb'
import { MoveItemDialog } from '../files/MoveItemDialog'
import { FolderNameDialog } from '../files/FolderNameDialog'
import { DeleteFolderDialog } from '../files/DeleteFolderDialog'
import { fileRepository, folderRepository } from '../../database/repositories'
import { downloadVaultZip } from '../../services/vaultExport'
import { db } from '../../database/db'
import { deletedToast } from '../../utils/deleteToast'
import type { MyBookFolder } from '../../types/files'
import {
  canPickDeviceDirectory,
  forgetDeviceDirectoryHandle,
  pickLocalWorkspaceDirectory,
} from '../../services/localWorkspace'
import {
  listAllWorkspaces,
  switchWorkspace,
  mirrorCurrentCloudWorkspaceToLocal,
  type AppWorkspaceItem,
} from '../../services/workspaceManager'
import { WorkspaceModal } from './WorkspaceModal'
import { MissingMirrorModal } from './MissingMirrorModal'
import { useLocalMirrorSync } from '../../hooks/useLocalMirrorSync'
import { CheckIcon, PlusIcon, CloudIcon, FolderIcon } from '@heroicons/react/24/outline'
import { toast } from '../ui/toast'
import { Input } from '../ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '../ui/sidebar'
import { MobileBottomNavigation } from './MobileBottomNavigation'
import { isSupportedDocumentImport, queueDocumentImport } from '../../services/documentImport'

export function AppLayout() {
  const { theme, toggleTheme } = useAppStore()
  const { email, displayName: accountDisplayName, isAuthenticated, completeLogin, logout } = useAuthStore()
  const { mode: workspaceMode, workspaceRevision, isMirrorFolderMissing, isMirroring, mirrorProgress, selectGoogleWorkspace } = useWorkspaceStore()
  const { files, folders, isLoading } = useLibraryData()
  const { isFetchingFiles = false, fetchProgress = 0 } = useDriveBootstrap() ?? {}
  useLocalMirrorSync()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const importInputRef = useRef<HTMLInputElement>(null)
  const isEditor = pathname.startsWith('/document/') || pathname.startsWith('/spreadsheet/')
  const favorites = activeFavoriteItems(files, folders)
  const sidebarFavorites = favorites.slice(0, 5)
  const recentFiles = files.filter((file) => !file.isDeleted).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, 5)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false)
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false)
  const [workspaces, setWorkspaces] = useState<AppWorkspaceItem[]>([])
  const googleButtonRef = useRef<HTMLDivElement>(null)
  const isLocalWorkspace = workspaceMode === 'local' || !isAuthenticated
  const localDetailsRecord = useLiveQuery(() => db.settings.get('local-workspace.details'), [])
  const localDetails = localDetailsRecord?.value as { name?: string; storage?: string } | undefined
  const settingsRecords = useLiveQuery(() => db.settings.toArray(), [])

  useEffect(() => {
    let isCurrent = true
    void listAllWorkspaces().then((list) => {
      if (isCurrent) {
        setWorkspaces(list)
      }
    })
    return () => {
      isCurrent = false
    }
  }, [workspaceRevision, settingsRecords, workspaceMode, isAuthenticated, email, isMirrorFolderMissing])

  const activeWorkspace = workspaces.find((w) => w.isActive)
  const vaultName = activeWorkspace?.name || localDetails?.name || 'Local Vault'
  const displayName = activeWorkspace ? activeWorkspace.name : isLocalWorkspace ? vaultName : accountDisplayName || email || 'Google account'
  const profileEmail = email
  const initials = displayName.split(/\s+/u).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || (isLocalWorkspace ? 'LV' : 'WR')

  useEffect(() => {
    if (!isGoogleModalOpen || isBackendAuthEnabled) return
    let active = true
    const renderGoogleBtn = async () => {
      try {
        await loadGoogleIdentity()
        const google = window.google
        if (!active || !google?.accounts?.id || !googleButtonRef.current) return
        google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? '',
          callback: (response) => {
            if (!response.credential) return
            void completeLogin(response.credential, '').then((succeeded) => {
              if (succeeded) {
                selectGoogleWorkspace()
                setIsGoogleModalOpen(false)
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
        // Handled silently
      }
    }
    void renderGoogleBtn()
    return () => {
      active = false
    }
  }, [isGoogleModalOpen, completeLogin, selectGoogleWorkspace])
  const navigateToSearch = () => {
    navigate(searchQuery.trim() ? `/search?query=${encodeURIComponent(searchQuery.trim())}` : '/search')
    setSearchOpen(false)
  }
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase()
  const searchResults = normalizedSearchQuery
    ? [
        ...files.filter((file) => !file.isDeleted && file.name.toLocaleLowerCase().includes(normalizedSearchQuery)).map((file) => ({ kind: 'file' as const, id: file.id, name: file.name, type: file.type })),
        ...folders.filter((folder) => !folder.isDeleted && folder.name.toLocaleLowerCase().includes(normalizedSearchQuery)).map((folder) => ({ kind: 'folder' as const, id: folder.id, name: folder.name, type: 'folder' as const })),
      ].slice(0, 8)
    : recentFiles.map((file) => ({ kind: 'file' as const, id: file.id, name: file.name, type: file.type }))
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [isMoveFolderDialogOpen, setIsMoveFolderDialogOpen] = useState(false)
  const [renameFolderTarget, setRenameFolderTarget] = useState<MyBookFolder | null>(null)
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<MyBookFolder | null>(null)
  const folderMatch = pathname.match(/^\/folders\/([^/]+)/)
  const currentFolderId = folderMatch ? folderMatch[1] : null
  const currentFolder = currentFolderId ? folders.find((f) => f.id === currentFolderId) : null

  let headerTitle = 'Home'
  let showTitle = true
  let breadcrumbs: { label: string; onPress?: () => void }[] = []
  let showAddNew = true
  let leadingAction: 'sidebar' | 'back' | 'none' = 'sidebar'
  let onBack: (() => void) | undefined = undefined

  if (pathname === '/home') {
    headerTitle = 'Home'
  } else if (pathname === '/favorites') {
    headerTitle = 'Favorites'
  } else if (pathname === '/folders') {
    headerTitle = 'Library'
    breadcrumbs = []
  } else if (currentFolderId) {
    const path = getFolderPath(currentFolderId, folders)
    breadcrumbs = [
      { label: 'Library', onPress: () => navigate('/folders') },
      ...path.map((folder, index) => {
        const isCurrent = index === path.length - 1
        return isCurrent
          ? { label: folder.name }
          : { label: folder.name, onPress: () => navigate(`/folders/${folder.id}`) }
      }),
    ]
    headerTitle = currentFolder?.name ?? 'Folder'
    showTitle = false
    leadingAction = 'sidebar'
    onBack = () => navigate(currentFolder?.parentId ? `/folders/${currentFolder.parentId}` : '/folders')
  } else if (pathname === '/search') {
    headerTitle = 'Search'
  } else if (pathname === '/trash') {
    headerTitle = 'Trash'
    showAddNew = false
  } else if (pathname === '/settings') {
    headerTitle = 'Preferences'
    showAddNew = false
  } else if (pathname === '/design-system') {
    headerTitle = 'Design System'
    showAddNew = false
  }

  // Move destinations for currentFolder
  const currentFolderDescendants = new Set<string>()
  if (currentFolder) {
    let changed = true
    while (changed) {
      changed = false
      for (const folder of folders) {
        if ((folder.parentId === currentFolder.id || (folder.parentId && currentFolderDescendants.has(folder.parentId))) && !currentFolderDescendants.has(folder.id)) {
          currentFolderDescendants.add(folder.id)
          changed = true
        }
      }
    }
  }
  const moveDestinations = currentFolder
    ? folders.filter((folder) => folder.id !== currentFolder.id && folder.id !== currentFolder.parentId && !currentFolderDescendants.has(folder.id))
    : []

  const targetFolderId = pathname.startsWith('/folders/') && currentFolderId ? currentFolderId : null
  const existingFolderNames = folders
    .filter((f) => f.parentId === targetFolderId)
    .map((f) => f.name)

  const handleCreateDocument = () => {
    void fileRepository.create('document', targetFolderId).then((result) => {
      if (result.data) navigate(`/document/${result.data.id}`)
    })
  }

  const handleImportDocument = async (selectedFile: File | undefined) => {
    if (!selectedFile) return
    if (!isSupportedDocumentImport(selectedFile)) {
      toast.add({ title: 'Unsupported document type', description: 'Choose a Markdown, text, Word, HTML, or Rich Text document.', type: 'error' })
      return
    }
    const result = await fileRepository.create('document', targetFolderId)
    if (!result.data) {
      toast.add({ title: 'Import failed', description: result.error ?? 'Could not create a document for this import.', type: 'error' })
      return
    }
    queueDocumentImport(result.data.id, selectedFile)
    navigate(`/document/${result.data.id}`)
  }

  const openSearchResult = (result: (typeof searchResults)[number]) => {
    setSearchOpen(false)
    navigate(result.kind === 'folder' ? `/folders/${result.id}` : `/${result.type}/${result.id}`)
  }

  useEffect(() => {
    const openSearchWithShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchQuery('')
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', openSearchWithShortcut)
    return () => window.removeEventListener('keydown', openSearchWithShortcut)
  }, [])

  return (
    <SidebarProvider className="h-full min-h-0 overflow-hidden bg-background text-foreground">
      <Sidebar side="left" collapsible="offcanvas">
        <SidebarHeader>
          <div className="flex items-center px-3 py-2">
            <DropdownMenu
              onOpenChange={(open) => {
                if (open) {
                  void listAllWorkspaces().then(setWorkspaces)
                }
              }}
            >
              <DropdownMenuTrigger
                render={<button type="button" />}
                aria-label="Account options"
                title="Account options"
                className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 text-left transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background shadow-xs" aria-hidden="true">{initials}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-sidebar-foreground">{displayName}</p>
                  {activeWorkspace?.hasLocalMirror ? (
                    <p className="flex items-center gap-1 truncate text-xs text-sidebar-foreground/60" title={profileEmail ? `${profileEmail} (Mirrored locally)` : 'Mirrored locally'}>
                      <FolderIcon className="size-3 shrink-0" />
                      <span>Mirrored locally</span>
                    </p>
                  ) : profileEmail ? (
                    <p className="truncate text-xs text-sidebar-foreground/60" title={profileEmail}>{profileEmail}</p>
                  ) : isLocalWorkspace ? (
                    <p className="truncate text-xs font-medium text-primary">Local Vault</p>
                  ) : null}
                </div>
                <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} className="size-5 shrink-0 text-sidebar-foreground/70" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-56">
                {workspaces.length > 0 ? (
                  <>
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Workspaces
                      </DropdownMenuLabel>
                      {workspaces.map((ws) => (
                        <DropdownMenuItem
                          key={ws.id}
                          onClick={() => {
                            if (!ws.isActive) {
                              void switchWorkspace(ws).then(() => {
                                toast.add({
                                  title: 'Workspace Switched',
                                  description: `Switched to "${ws.name}".`,
                                  type: 'success',
                                  priority: 'low',
                                })
                              })
                            }
                          }}
                          className="flex items-center justify-between gap-2 py-2"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            {ws.type === 'cloud' ? (
                              <CloudIcon className="size-4 shrink-0 text-muted-foreground" />
                            ) : (
                              <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className={`truncate text-sm ${ws.isActive ? 'font-semibold text-foreground' : 'text-foreground/80'}`}>
                                {ws.name}
                              </p>
                              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <span>{ws.type === 'cloud' ? 'Google Drive' : 'Local Device'}</span>
                                {ws.hasLocalMirror && (
                                  <span className="flex items-center gap-0.5 text-primary">
                                    • Mirrored{ws.localFolderName ? ` (${ws.localFolderName})` : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          {ws.isActive && (
                            <CheckIcon className="size-4 shrink-0 text-primary" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                  </>
                ) : null}

                <DropdownMenuItem onClick={() => setIsWorkspaceModalOpen(true)}>
                  <PlusIcon className="size-4 text-muted-foreground" />
                  <span>Add Workspace...</span>
                </DropdownMenuItem>

                {!isLocalWorkspace && canPickDeviceDirectory() && !activeWorkspace?.hasLocalMirror ? (
                  <DropdownMenuItem
                    onClick={async () => {
                      try {
                        const picked = await pickLocalWorkspaceDirectory()
                        if (picked) {
                          await mirrorCurrentCloudWorkspaceToLocal(picked.handle)
                          toast.add({
                            title: 'Local Mirror Created',
                            description: `Mirrored "${displayName}" to folder "${picked.name}".`,
                            type: 'success',
                            priority: 'low',
                          })
                        }
                      } catch {
                        // user cancelled
                      }
                    }}
                  >
                    <FolderIcon className="size-4 text-muted-foreground" />
                    <span>Mirror to Computer Folder</span>
                  </DropdownMenuItem>
                ) : null}

                {!isLocalWorkspace && activeWorkspace?.hasLocalMirror ? (
                  <DropdownMenuItem
                    onClick={async () => {
                      await forgetDeviceDirectoryHandle()
                      useWorkspaceStore.getState().bumpWorkspaceRevision()
                      toast.add({
                        title: 'Mirror Disconnected',
                        description: 'Local mirror disconnected. Files remain in Google Drive.',
                        type: 'info',
                        priority: 'low',
                      })
                    }}
                  >
                    <FolderIcon className="size-4 text-muted-foreground" />
                    <span>Disconnect Local Mirror</span>
                  </DropdownMenuItem>
                ) : null}

                {isLocalWorkspace && !profileEmail ? (
                  <DropdownMenuItem
                    onClick={() => {
                      setIsGoogleModalOpen(true)
                    }}
                  >
                    <HugeiconsIcon icon={CloudUploadIcon} strokeWidth={2} className="size-4" />
                    Connect Cloud Vault
                  </DropdownMenuItem>
                ) : null}

                <DropdownMenuItem onClick={() => void downloadVaultZip({ vaultName })}>
                  <HugeiconsIcon icon={Download01Icon} strokeWidth={2} className="size-4" />
                  Export full vault (ZIP)
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <HugeiconsIcon icon={Settings01Icon} strokeWidth={2} className="size-4" />
                  Preferences
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void logout()}>
                  <HugeiconsIcon icon={Logout01Icon} strokeWidth={2} className="size-4" />
                  {isLocalWorkspace ? 'Return to start' : 'Log out'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="px-2 pb-2">
            <label className="sr-only" htmlFor="sidebar-search">Search</label>
            <div className="relative">
              <button type="button" id="sidebar-search" aria-label="Open search" onClick={() => setSearchOpen(true)} className="flex h-11 w-full items-center gap-2 rounded-xl border border-sidebar-border bg-white px-3 pl-9 text-left text-sm text-slate-500 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-white dark:text-slate-500">
                <span className="pointer-events-none absolute ml-[-1.5rem]"><HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="size-4" /></span>
                <span>Search</span>
                <kbd className="pointer-events-none ml-auto rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">⌘K</kbd>
              </button>
              <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-sidebar-border bg-sidebar px-1.5 py-0.5 text-[10px] text-sidebar-foreground/60">⌘K</kbd>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem><SidebarMenuButton render={<NavLink to="/home" />} isActive={pathname === '/home'} size="lg" tooltip="Home"><HugeiconsIcon icon={Home01Icon} strokeWidth={2} /><span>Home</span></SidebarMenuButton></SidebarMenuItem>
                <SidebarMenuItem><SidebarMenuButton render={<NavLink to="/folders" />} isActive={pathname === '/folders' || pathname.startsWith('/folders/')} size="lg" tooltip="Library"><HugeiconsIcon icon={Folder01Icon} strokeWidth={2} /><span>Library</span></SidebarMenuButton></SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Recent</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {recentFiles.map((file) => <SidebarMenuItem key={`recent:${file.id}`}><SidebarMenuButton render={<NavLink to={`/${file.type}/${file.id}`} />} isActive={pathname === `/${file.type}/${file.id}`} tooltip={file.name}><HugeiconsIcon icon={File01Icon} strokeWidth={2} /><span>{file.name}</span></SidebarMenuButton></SidebarMenuItem>)}
                {files.filter((file) => !file.isDeleted).length > 5 ? <SidebarMenuItem><SidebarMenuButton render={<NavLink to="/home" />} tooltip="View more recent documents"><HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} /><span className="font-semibold">View more</span></SidebarMenuButton></SidebarMenuItem> : null}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Favorites</SidebarGroupLabel>
            {favorites.length > 5 ? (
              <SidebarGroupAction
                render={<NavLink to="/favorites" />}
                aria-label="See all favorites"
                title="See all favorites"
                className="aspect-auto h-6 w-auto px-2 text-xs"
              >
                More
              </SidebarGroupAction>
            ) : null}
            <SidebarGroupContent>
              <SidebarMenu>
                {sidebarFavorites.map((favorite) => {
                  const path = favorite.kind === 'folder'
                    ? `/folders/${favorite.item.id}`
                    : `/${favorite.item.type}/${favorite.item.id}`
                  const label = favorite.kind === 'folder'
                    ? `Open favorite folder ${favorite.item.name}`
                    : `Open favorite ${favorite.item.type} ${favorite.item.name}`

                  return (
                    <SidebarMenuItem key={`${favorite.kind}:${favorite.item.id}`}>
                      <SidebarMenuButton
                        render={<NavLink to={path} aria-label={label} />}
                        isActive={pathname === path}
                        tooltip={favorite.item.name}
                      >
                        <HugeiconsIcon icon={favorite.kind === 'folder' ? Folder01Icon : File01Icon} strokeWidth={2} />
                        <span>{favorite.item.name}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem><div className="flex items-center justify-between px-3 py-2 text-sm text-sidebar-foreground"><span className="flex items-center gap-2"><HugeiconsIcon icon={Sun01Icon} strokeWidth={2} className="size-4" />Theme</span><div className="flex rounded-lg bg-sidebar-accent p-0.5"><button type="button" aria-label="Use light theme" aria-pressed={theme === 'light'} onClick={() => theme !== 'light' && toggleTheme()} className={`rounded-md px-2 py-1 text-xs ${theme === 'light' ? 'bg-sidebar text-sidebar-foreground shadow-sm' : 'text-sidebar-foreground/60'}`}>Light</button><button type="button" aria-label="Use dark theme" aria-pressed={theme === 'dark'} onClick={() => theme !== 'dark' && toggleTheme()} className={`rounded-md px-2 py-1 text-xs ${theme === 'dark' ? 'bg-sidebar text-sidebar-foreground shadow-sm' : 'text-sidebar-foreground/60'}`}>Dark</button></div></div></SidebarMenuItem>
            <SidebarMenuItem><SidebarMenuButton render={<NavLink to="/settings" />} isActive={pathname === '/settings'} tooltip="Preferences"><HugeiconsIcon icon={Settings01Icon} strokeWidth={2} /><span>Preferences</span></SidebarMenuButton></SidebarMenuItem>
            <SidebarMenuItem><SidebarMenuButton render={<NavLink to="/settings" />} tooltip="Help"><HugeiconsIcon icon={HelpCircleIcon} strokeWidth={2} /><span>Help</span></SidebarMenuButton></SidebarMenuItem>
            <SidebarMenuItem><SidebarMenuButton render={<NavLink to="/trash" />} isActive={pathname === '/trash'} size="lg" tooltip="Trash"><HugeiconsIcon icon={Delete02Icon} strokeWidth={2} /><span>Trash</span></SidebarMenuButton></SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-h-0 min-w-0 overflow-hidden">
        <input
          ref={importInputRef}
          type="file"
          accept=".md,.markdown,.mybook.md,.txt,.docx,.html,.htm,.rtf,text/markdown,text/plain,text/html,application/rtf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          aria-label="Import document file"
          onChange={(event) => {
            void handleImportDocument(event.target.files?.[0])
            event.target.value = ''
          }}
        />
        {!isEditor ? (
          <AppHeader
            title={headerTitle}
            showTitle={showTitle}
            breadcrumbs={breadcrumbs}
            leadingAction={leadingAction}
            hideLeadingOnMobile={['/home', '/folders', '/settings', '/search'].includes(pathname)}
            onBack={onBack}
            onRename={false}
            favoriteAction={Boolean(currentFolder)}
            isFavorite={Boolean(currentFolder?.isFavorite)}
            onFavorite={() => {
              if (currentFolder) {
                void folderRepository.setFavorite(currentFolder.id, !currentFolder.isFavorite)
              }
            }}
            moreAction={Boolean(currentFolder)}
            moreContent={
              currentFolder ? (
                <>
                  <DropdownMenuItem onClick={() => setRenameFolderTarget(currentFolder)}>
                    Rename
                  </DropdownMenuItem>
                  {currentFolder.parentId || moveDestinations.length > 0 ? (
                    <DropdownMenuItem onClick={() => setIsMoveFolderDialogOpen(true)}>
                      Move…
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setDeleteFolderTarget(currentFolder)}
                  >
                    Delete
                  </DropdownMenuItem>
                </>
              ) : undefined
            }
            addNewAction={showAddNew}
            addNewContent={
              showAddNew ? (
                <>
                  <DropdownMenuItem onClick={handleCreateDocument}>Document</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => importInputRef.current?.click()}>Import document</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsCreatingFolder(true)}>Folder</DropdownMenuItem>
                </>
              ) : undefined
            }
          />
        ) : null}

        <main className={`min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain bg-background ${isEditor ? 'p-0' : 'px-0 pb-4 md:px-8 md:pb-8 md:pt-6'}`}>
          <div className={isEditor ? 'h-full w-full' : 'mx-auto w-full max-w-6xl'}>
            <Outlet />
          </div>
        </main>
        {isLoading ? <LoadingOverlay message="Loading your files…" /> : null}
        <SyncProgressToast
          isVisible={isFetchingFiles || isMirroring}
          title={isMirroring ? 'Mirroring files to computer…' : undefined}
          progress={isMirroring ? mirrorProgress : fetchProgress}
        />
        {!isEditor ? <MobileBottomNavigation /> : null}
      </SidebarInset>

      <FolderNameDialog
        isOpen={isCreatingFolder}
        title="Create folder"
        submitLabel="Create"
        onClose={() => setIsCreatingFolder(false)}
        existingFolderNames={existingFolderNames}
        onSubmit={(name) => folderRepository.create(name, targetFolderId)}
        onSuccess={(result) => {
          if (result.data) {
            navigate(`/folders/${result.data.id}`)
            toast.add({ title: `"${result.data.name}" created`, type: 'success', priority: 'low' })
          }
        }}
      />
      <FolderNameDialog
        isOpen={Boolean(renameFolderTarget)}
        title="Rename folder"
        submitLabel="Save"
        initialName={renameFolderTarget?.name ?? ''}
        existingFolderNames={folders
          .filter((f) => f.parentId === renameFolderTarget?.parentId && f.id !== renameFolderTarget?.id)
          .map((f) => f.name)}
        onClose={() => setRenameFolderTarget(null)}
        onSubmit={(name) => {
          if (!renameFolderTarget) return Promise.resolve({ success: false })
          return folderRepository.update(renameFolderTarget.id, { name })
        }}
        onSuccess={(result) => {
          if (result.data) {
            toast.add({ title: `Renamed to "${result.data.name}"`, type: 'success', priority: 'low' })
          }
        }}
      />
      <DeleteFolderDialog
        isOpen={Boolean(deleteFolderTarget)}
        folderName={deleteFolderTarget?.name ?? ''}
        hasContents={Boolean(
          deleteFolderTarget &&
            (folders.some((f) => f.parentId === deleteFolderTarget.id) ||
              files.some((f) => f.folderId === deleteFolderTarget.id))
        )}
        onClose={() => setDeleteFolderTarget(null)}
        onConfirm={() => {
          if (!deleteFolderTarget) return
          const target = deleteFolderTarget
          void folderRepository.delete(target.id).then((result) => {
            if (!result.success) return
            toast.add(
              deletedToast({
                itemName: target.name,
                onUndo: () => {
                  void folderRepository.restore(target.id)
                },
              })
            )
            navigate(target.parentId ? `/folders/${target.parentId}` : '/folders')
          })
        }}
      />
      {currentFolder ? (
        <MoveItemDialog
          isOpen={isMoveFolderDialogOpen}
          itemKind="folder"
          itemName={currentFolder.name}
          folders={folders}
          disabledFolderIds={[
            currentFolder.id,
            ...currentFolderDescendants,
            ...(currentFolder.parentId ? [currentFolder.parentId] : ['root']),
          ]}
          onClose={() => setIsMoveFolderDialogOpen(false)}
          onMove={(parentId) => folderRepository.update(currentFolder.id, { parentId })}
          onCreateFolder={(name, parentId) => folderRepository.create(name, parentId)}
        />
      ) : null}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-xl gap-4 p-4 sm:p-5">
          <DialogHeader>
            <DialogTitle>Search</DialogTitle>
            <DialogDescription>Search your documents and folders.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => { event.preventDefault(); navigateToSearch() }}>
            <label className="sr-only" htmlFor="global-search">Search documents and folders</label>
            <div className="relative">
              <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
              <Input id="global-search" autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search documents and folders..." className="h-12 rounded-xl border-slate-200 bg-white pl-10 pr-4 text-base text-slate-900 placeholder:text-slate-500 dark:bg-white dark:text-slate-900" />
            </div>
          </form>
          <div className="max-h-80 overflow-y-auto">
            <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{normalizedSearchQuery ? 'Results' : 'Recent'}</p>
            {searchResults.length ? (
              <div className="space-y-1">
                {searchResults.map((result) => (
                  <button key={`${result.kind}:${result.id}`} type="button" onClick={() => openSearchResult(result)} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <HugeiconsIcon icon={result.kind === 'folder' ? Folder01Icon : File01Icon} strokeWidth={2} className="size-5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{result.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
                <HugeiconsIcon icon={Search01Icon} strokeWidth={1.8} className="mx-auto mb-2 size-6 text-muted-foreground" />
                <p className="text-sm font-medium">No results found</p>
                <p className="mt-1 text-xs text-muted-foreground">Try a different document or folder name.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {isGoogleModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/40 px-3 pb-3 pt-[calc(1rem+env(safe-area-inset-top))] sm:items-center sm:justify-center sm:p-6"
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="cloud-connect-title"
            className="max-h-full w-full max-w-md overflow-y-auto rounded-t-2xl border border-[var(--app-border)] bg-background p-5 shadow-xl sm:rounded-2xl sm:p-6"
          >
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <HugeiconsIcon icon={CloudUploadIcon} strokeWidth={2} className="size-6" />
              </div>
              <div>
                <h2 id="cloud-connect-title" className="text-lg font-semibold leading-7">
                  Connect Cloud Vault
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Sign in with Google to enable cloud backup for your files. Your local workspace files stay safely on this device.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col items-center justify-center gap-3">
              {isBackendAuthEnabled ? (
                <button
                  type="button"
                  onClick={() => {
                    window.location.assign(`${authApiUrl('/google/start')}?returnTo=${encodeURIComponent(pathname)}`)
                  }}
                  className="min-h-11 rounded-[var(--radius-control)] bg-foreground px-5 text-base font-semibold text-background transition hover:opacity-90"
                >
                  Sign in with Google
                </button>
              ) : (
                <div ref={googleButtonRef} className="flex min-h-[44px] justify-center" />
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setIsGoogleModalOpen(false)}
                className="min-h-11 rounded-[var(--radius-control)] border border-[var(--app-border)] px-4 text-sm font-semibold transition hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </section>
        </div>
      ) : null}
      <WorkspaceModal
        isOpen={isWorkspaceModalOpen}
        onClose={() => setIsWorkspaceModalOpen(false)}
      />
      <MissingMirrorModal />
    </SidebarProvider>
  )
}
