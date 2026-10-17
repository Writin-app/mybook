// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WorkspaceTabBar } from './WorkspaceTabBar'
import { useWorkspaceTabsStore } from '../../stores/useWorkspaceTabsStore'
import { SidebarProvider } from '../ui/sidebar'

afterEach(() => {
  cleanup()
})

describe('WorkspaceTabBar', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    })
    useWorkspaceTabsStore.setState({
      tabs: [{ id: 'home-tab', history: ['/home'], historyIndex: 0 }],
      panes: [{ id: 'primary', tabId: 'home-tab' }],
      activeTabId: 'home-tab',
      activePaneId: 'primary',
      tabTitles: {},
      splitTabId: null,
      activePane: 'primary',
      primaryPath: '/home',
      splitPath: null,
      expectedRoute: null,
    })
  })

  it('renders tab label and permanently shows All open tabs icon', () => {
    render(
      <SidebarProvider>
        <MemoryRouter>
          <WorkspaceTabBar />
        </MemoryRouter>
      </SidebarProvider>
    )

    expect(screen.getByRole('tab', { name: 'Home' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'All open tabs' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open a file in a new tab' })).toBeInTheDocument()
  })

  it('immediately displays updated tab title from store without delay', () => {
    useWorkspaceTabsStore.setState({
      tabs: [{ id: 'doc-tab', history: ['/document/doc-1'], historyIndex: 0 }],
      panes: [{ id: 'primary', tabId: 'doc-tab' }],
      activeTabId: 'doc-tab',
      tabTitles: { 'doc-1': 'Instant Title Update' },
    })

    render(
      <SidebarProvider>
        <MemoryRouter>
          <WorkspaceTabBar />
        </MemoryRouter>
      </SidebarProvider>
    )

    expect(screen.getByRole('tab', { name: 'Instant Title Update' })).toBeInTheDocument()
  })

  it('displays Home when navigating from an open file to /home on the same tab', () => {
    useWorkspaceTabsStore.setState({
      tabs: [{ id: 'tab-1', history: ['/document/doc-1'], historyIndex: 0 }],
      panes: [{ id: 'primary', tabId: 'tab-1' }],
      activeTabId: 'tab-1',
      activePaneId: 'primary',
      tabTitles: { 'tab-1': 'My Document', 'doc-1': 'My Document' },
    })

    const { rerender } = render(
      <SidebarProvider>
        <MemoryRouter>
          <WorkspaceTabBar />
        </MemoryRouter>
      </SidebarProvider>
    )

    expect(screen.getByRole('tab', { name: 'My Document' })).toBeInTheDocument()

    // Navigate to /home on the same tab (e.g. clicking Home from sidebar)
    useWorkspaceTabsStore.getState().ensurePath('/home')

    rerender(
      <SidebarProvider>
        <MemoryRouter>
          <WorkspaceTabBar />
        </MemoryRouter>
      </SidebarProvider>
    )

    expect(screen.getByRole('tab', { name: 'Home' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'My Document' })).not.toBeInTheDocument()

    // Navigating back returns to the document and displays the document title
    useWorkspaceTabsStore.getState().go(-1)

    rerender(
      <SidebarProvider>
        <MemoryRouter>
          <WorkspaceTabBar />
        </MemoryRouter>
      </SidebarProvider>
    )

    expect(screen.getByRole('tab', { name: 'My Document' })).toBeInTheDocument()
  })

  it('shows close buttons when multiple tabs are present and protects single tab', () => {
    const { rerender } = render(
      <SidebarProvider>
        <MemoryRouter>
          <WorkspaceTabBar />
        </MemoryRouter>
      </SidebarProvider>
    )

    expect(screen.queryByRole('button', { name: /Close Home/i })).not.toBeInTheDocument()

    useWorkspaceTabsStore.setState({
      tabs: [
        { id: 'home-tab', history: ['/home'], historyIndex: 0 },
        { id: 'doc-tab', history: ['/document/doc-1'], historyIndex: 0 },
      ],
      tabTitles: { 'doc-tab': 'My Document' },
    })

    rerender(
      <SidebarProvider>
        <MemoryRouter>
          <WorkspaceTabBar />
        </MemoryRouter>
      </SidebarProvider>
    )

    expect(screen.getByRole('button', { name: /Close Home tab/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Close My Document tab/i })).toBeInTheDocument()
  })

  it('does not render back and forward arrows on the tab bar', () => {
    render(
      <SidebarProvider>
        <MemoryRouter>
          <WorkspaceTabBar />
        </MemoryRouter>
      </SidebarProvider>
    )

    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Forward' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Go back' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Go forward' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Toggle sidebar' })).toBeInTheDocument()
  })
})
