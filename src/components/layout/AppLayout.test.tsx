// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AppLayout } from './AppLayout'
import { useDriveBootstrap } from '../../hooks/useDriveBootstrap'
import { useAuthStore } from '../../stores/useAuthStore'
import { useWorkspaceStore } from '../../stores/useWorkspaceStore'
import type { MyBookFile, MyBookFolder } from '../../types/files'

const mockLibraryData = vi.hoisted((): { files: MyBookFile[]; folders: MyBookFolder[]; isLoading: boolean } => ({
  files: [],
  folders: [],
  isLoading: false,
}))

vi.mock('../../hooks/useDriveBootstrap', () => ({
  useDriveBootstrap: vi.fn(() => ({ isPreparing: false, statusMessage: null, isFetchingFiles: false, fetchProgress: 0, folderId: null })),
}))

vi.mock('../../hooks/useLocalMirrorSync', () => ({
  useLocalMirrorSync: vi.fn(),
}))

vi.mock('../../hooks/useLibraryData', () => ({
  useLibraryData: () => mockLibraryData,
}))

vi.mock('../../services/workspaceManager', async () => {
  const actual = await vi.importActual<typeof import('../../services/workspaceManager')>('../../services/workspaceManager')
  return {
    ...actual,
    listAllWorkspaces: vi.fn().mockResolvedValue([]),
  }
})

vi.mock('../../services/googleDrive', () => ({
  findDriveRootFolderByName: vi.fn().mockResolvedValue(null),
  listExistingDriveVaults: vi.fn().mockResolvedValue([]),
  selectExistingDriveVault: vi.fn().mockResolvedValue(undefined),
  setDriveVaultRootName: vi.fn().mockResolvedValue(undefined),
  getDriveVaultRootName: vi.fn().mockResolvedValue('Writin'),
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('AppLayout sidebar favorites', () => {
  beforeEach(() => {
    mockLibraryData.files = []
    mockLibraryData.folders = []
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  it.each(['/home', '/folders', '/settings', '/search'])('hides mobile leading actions on %s', (path) => {
    vi.stubGlobal('innerWidth', 375)
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route element={<AppLayout />}><Route path={path} element={<p>Page content</p>} /></Route></Routes>
      </MemoryRouter>,
    )
    expect(screen.queryByRole('button', { name: 'Go back' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open navigation' })).not.toBeInTheDocument()
  })

  it('keeps the Favorites section empty when there are no favorites', () => {
    renderLayout()

    expect(screen.getByText('Favorites')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Open favorite/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'See all favorites' })).not.toBeInTheDocument()
  })

  it('shows active favorite files and folders and excludes trashed favorites', () => {
    mockLibraryData.files = [
      file({ id: 'doc-1', name: 'Favorite doc', isFavorite: true, updatedAt: '2026-09-02T00:00:00.000Z' }),
      file({ id: 'doc-2', name: 'Trashed favorite', isFavorite: true, isDeleted: true, updatedAt: '2026-09-03T00:00:00.000Z' }),
      file({ id: 'doc-3', name: 'Plain doc', updatedAt: '2026-09-04T00:00:00.000Z' }),
    ]
    mockLibraryData.folders = [
      folder({ id: 'folder-1', name: 'Favorite folder', isFavorite: true, updatedAt: '2026-09-01T00:00:00.000Z' }),
      folder({ id: 'folder-2', name: 'Trashed folder', isFavorite: true, isDeleted: true, updatedAt: '2026-09-05T00:00:00.000Z' }),
    ]

    renderLayout()

    expect(screen.getByRole('link', { name: 'Open favorite document Favorite doc' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open favorite folder Favorite folder' })).toBeInTheDocument()
    expect(screen.queryByText('Trashed favorite')).not.toBeInTheDocument()
    expect(screen.queryByText('Trashed folder')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Open favorite document Plain doc' })).not.toBeInTheDocument()
  })

  it('shows at most five favorites directly and exposes More when more exist', () => {
    mockLibraryData.files = Array.from({ length: 6 }, (_, index) => file({
      id: `doc-${index + 1}`,
      name: `Favorite ${index + 1}`,
      isFavorite: true,
      updatedAt: `2026-09-0${index + 1}T00:00:00.000Z`,
    }))

    renderLayout()

    expect(screen.getAllByRole('link', { name: /Open favorite document Favorite/i })).toHaveLength(5)
    expect(screen.queryByText('Favorite 1')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'See all favorites' })).toHaveAttribute('href', '/favorites')
  })

  it('navigates favorite files and folders by stable ID', () => {
    mockLibraryData.files = [file({ id: 'same-doc-id', name: 'Same name', isFavorite: true, updatedAt: '2026-09-02T00:00:00.000Z' })]
    mockLibraryData.folders = [folder({ id: 'same-folder-id', name: 'Same name', isFavorite: true, updatedAt: '2026-09-01T00:00:00.000Z' })]

    renderLayout()

    expect(screen.getByRole('link', { name: 'Open favorite document Same name' })).toHaveAttribute('href', '/document/same-doc-id')
    expect(screen.getByRole('link', { name: 'Open favorite folder Same name' })).toHaveAttribute('href', '/folders/same-folder-id')
  })

  it('updates immediately when favorites are added, removed, restored, or renamed', () => {
    const { rerender } = renderLayout()

    expect(screen.queryByRole('link', { name: /Open favorite/i })).not.toBeInTheDocument()

    mockLibraryData.files = [file({ id: 'doc-1', name: 'Draft', isFavorite: true })]
    rerender(layoutTree())
    expect(screen.getByRole('link', { name: 'Open favorite document Draft' })).toBeInTheDocument()

    mockLibraryData.files = [file({ id: 'doc-1', name: 'Renamed draft', isFavorite: true })]
    rerender(layoutTree())
    expect(screen.getByRole('link', { name: 'Open favorite document Renamed draft' })).toBeInTheDocument()
    expect(screen.queryByText('Draft')).not.toBeInTheDocument()

    mockLibraryData.files = [file({ id: 'doc-1', name: 'Renamed draft', isFavorite: true, isDeleted: true })]
    rerender(layoutTree())
    expect(screen.queryByRole('link', { name: 'Open favorite document Renamed draft' })).not.toBeInTheDocument()

    mockLibraryData.files = [file({ id: 'doc-1', name: 'Renamed draft', isFavorite: true, isDeleted: false })]
    rerender(layoutTree())
    expect(screen.getByRole('link', { name: 'Open favorite document Renamed draft' })).toBeInTheDocument()

    mockLibraryData.files = [file({ id: 'doc-1', name: 'Renamed draft', isFavorite: false })]
    rerender(layoutTree())
    expect(screen.queryByRole('link', { name: 'Open favorite document Renamed draft' })).not.toBeInTheDocument()
  })

  it('opens the full Favorites surface from More', () => {
    mockLibraryData.files = Array.from({ length: 6 }, (_, index) => file({
      id: `doc-${index + 1}`,
      name: `Favorite ${index + 1}`,
      isFavorite: true,
      updatedAt: `2026-09-0${index + 1}T00:00:00.000Z`,
    }))

    renderLayout()

    fireEvent.click(screen.getByRole('link', { name: 'See all favorites' }))

    expect(screen.getByText('Favorites page')).toBeInTheDocument()
  })

  it('renders nested breadcrumbs in AppHeader for folders with no rename trigger and shows favorite and more actions', () => {
    mockLibraryData.folders = [
      folder({ id: 'folder-1', name: 'Work', parentId: null }),
      folder({ id: 'folder-2', name: 'Reports', parentId: 'folder-1', isFavorite: false }),
    ]

    render(
      <MemoryRouter initialEntries={['/folders/folder-2']}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/folders/:folderId" element={<p>Folder page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    const breadcrumbNav = screen.getByRole('navigation', { name: 'breadcrumb' })
    expect(breadcrumbNav).toHaveTextContent('Library')
    expect(breadcrumbNav).toHaveTextContent('Work')
    expect(breadcrumbNav).toHaveTextContent('Reports')

    // Breadcrumbs should be navigation only, not editable buttons with "Rename Reports"
    expect(screen.queryByRole('button', { name: /Rename Reports/i })).not.toBeInTheDocument()

    // Keep the sidebar control on desktop and use Back only on mobile.
    expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveClass('hidden', 'md:inline-flex')
    expect(screen.getByRole('button', { name: 'Go back' })).toHaveClass('md:hidden')

    // Favorite and More actions in header
    expect(screen.getByRole('button', { name: 'Add to favorites' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'More actions' })).toBeInTheDocument()
  })

  it('navigates mobile folders back through their parents to Library', () => {
    vi.stubGlobal('innerWidth', 375)
    mockLibraryData.folders = [
      folder({ id: 'parent', name: 'Work', parentId: null }),
      folder({ id: 'child', name: 'Reports', parentId: 'parent' }),
    ]
    render(
      <MemoryRouter initialEntries={['/folders/child']}>
        <Routes><Route element={<AppLayout />}>
          <Route path="/folders/:folderId" element={<p>Folder content</p>} />
          <Route path="/folders" element={<p>Library content</p>} />
        </Route></Routes>
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }))
    expect(screen.getByRole('navigation', { name: 'breadcrumb' })).toHaveTextContent('Work')
    expect(screen.getByRole('navigation', { name: 'breadcrumb' })).not.toHaveTextContent('Reports')
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }))
    expect(screen.getByText('Library content')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Go back' })).not.toBeInTheDocument()
  })

  it('renders Library title and no breadcrumbs on the main Library route', () => {
    render(
      <MemoryRouter initialEntries={['/folders']}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/folders" element={<p>Library root page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    expect(screen.queryByRole('navigation', { name: 'breadcrumb' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Library' })).toBeInTheDocument()
  })

  it('opens Google connect modal in-place when clicking Connect Cloud Vault in local workspace', () => {
    useWorkspaceStore.setState({ mode: 'local' })
    useAuthStore.setState({ email: null, isAuthenticated: false })
    renderLayout()

    const accountButton = screen.getByRole('button', { name: 'Account options' })
    expect(accountButton).toBeInTheDocument()
    fireEvent.click(accountButton)

    const connectButton = screen.getByText('Connect Cloud Vault')
    expect(connectButton).toBeInTheDocument()

    fireEvent.click(connectButton)
    expect(screen.getByRole('dialog', { name: 'Connect Cloud Vault' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog', { name: 'Connect Cloud Vault' })).not.toBeInTheDocument()
  })

  it('displays the connected Google email address under the vault name when signed in', () => {
    useWorkspaceStore.setState({ mode: 'local' })
    useAuthStore.setState({ email: 'author@example.com', isAuthenticated: true })
    renderLayout()

    expect(screen.getByText('author@example.com')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Connect Cloud Vault (Google)' })).not.toBeInTheDocument()
  })

  it('renders sync progress toast when fetching files', () => {
    vi.mocked(useDriveBootstrap).mockReturnValueOnce({
      isPreparing: true,
      statusMessage: 'Connecting...',
      isFetchingFiles: true,
      fetchProgress: 42,
      folderId: null,
    })
    renderLayout()
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Fetching your data…')).toBeInTheDocument()
    expect(screen.getByText('42%')).toBeInTheDocument()
  })

  it('renders workspace options in dropdown and opens workspace modal', async () => {
    useWorkspaceStore.setState({ mode: 'local' })
    useAuthStore.setState({ email: 'author@example.com', isAuthenticated: true })
    renderLayout()

    const accountButton = screen.getByRole('button', { name: 'Account options' })
    expect(accountButton).toBeInTheDocument()
    fireEvent.click(accountButton)

    expect(screen.getByText('Add Workspace...')).toBeInTheDocument()
    expect(screen.getByText('Export full vault (ZIP)')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Add Workspace...'))
    expect(await screen.findByRole('dialog', { name: 'Add New Workspace' })).toBeInTheDocument()
  })

  it('closes mobile sidebar when navigating to a new destination', async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('max-width: 767px'),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    render(
      <MemoryRouter initialEntries={['/home']}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/home" element={<p>Home page</p>} />
            <Route path="/folders" element={<p>Library page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    // Destination links in mobile sidebar trigger dismissal and route transition
    const libraryLinks = screen.getAllByRole('link', { name: 'Library' })
    expect(libraryLinks.length).toBeGreaterThan(0)
    const libraryLink = libraryLinks[0]
    expect(libraryLink).toBeDefined()
    fireEvent.click(libraryLink!)
    expect(await screen.findByText('Library page')).toBeInTheDocument()
  })
})


function renderLayout() {
  return render(layoutTree())
}

function layoutTree() {
  return (
    <MemoryRouter initialEntries={['/home']}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/home" element={<p>Home page</p>} />
          <Route path="/favorites" element={<p>Favorites page</p>} />
          <Route path="/folders/:folderId" element={<p>Folder page</p>} />
          <Route path="/document/:documentId" element={<p>Document page</p>} />
          <Route path="/spreadsheet/:spreadsheetId" element={<p>Spreadsheet page</p>} />
          <Route path="/settings" element={<p>Settings page</p>} />
          <Route path="/search" element={<p>Search page</p>} />
          <Route path="/trash" element={<p>Trash page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

function file(overrides: Partial<MyBookFile>): MyBookFile {
  return {
    id: 'file-id',
    driveFileId: null,
    name: 'File',
    type: 'document',
    folderId: null,
    content: '',
    mimeType: 'application/x-mybook-document',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    lastSyncedAt: null,
    syncStatus: 'pending',
    isDeleted: false,
    ...overrides,
  }
}

function folder(overrides: Partial<MyBookFolder>): MyBookFolder {
  return {
    id: 'folder-id',
    driveFolderId: null,
    name: 'Folder',
    parentId: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    isDeleted: false,
    ...overrides,
  }
}
