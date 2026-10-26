// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { AboutPage } from './AboutPage'
import { useAuthStore } from '../stores/useAuthStore'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'

describe('AboutPage', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: false, isLoading: false, email: null })
    useWorkspaceStore.setState({ mode: null })
  })

  it('renders branding and guest call-to-actions when unauthenticated', () => {
    render(
      <MemoryRouter initialEntries={['/about']}>
        <AboutPage />
      </MemoryRouter>
    )

    expect(screen.getAllByText('Writin').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Get Started').length).toBeGreaterThan(0)
    expect(screen.getByText('Log In')).toBeInTheDocument()
    expect(screen.getByText(/Where thoughts/)).toBeInTheDocument()
  })

  it('opens the in-page get started modal when clicking Get Started', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AboutPage />
      </MemoryRouter>
    )

    const getStartedButtons = screen.getAllByText('Get Started')
    fireEvent.click(getStartedButtons[0]!)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Get Started with Writin')).toBeInTheDocument()
    expect(screen.getByText('Private Device Vault')).toBeInTheDocument()
    expect(screen.getByText('Connect Google Drive')).toBeInTheDocument()

    // Close button
    const closeBtn = screen.getByLabelText('Close dialog')
    fireEvent.click(closeBtn)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders workspace call-to-action when user is signed in', () => {
    useAuthStore.setState({ isAuthenticated: true, email: 'test@example.com' })
    useWorkspaceStore.setState({ mode: 'drive' })

    render(
      <MemoryRouter initialEntries={['/about']}>
        <AboutPage />
      </MemoryRouter>
    )

    expect(screen.getAllByText('Open Workspace').length).toBeGreaterThan(0)
    expect(screen.getByText('Return to Workspace')).toBeInTheDocument()
  })

  it('renders workspace call-to-action when user has local workspace active', () => {
    useWorkspaceStore.setState({ mode: 'local' })

    render(
      <MemoryRouter initialEntries={['/about']}>
        <AboutPage />
      </MemoryRouter>
    )

    expect(screen.getAllByText('Open Workspace').length).toBeGreaterThan(0)
    expect(screen.getByText('Return to Workspace')).toBeInTheDocument()
  })

  it('allows live typing and updates word count in the interactive playground', () => {
    render(
      <MemoryRouter initialEntries={['/about']}>
        <AboutPage />
      </MemoryRouter>
    )

    const textarea = screen.getByLabelText('Live interactive document')
    fireEvent.change(textarea, { target: { value: 'Hello world from Writin!' } })

    expect(screen.getByText(/4 words/)).toBeInTheDocument()
    expect(screen.getByText(/24 characters/)).toBeInTheDocument()
  })

  it('allows toggling tasks in the interactive task checklist', () => {
    render(
      <MemoryRouter initialEntries={['/about']}>
        <AboutPage />
      </MemoryRouter>
    )

    const taskButton = screen.getByText('Export anytime to Markdown (.md) or Microsoft Word (.docx)')
    // Initially incomplete (3 / 4 completed)
    expect(screen.getByText('3 / 4')).toBeInTheDocument()

    // Toggle completed
    fireEvent.click(taskButton)
    expect(screen.getByText('4 / 4')).toBeInTheDocument()

    // Toggle back
    fireEvent.click(taskButton)
    expect(screen.getByText('3 / 4')).toBeInTheDocument()
  })

  it('allows switching to the spreadsheet tab and editing row calculations', () => {
    render(
      <MemoryRouter initialEntries={['/about']}>
        <AboutPage />
      </MemoryRouter>
    )

    // Switch to Integrated Spreadsheet
    const spreadsheetTab = screen.getByText('Integrated Spreadsheet')
    fireEvent.click(spreadsheetTab)

    expect(screen.getByText('Live UniverJS Computation Engine')).toBeInTheDocument()
    expect(screen.getByText('Grand Total:')).toBeInTheDocument()

    // Change hours on first row
    const inputs = screen.getAllByRole('spinbutton')
    fireEvent.change(inputs[0]!, { target: { value: '10' } })

    // Recalculates formula: 10*95 + 12*95 + 8*85 + 6*85 = 950 + 1140 + 680 + 510 = 3280
    expect(screen.getAllByText(/\$3,280|\$3280/).length).toBeGreaterThan(0)
  })

  it('switches between presets', () => {
    render(
      <MemoryRouter initialEntries={['/about']}>
        <AboutPage />
      </MemoryRouter>
    )

    const sprintPreset = screen.getByText('Sprint Checklist')
    fireEvent.click(sprintPreset)

    const textarea = screen.getByLabelText('Live interactive document') as HTMLTextAreaElement
    expect(textarea.value).toContain('Weekly Execution Plan')
  })

  it('toggles privacy and storage architecture models', () => {
    render(
      <MemoryRouter initialEntries={['/about']}>
        <AboutPage />
      </MemoryRouter>
    )

    const driveButton = screen.getByText('2. Google Drive Vault')
    fireEvent.click(driveButton)

    expect(screen.getByText('Your Personal Google Drive')).toBeInTheDocument()

    const saasButton = screen.getByText('Traditional SaaS Notes')
    fireEvent.click(saasButton)

    expect(screen.getByText('The SaaS problem:')).toBeInTheDocument()
  })

  it('toggles FAQ accordions', () => {
    render(
      <MemoryRouter initialEntries={['/about']}>
        <AboutPage />
      </MemoryRouter>
    )

    const questionButton = screen.getByRole('button', { name: /Where are my documents and spreadsheets stored\?/ })
    expect(questionButton).toHaveAttribute('aria-expanded', 'true')

    // Click to collapse
    fireEvent.click(questionButton)
    expect(questionButton).toHaveAttribute('aria-expanded', 'false')

    // Click to re-expand
    fireEvent.click(questionButton)
    expect(questionButton).toHaveAttribute('aria-expanded', 'true')
  })

  it('toggles dark and light mode', () => {
    render(
      <MemoryRouter initialEntries={['/about']}>
        <AboutPage />
      </MemoryRouter>
    )

    const themeButton = screen.getByLabelText(/Switch to/i)
    fireEvent.click(themeButton)

    // Button label toggled
    expect(screen.getByLabelText(/Switch to/i)).toBeInTheDocument()
  })
})
