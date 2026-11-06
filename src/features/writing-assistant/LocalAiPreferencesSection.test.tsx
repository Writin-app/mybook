// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { mockEngine, mockPersistConsent } = vi.hoisted(() => ({
  mockEngine: {
    grantUserConsent: vi.fn(),
    init: vi.fn().mockResolvedValue(undefined),
    getStatus: vi.fn(() => ({ state: 'unavailable', progress: 0, isCached: false, message: '' })),
    subscribeStatus: vi.fn(() => () => undefined),
  },
  mockPersistConsent: vi.fn(),
}))

vi.mock('./localLlamaEngine', () => ({
  getSharedLocalLlamaEngine: () => mockEngine,
  LOCAL_AI_MODEL_DISPLAY_NAME: 'Llama 3.2 1B',
  persistLocalConsent: mockPersistConsent,
}))

import { LocalAiPreferencesSection } from './LocalAiPreferencesSection'

describe('LocalAiPreferencesSection', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('lets users start the one-time local model download from Preferences', async () => {
    render(<LocalAiPreferencesSection />)

    expect(screen.getByRole('heading', { name: 'Local AI Model - Llama 3.2 1B' })).toBeInTheDocument()
    expect(screen.getByText(/downloads once/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /download local ai/i }))

    await waitFor(() => expect(mockEngine.init).toHaveBeenCalledOnce())
    expect(mockPersistConsent).toHaveBeenCalledWith(true)
    expect(mockEngine.grantUserConsent).toHaveBeenCalledOnce()
  })
})
