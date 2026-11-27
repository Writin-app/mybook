import { useEffect, useRef, useState } from 'react'
import { Bug01Icon, Clock01Icon, CloudUploadIcon, CommandIcon, Delete03Icon, Download01Icon, File01Icon, FilterHorizontalIcon, Folder01Icon, HelpSquareIcon, InformationSquareIcon, LibraryIcon, LogoutSquare01Icon, Moon02Icon, PaintBoardIcon, PlusSignIcon, Search01Icon, Settings02Icon, StarsIcon, Sun01Icon, UnfoldMoreIcon, UserIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'

import { useAppStore } from '../../stores/useAppStore'
import { authApiUrl, isBackendAuthEnabled, useAuthStore } from '../../stores/useAuthStore'
import { useWorkspaceStore } from '../../stores/useWorkspaceStore'
import { loadGoogleIdentity } from '../../utils/googleIdentity'
import { useDriveBootstrap } from '../../hooks/useDriveBootstrap'
import { useDriveLibrarySync } from '../../hooks/useDriveLibrarySync'
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
  findFolderConflict,
  forgetCloudMirrorEntry,
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
import { toast } from '../ui/toast'
import { Input } from '../ui/input'
import { Kbd, KbdGroup } from '../ui/kbd'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { Badge } from '../ui/badge'
import { FolderIllustration } from '../ui/folder-illustration'
import { IconWrapper } from '../ui/icon-wrapper'
import { SegmentedControl, SegmentedControlButton } from '../ui/segmented-control'
import { NavGroup, NavItem, TrailingContent } from './sidenav/SidenavPrimitives'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from '../ui/sidebar'
import { MobileBottomNavigation } from './MobileBottomNavigation'
import { isSupportedDocumentImport, queueDocumentImport } from '../../services/documentImport'

function MobileSidebarRouteDismissal() {
  const { isMobile, openMobile, setOpenMobile } = useSidebar()
  const location = useLocation()
  const previousLocationKeyRef = useRef(location.key)

  useEffect(() => {
    if (isMobile && openMobile && previousLocationKeyRef.current !== location.key) {
      setOpenMobile(false)
    }
    previousLocationKeyRef.current = location.key
  }, [location.key, isMobile, openMobile, setOpenMobile])

  return null
}

export function AppLayout() {
  const { themePreference, setThemePreference } = useAppStore()
  const { email, displayName: accountDisplayName, avatarUrl, isAuthenticated, completeLogin, logout } = useAuthStore()
  const { mode: workspaceMode, workspaceRevision, isMirrorFolderMissing, isMirroring, mirrorProgress, selectGoogleWorkspace } = useWorkspaceStore()
  const { files, folders, isLoading } = useLibraryData()
  const { isFetchingFiles = false, fetchProgress = 0 } = useDriveBootstrap() ?? {}
  useDriveLibrarySync()
  useLocalMirrorSync()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const importInputRef = useRef<HTMLInputElement>(null)
  const isEditor = pathname.startsWith('/document/') || pathname.startsWith('/spreadsheet/')
  const favorites = activeFavoriteItems(files, folders)
  const recentFiles = files.filter((file) => !file.isDeleted).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, 5)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false)
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false)
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false)
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
  const isSignedInAccount = !isLocalWorkspace && isAuthenticated && Boolean(email)
  const accountTitle = isSignedInAccount
    ? (accountDisplayName || email?.split('@')[0] || 'Google account')
    : 'Local device'
  const profileEmail = email
  const accountNameParts = accountTitle.trim().split(/\s+/u).filter(Boolean)
  const firstInitial = accountNameParts[0]?.[0] ?? ''
  const lastInitial = accountNameParts.at(-1)?.[0] ?? ''
  const initials =
    accountNameParts.length >= 2
      ? `${firstInitial}${lastInitial}`.toUpperCase()
      : (accountNameParts[0]?.slice(0, 2).toUpperCase() || 'WR')

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
        ...files.filter((file) => !file.isDeleted && file.name.toLocaleLowerCase().includes(normalizedSearchQuery)).map((file) => ({ kind: 'file' as const, id: file.id, name: file.name, type: file.type, folderId: file.folderId })),
        ...folders.filter((folder) => !folder.isDeleted && folder.name.toLocaleLowerCase().includes(normalizedSearchQuery)).map((folder) => ({ kind: 'folder' as const, id: folder.id, name: folder.name, type: 'folder' as const, parentId: folder.parentId })),
      ].slice(0, 8)
    : recentFiles.map((file) => ({ kind: 'file' as const, id: file.id, name: file.name, type: file.type, folderId: file.folderId }))
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
    headerTitle = 'Recent'
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
      <MobileSidebarRouteDismissal />
      <Sidebar
        side="left"
        collapsible="offcanvas"
        className="border-r border-[var(--token-colors-border-primary)] [&_[data-slot=sidebar-inner]]:gap-[var(--token-dimension-spacing-16,16px)] [&_[data-slot=sidebar-inner]]:bg-[var(--token-overlay-backdrop-overlay-backdrop-light,rgba(108,113,128,0.05))] [&_[data-slot=sidebar-inner]]:p-[var(--token-dimension-spacing-12,12px)] [&_[data-slot=sidebar-inner]]:backdrop-blur-[20px]"
      >
        <SidebarHeader className="shrink-0 gap-[var(--token-dimension-spacing-16,16px)] p-0">
          {/* Top inline vault dropdown trigger */}
          <DropdownMenu onOpenChange={(open) => { if (open) void listAllWorkspaces().then(setWorkspaces) }}>
            <DropdownMenuTrigger
              render={<button type="button" />}
              aria-label={`Select vault, current vault ${vaultName}`}
              className="inline-flex w-fit max-w-full items-center gap-[var(--token-dimension-spacing-6,6px)] rounded-[var(--token-dimension-radius-8,8px)] px-[var(--token-dimension-spacing-8,8px)] py-[var(--token-dimension-spacing-6,6px)] text-left text-[var(--token-colors-foreground-secondary)] transition-colors hover:bg-[var(--token-colors-background-muted)] focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--token-focus-ring-default-inner),0_0_1px_3px_var(--token-focus-ring-default-outer)]"
            >
              <span className="min-w-0 truncate font-[family-name:var(--token-typography-font-family-primary)] text-[length:var(--token-typography-font-size-14,14px)] font-[number:var(--token-typography-font-weight-medium,500)] leading-[18px] antialiased">
                {vaultName}
              </span>
              <Badge
                variant={isLocalWorkspace ? 'outline' : 'secondary'}
                size="sm"
                className="shrink-0"
              >
                <span>
                  {isLocalWorkspace
                    ? 'On local'
                    : activeWorkspace?.hasLocalMirror
                      ? 'On cloud • Mirrored'
                      : 'On cloud'}
                </span>
              </Badge>
              <IconWrapper size="20">
                <HugeiconsIcon icon={UnfoldMoreIcon} strokeWidth={1.75} />
              </IconWrapper>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[256px]">
              {workspaces.length > 0 ? (
                <>
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Vaults</DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={workspaces.find((ws) => ws.isActive)?.id ?? ''}
                      onValueChange={(value) => {
                        const target = workspaces.find((ws) => ws.id === value)
                        if (target && !target.isActive) {
                          void switchWorkspace(target).then(() =>
                            toast.add({
                              title: 'Vault switched',
                              description: `Switched to “${target.name}”.`,
                              type: 'success',
                              priority: 'low',
                            }),
                          )
                        }
                      }}
                    >
                      {workspaces.map((ws) => (
                        <DropdownMenuRadioItem
                          key={ws.id}
                          value={ws.id}
                          trailingContent={
                            <Badge
                              variant={ws.type === 'cloud' ? 'secondary' : 'outline'}
                              size="sm"
                            >
                              <span>
                                {ws.type === 'cloud'
                                  ? ws.hasLocalMirror
                                    ? 'On cloud • Mirrored'
                                    : 'On cloud'
                                  : 'On local'}
                              </span>
                            </Badge>
                          }
                        >
                          <span className={ws.isActive ? 'font-medium' : undefined}>{ws.name}</span>
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                </>
              ) : null}
              <DropdownMenuItem
                leadingIcon={<HugeiconsIcon icon={PlusSignIcon} strokeWidth={1.75} className="size-4 text-[var(--token-colors-foreground-secondary)]" />}
                onClick={() => setIsWorkspaceModalOpen(true)}
              >
                Create vault
              </DropdownMenuItem>
              {!isLocalWorkspace && canPickDeviceDirectory() && !activeWorkspace?.hasLocalMirror ? (
                <DropdownMenuItem
                  leadingIcon={<HugeiconsIcon icon={Folder01Icon} strokeWidth={1.75} className="size-4 text-[var(--token-colors-foreground-secondary)]" />}
                  onClick={async () => {
                    try {
                      const picked = await pickLocalWorkspaceDirectory()
                      if (picked) {
                        const conflict = await findFolderConflict(picked.handle, activeWorkspace?.driveFolderId)
                        if (conflict) {
                          toast.add({
                            title: conflict.isSameVault ? 'Already mirrored' : 'Folder already in use',
                            description: conflict.isSameVault
                              ? `“${vaultName}” is already mirrored to “${picked.name}”.`
                              : `“${picked.name}” is already used by “${conflict.vaultName}”. Please choose a different folder.`,
                            type: 'error',
                            priority: 'high',
                          })
                          return
                        }
                        await mirrorCurrentCloudWorkspaceToLocal(picked.handle)
                        toast.add({ title: 'Local mirror created', description: `Mirrored “${vaultName}” to “${picked.name}”.`, type: 'success', priority: 'low' })
                      }
                    } catch {
                      // The user cancelled the directory picker.
                    }
                  }}
                >
                  Mirror to local device
                </DropdownMenuItem>
              ) : null}
              {!isLocalWorkspace && activeWorkspace?.hasLocalMirror ? (
                <DropdownMenuItem
                  leadingIcon={<HugeiconsIcon icon={Folder01Icon} strokeWidth={1.75} className="size-4 text-[var(--token-colors-foreground-secondary)]" />}
                  onClick={async () => {
                    await forgetCloudMirrorEntry(activeWorkspace?.driveFolderId)
                    useWorkspaceStore.getState().bumpWorkspaceRevision()
                    toast.add({ title: 'Mirror disconnected', description: 'Files remain in Google Drive.', type: 'info', priority: 'low' })
                  }}
                >
                  Disconnect local mirror
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                leadingIcon={<HugeiconsIcon icon={Download01Icon} strokeWidth={1.75} className="size-4 text-[var(--token-colors-foreground-secondary)]" />}
                onClick={() => void downloadVaultZip({ vaultName })}
              >
                Export full vault
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Search trigger */}
          <button
            type="button"
            aria-label="Open search"
            onClick={() => setSearchOpen(true)}
            className="flex h-[40px] w-full items-center gap-[var(--token-dimension-spacing-8,8px)] rounded-[var(--token-dimension-radius-10,10px)] border border-[var(--token-colors-border-secondary)] bg-[var(--token-colors-background-default)] px-[var(--token-dimension-spacing-10,10px)] text-left transition-colors hover:bg-[var(--token-colors-background-quiet)] focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--token-focus-ring-default-inner),0_0_1px_3px_var(--token-focus-ring-default-outer)]"
          >
            <IconWrapper size="20" className="text-[var(--token-colors-foreground-secondary)]">
              <HugeiconsIcon icon={Search01Icon} strokeWidth={1.75} />
            </IconWrapper>
            <span className="min-w-0 flex-1 font-[family-name:var(--token-typography-font-family-primary)] text-[length:var(--token-typography-font-size-14,14px)] font-[number:var(--token-typography-font-weight-regular,400)] leading-[18px] text-[var(--token-colors-foreground-muted)] antialiased">
              Search
            </span>
            <TrailingContent type="kbd" size="sm" label="⌘K" />
          </button>

          {/* Primary nav items */}
          <div className="flex w-full flex-col gap-[var(--token-dimension-spacing-4,4px)]">
            <NavItem
              to="/home"
              label="Recent"
              active={pathname === '/home'}
              icon={<HugeiconsIcon icon={Clock01Icon} strokeWidth={1.75} />}
            />
            <NavItem
              to="/folders"
              label="Library"
              active={pathname === '/folders' || pathname.startsWith('/folders/')}
              icon={<HugeiconsIcon icon={LibraryIcon} strokeWidth={1.75} />}
            />
          </div>
        </SidebarHeader>

        <SidebarContent className="min-h-0 flex-1 gap-0 overflow-y-auto overscroll-contain">
          <NavGroup
            title="Favorites"
            actionLabel={favorites.length > 0 ? 'See all' : undefined}
            actionHref={favorites.length > 0 ? '/favorites' : undefined}
            showSeparator={false}
          >
            {favorites.length > 0 ? (
              favorites.map((favorite) => {
                const path = favorite.kind === 'folder' ? `/folders/${favorite.item.id}` : `/${favorite.item.type}/${favorite.item.id}`
                const label = favorite.kind === 'folder' ? `Open favorite folder ${favorite.item.name}` : `Open favorite ${favorite.item.type} ${favorite.item.name}`
                return (
                  <NavItem
                    key={`${favorite.kind}:${favorite.item.id}`}
                    to={path}
                    ariaLabel={label}
                    label={favorite.item.name}
                    active={pathname === path}
                    icon={
                      favorite.kind === 'folder' ? (
                        <FolderIllustration size="xs" aria-hidden="true" />
                      ) : (
                        <HugeiconsIcon icon={File01Icon} strokeWidth={1.75} />
                      )
                    }
                  />
                )
              })
            ) : (
              <p className="px-[var(--token-dimension-spacing-8,8px)] py-[var(--token-dimension-spacing-8,8px)] font-[family-name:var(--token-typography-font-family-primary)] text-xs text-[var(--token-colors-foreground-muted)]">
                Your favorites will appear here.
              </p>
            )}
          </NavGroup>
        </SidebarContent>

        <SidebarFooter className="shrink-0 gap-[var(--token-dimension-spacing-16,16px)] p-0">
          <div className="flex w-full flex-col gap-[var(--token-dimension-spacing-4,4px)]">
            <NavItem
              to="/trash"
              label="Trash"
              active={pathname === '/trash'}
              icon={<HugeiconsIcon icon={Delete03Icon} strokeWidth={1.75} />}
            />
            <NavItem
              label="Support & help"
              onClick={() => {
                window.location.href = 'mailto:support@writin.app?subject=Writin%20support%20request'
              }}
              icon={<HugeiconsIcon icon={HelpSquareIcon} strokeWidth={1.75} />}
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={<button type="button" />}
              aria-label="Open account menu"
              className="flex h-[46px] w-full items-center gap-[var(--token-dimension-spacing-8,8px)] rounded-[var(--token-dimension-radius-12,12px)] border border-[var(--token-colors-border-secondary)] bg-[var(--token-colors-background-default)] px-[var(--token-dimension-spacing-8,8px)] py-[var(--token-dimension-spacing-6,6px)] text-left transition-colors hover:bg-[var(--token-colors-background-quiet)] focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--token-focus-ring-default-inner),0_0_1px_3px_var(--token-focus-ring-default-outer)]"
            >
              <Avatar size="sm" className="size-[32px] shrink-0">
                {isSignedInAccount && avatarUrl ? (
                  <AvatarImage src={avatarUrl} alt={accountTitle} />
                ) : null}
                <AvatarFallback
                  size="sm"
                  initials={isSignedInAccount ? initials : undefined}
                />
              </Avatar>

              <div className="flex min-w-0 flex-1 flex-col gap-[var(--token-dimension-spacing-2,2px)]">
                <span className="truncate font-[family-name:var(--token-typography-font-family-primary)] text-[length:var(--token-typography-font-size-12,12px)] font-[number:var(--token-typography-font-weight-medium,500)] leading-[var(--token-typography-line-height-16,16px)] text-[var(--token-colors-foreground-primary)] antialiased">
                  {accountTitle}
                </span>
                {isSignedInAccount && profileEmail ? (
                  <span className="truncate font-[family-name:var(--token-typography-font-family-primary)] text-[length:var(--token-typography-font-size-10,10px)] font-[number:var(--token-typography-font-weight-regular,400)] leading-[14px] text-[var(--token-colors-foreground-subtle)] antialiased">
                    {profileEmail}
                  </span>
                ) : null}
              </div>

              <span className="flex size-8 shrink-0 items-center justify-center text-[var(--token-colors-foreground-secondary)]">
                <HugeiconsIcon icon={UnfoldMoreIcon} size={16} strokeWidth={1.75} />
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" sideOffset={8} className="w-[260px]">
              <DropdownMenuGroup>
                <DropdownMenuLabel>App actions</DropdownMenuLabel>
                <DropdownMenuItem
                  leadingIcon={<IconWrapper size="20"><HugeiconsIcon icon={UserIcon} strokeWidth={1.75} /></IconWrapper>}
                  onClick={() => navigate('/settings')}
                >
                  Profile
                </DropdownMenuItem>
                {isLocalWorkspace && !profileEmail ? (
                  <DropdownMenuItem
                    leadingIcon={<IconWrapper size="20"><HugeiconsIcon icon={CloudUploadIcon} strokeWidth={1.75} /></IconWrapper>}
                    onClick={() => setIsGoogleModalOpen(true)}
                  >
                    Connect cloud vault
                  </DropdownMenuItem>
                ) : null}
                <div className="flex h-8 items-center gap-[var(--token-dimension-spacing-8)] rounded-[var(--token-dimension-radius-8)] px-[var(--token-dimension-spacing-8)] py-[var(--token-dimension-spacing-6)] text-[length:var(--token-typography-font-size-14)] leading-[18px] text-[var(--token-colors-foreground-primary)]">
                  <IconWrapper size="20">
                    <HugeiconsIcon icon={PaintBoardIcon} strokeWidth={1.75} />
                  </IconWrapper>
                  <span className="min-w-0 flex-1 truncate">Appearance</span>
                  <SegmentedControl
                    size="xs"
                    iconOnly
                    value={themePreference}
                    onValueChange={(value) => setThemePreference(value as 'system' | 'light' | 'dark')}
                    aria-label="Appearance theme"
                  >
                    <SegmentedControlButton value="system" aria-label="Use system theme">
                      <IconWrapper size="16">
                        <HugeiconsIcon icon={Settings02Icon} strokeWidth={1.75} />
                      </IconWrapper>
                    </SegmentedControlButton>
                    <SegmentedControlButton value="light" aria-label="Use light theme">
                      <IconWrapper size="16">
                        <HugeiconsIcon icon={Sun01Icon} strokeWidth={1.75} />
                      </IconWrapper>
                    </SegmentedControlButton>
                    <SegmentedControlButton value="dark" aria-label="Use dark theme">
                      <IconWrapper size="16">
                        <HugeiconsIcon icon={Moon02Icon} strokeWidth={1.75} />
                      </IconWrapper>
                    </SegmentedControlButton>
                  </SegmentedControl>
                </div>
                <DropdownMenuItem
                  leadingIcon={<IconWrapper size="20"><HugeiconsIcon icon={CommandIcon} strokeWidth={1.75} /></IconWrapper>}
                  onClick={() => setIsShortcutsOpen(true)}
                >
                  Shortcuts
                </DropdownMenuItem>
                <DropdownMenuItem
                  leadingIcon={<IconWrapper size="20"><HugeiconsIcon icon={FilterHorizontalIcon} strokeWidth={1.75} /></IconWrapper>}
                  onClick={() => navigate('/settings')}
                >
                  Settings
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Links</DropdownMenuLabel>
                <DropdownMenuItem
                  leadingIcon={<IconWrapper size="20"><HugeiconsIcon icon={InformationSquareIcon} strokeWidth={1.75} /></IconWrapper>}
                  onClick={() => navigate('/about')}
                >
                  About Writin
                </DropdownMenuItem>
                <DropdownMenuItem
                  leadingIcon={<IconWrapper size="20"><HugeiconsIcon icon={StarsIcon} strokeWidth={1.75} /></IconWrapper>}
                  onClick={() => navigate('/about')}
                >
                  What’s new
                </DropdownMenuItem>
                <DropdownMenuItem
                  leadingIcon={<IconWrapper size="20"><HugeiconsIcon icon={Bug01Icon} strokeWidth={1.75} /></IconWrapper>}
                  render={<a href="mailto:support@writin.app?subject=Writin%20issue%20report" />}
                >
                  Report an issue
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                leadingIcon={<IconWrapper size="20"><HugeiconsIcon icon={LogoutSquare01Icon} strokeWidth={1.75} /></IconWrapper>}
                onClick={() => void logout()}
              >
                {isLocalWorkspace ? 'Return to start' : 'Logout'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
      <Dialog open={isShortcutsOpen} onOpenChange={setIsShortcutsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
            <DialogDescription>Quick ways to navigate Writin.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            <span>Open search</span>
            <KbdGroup><Kbd>⌘</Kbd><Kbd>K</Kbd></KbdGroup>
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
