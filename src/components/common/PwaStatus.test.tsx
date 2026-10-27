// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { usePwaStore } from '../../stores/usePwaStore'
import { PwaStatus } from './PwaStatus'

const mockUpdateServiceWorker = vi.fn()
const mockSetNeedRefresh = vi.fn()
let mockNeedRefreshState = false

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [mockNeedRefreshState, mockSetNeedRefresh],
    updateServiceWorker: mockUpdateServiceWorker,
  }),
}))

vi.mock('../../stores/useAuthStore', () => ({
  useAuthStore: () => ({ email: 'test@example.com', isAuthenticated: true }),
}))

describe('PwaStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNeedRefreshState = false
    usePwaStore.setState({
      needRefresh: false,
      isUpdating: false,
      updateProgress: 0,
      updateStatusMessage: null,
      registration: null,
      updateServiceWorkerFn: null,
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders nothing when there is no update available', () => {
    render(<PwaStatus />)
    expect(screen.queryByRole('heading', { name: /Update available/i })).not.toBeInTheDocument()
  })

  it('renders update dialog and allows dismissing via Not now', () => {
    usePwaStore.setState({ needRefresh: true })
    render(<PwaStatus />)

    expect(screen.getByRole('heading', { name: /Update available/i })).toBeInTheDocument()
    const notNowBtn = screen.getByRole('button', { name: /Not now/i })
    expect(notNowBtn).toBeInTheDocument()

    fireEvent.click(notNowBtn)

    expect(usePwaStore.getState().needRefresh).toBe(false)
    expect(mockSetNeedRefresh).toHaveBeenCalledWith(false)
  })

  it('renders progress bar when isUpdating is true', () => {
    usePwaStore.setState({
      needRefresh: true,
      isUpdating: true,
      updateProgress: 65,
      updateStatusMessage: 'Syncing pending changes to cloud…',
    })
    render(<PwaStatus />)

    expect(screen.getByText('Syncing pending changes to cloud…')).toBeInTheDocument()
    expect(screen.getByText('65% completed')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })
})
