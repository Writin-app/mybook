// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SettingsPage } from './SettingsPage'

const mockNavigate = vi.hoisted(() => vi.fn())
const mockLogout = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: () => [],
}))

vi.mock('../hooks/useDriveBootstrap', () => ({
  useDriveBootstrap: () => ({ isPreparing: false, statusMessage: null }),
}))

vi.mock('../services/googleDrive', () => ({
  getDriveFolderStatus: vi.fn().mockResolvedValue(null),
  openMyBookFolderInDrive: vi.fn(),
}))

vi.mock('../database/db', () => ({
  db: {
    files: { filter: vi.fn(() => ({ toArray: vi.fn().mockResolvedValue([]) })) },
    syncQueue: { toArray: vi.fn().mockResolvedValue([]) },
    open: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../database/repositories', () => ({
  processPendingDriveFolderSync: vi.fn(),
}))

vi.mock('../stores/useAppStore', () => ({
  useAppStore: () => ({ theme: 'light', toggleTheme: vi.fn() }),
}))

vi.mock('../stores/useAuthStore', () => ({
  useAuthStore: () => ({ email: 'user@example.com', logout: mockLogout, reconnect: vi.fn() }),
}))

const mockCanPick = vi.hoisted(() => ({ value: true }))
const mockPickLocal = vi.hoisted(() => vi.fn())

vi.mock('../services/localWorkspace', () => ({
  canPickDeviceDirectory: () => mockCanPick.value,
  getLocalStorageProtectionStatus: vi.fn().mockResolvedValue({ persisted: true }),
  getLocalWorkspaceDetails: vi.fn().mockResolvedValue(null),
  pickLocalWorkspaceDirectory: mockPickLocal,
  requestPersistentLocalStorage: vi.fn().mockResolvedValue(true),
  saveDeviceDirectoryHandle: vi.fn().mockResolvedValue(undefined),
  saveLocalWorkspaceDetails: vi.fn().mockResolvedValue(undefined),
  writeLocalWorkspaceFile: vi.fn().mockResolvedValue(undefined),
}))

describe('SettingsPage', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('logs out from Preferences and navigates to login without blocked-route state', async () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: /log out/i }))

    await waitFor(() => expect(mockLogout).toHaveBeenCalled())
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true, state: null })
  })

  it('shows Mirror Drive files section when browser supports device folder picker', async () => {
    mockCanPick.value = true
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: /Mirror Drive files to folder/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Make All Available Locally/i })).toBeInTheDocument()
  })

  it('hides Mirror Drive files section when browser does not support folder picker', async () => {
    mockCanPick.value = false
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)

    expect(screen.queryByRole('heading', { name: /Mirror Drive files to folder/i })).not.toBeInTheDocument()
  })

  it('renders app updates section and handles checking for updates', async () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: /App version & updates/i })).toBeInTheDocument()
    const checkBtn = screen.getByRole('button', { name: /Check for updates/i })
    expect(checkBtn).toBeInTheDocument()

    fireEvent.click(checkBtn)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /App version & updates/i })).toBeInTheDocument()
    })
  })
})
