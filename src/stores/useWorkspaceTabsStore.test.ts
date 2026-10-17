import { beforeEach, describe, expect, it } from 'vitest'
import { useWorkspaceTabsStore } from './useWorkspaceTabsStore'

describe('workspace tabs', () => {
  beforeEach(() => {
    useWorkspaceTabsStore.setState({
      tabs: [{ id: 'home-tab', history: ['/home'], historyIndex: 0 }],
      panes: [{ id: 'primary', tabId: 'home-tab' }],
      activeTabId: 'home-tab',
      activePaneId: 'primary',
      splitTabId: null,
      activePane: 'primary',
      primaryPath: '/home',
      splitPath: null,
      expectedRoute: null,
    })
  })

  it('tracks back and forward history separately per tab', () => {
    const store = useWorkspaceTabsStore.getState()
    store.navigate('/folders')
    store.navigate('/folders/folder-1')
    store.go(-1)
    expect(useWorkspaceTabsStore.getState().primaryPath).toBe('/folders')
    store.go(1)
    expect(useWorkspaceTabsStore.getState().primaryPath).toBe('/folders/folder-1')
  })

  it('opens a new tab without changing the previous tab history', () => {
    const store = useWorkspaceTabsStore.getState()
    store.navigate('/folders')
    store.navigate('/document/doc-1', { newTab: true })
    const state = useWorkspaceTabsStore.getState()
    expect(state.tabs).toHaveLength(2)
    expect(state.tabs[0]?.history).toEqual(['/home', '/folders'])
    expect(state.primaryPath).toBe('/document/doc-1')
  })

  it('opens and navigates an independent split pane', () => {
    const store = useWorkspaceTabsStore.getState()
    store.navigate('/folders')
    store.splitWith('/document/doc-1')
    store.navigate('/folders/folder-1', { pane: 'split' })
    const state = useWorkspaceTabsStore.getState()
    expect(state.primaryPath).toBe('/folders')
    expect(state.splitPath).toBe('/folders/folder-1')
    store.closeSplit()
    expect(useWorkspaceTabsStore.getState().splitTabId).toBeNull()
  })

  it('supports at most four independent panes and closes only the selected pane', () => {
    const store = useWorkspaceTabsStore.getState()
    store.splitWith('/document/doc-1')
    store.splitWith('/document/doc-2')
    store.splitWith('/document/doc-3')
    store.splitWith('/document/doc-4')
    expect(useWorkspaceTabsStore.getState().panes).toHaveLength(4)
    expect(useWorkspaceTabsStore.getState().tabs).toHaveLength(4)
    const paneToClose = useWorkspaceTabsStore.getState().panes[2]!
    store.closeSplit(paneToClose.id)
    const nextState = useWorkspaceTabsStore.getState()
    expect(nextState.panes).toHaveLength(3)
    expect(nextState.panes.some((pane) => pane.id === paneToClose.id)).toBe(false)
  })

  it('switches the focused pane to Home without changing other panes', () => {
    const store = useWorkspaceTabsStore.getState()
    store.splitWith('/document/doc-1')
    const splitPaneId = useWorkspaceTabsStore.getState().activePaneId
    store.selectTab('home-tab', 'primary')
    const state = useWorkspaceTabsStore.getState()
    expect(state.activePaneId).toBe('primary')
    expect(state.primaryPath).toBe('/home')
    expect(state.panes.find((pane) => pane.id === splitPaneId)?.tabId).toBe(state.splitTabId)
    expect(state.splitPath).toBe('/document/doc-1')
  })

  it('marks tab switches as expected routes so old location cannot overwrite the selected tab', () => {
    const store = useWorkspaceTabsStore.getState()
    store.navigate('/document/doc-1', { newTab: true })
    const selectedId = useWorkspaceTabsStore.getState().activeTabId
    store.selectTab('home-tab')
    expect(useWorkspaceTabsStore.getState().expectedRoute).toBe('/home')
    expect(useWorkspaceTabsStore.getState().consumeExpectedRoute('/document/doc-1')).toBe(false)
    expect(useWorkspaceTabsStore.getState().consumeExpectedRoute('/home')).toBe(true)
    expect(useWorkspaceTabsStore.getState().activeTabId).not.toBe(selectedId)
  })

  it('allows closing Home when another tab remains but protects the final tab', () => {
    const store = useWorkspaceTabsStore.getState()
    store.navigate('/document/doc-1', { newTab: true })
    store.closeTab('home-tab')
    expect(useWorkspaceTabsStore.getState().tabs.map((tab) => tab.id)).toEqual([useWorkspaceTabsStore.getState().activeTabId])
    store.closeTab(useWorkspaceTabsStore.getState().activeTabId)
    expect(useWorkspaceTabsStore.getState().tabs).toHaveLength(1)
  })

  it('removes split pane tab from tabs list when closing split so it is not added to primary', () => {
    const store = useWorkspaceTabsStore.getState()
    store.splitWith('/document/doc-split')
    const splitPane = useWorkspaceTabsStore.getState().panes[1]!
    expect(useWorkspaceTabsStore.getState().panes).toHaveLength(2)
    expect(useWorkspaceTabsStore.getState().tabs).toHaveLength(2)

    store.closeSplit(splitPane.id)
    const state = useWorkspaceTabsStore.getState()
    expect(state.panes).toHaveLength(1)
    expect(state.tabs).toHaveLength(1)
    expect(state.tabs[0]?.id).toBe('home-tab')
  })

  it('opens a new tab in the requested split pane without modifying primary pane', () => {
    const store = useWorkspaceTabsStore.getState()
    store.splitWith('/document/doc-1')
    const splitPane = useWorkspaceTabsStore.getState().panes[1]!
    store.navigate('/document/doc-2', { newTab: true, pane: splitPane.id })

    const state = useWorkspaceTabsStore.getState()
    expect(state.panes[0]?.tabId).toBe('home-tab')
    expect(state.panes[1]?.tabId).toBe(state.activeTabId)
    expect(state.primaryPath).toBe('/home')
  })

  it('updates in-memory tab title for immediate tab reflection', () => {
    const store = useWorkspaceTabsStore.getState()
    store.setTabTitle('home-tab', 'Updated Home')
    expect(useWorkspaceTabsStore.getState().tabTitles['home-tab']).toBe('Updated Home')
  })

  it('clears tabId title override when tab navigates to a new path', () => {
    const store = useWorkspaceTabsStore.getState()
    store.setTabTitle('home-tab', 'Temp Document Title')
    expect(useWorkspaceTabsStore.getState().tabTitles['home-tab']).toBe('Temp Document Title')

    store.ensurePath('/favorites')
    expect(useWorkspaceTabsStore.getState().tabTitles['home-tab']).toBeUndefined()
  })

  it('sets expectedRoute when switching active pane so stale route does not overwrite it', () => {
    const store = useWorkspaceTabsStore.getState()
    store.splitWith('/document/doc-1')
    store.setActivePane('primary')
    expect(useWorkspaceTabsStore.getState().expectedRoute).toBe('/home')
  })
})
