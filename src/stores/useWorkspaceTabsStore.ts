import { create } from 'zustand'

export interface WorkspaceTab {
  id: string
  history: string[]
  historyIndex: number
}

export interface WorkspacePane {
  id: string
  tabId: string
}

interface WorkspaceTabsState {
  tabs: WorkspaceTab[]
  panes: WorkspacePane[]
  activeTabId: string
  activePaneId: string
  tabTitles: Record<string, string>
  /** Compatibility fields while callers transition to pane IDs. */
  splitTabId: string | null
  activePane: 'primary' | 'split'
  primaryPath: string
  splitPath: string | null
  globalSearchMode: 'navigate' | 'new-tab'
  isGlobalSearchOpen: boolean
  expectedRoute: string | null
  setTabTitle: (tabId: string, title: string) => void
  ensurePath: (path: string, pane?: 'primary' | 'split' | string) => void
  navigate: (path: string, options?: { newTab?: boolean; pane?: 'primary' | 'split' | string }) => string
  selectTab: (id: string, pane?: 'primary' | 'split' | string) => void
  closeTab: (id: string) => void
  go: (direction: -1 | 1, pane?: 'primary' | 'split' | string) => void
  splitWith: (path: string) => void
  closeSplit: (paneId?: string) => void
  setActivePane: (pane: 'primary' | 'split' | string) => void
  openGlobalSearch: (mode?: 'navigate' | 'new-tab') => void
  closeGlobalSearch: () => void
  consumeExpectedRoute: (path: string) => boolean
}

const homeTab: WorkspaceTab = { id: 'home-tab', history: ['/home'], historyIndex: 0 }
const primaryPane: WorkspacePane = { id: 'primary', tabId: homeTab.id }
const MAX_PANES = 4

function getPane(state: WorkspaceTabsState, pane?: string) {
  if (pane === 'primary') return state.panes[0]
  if (pane === 'split') return state.panes[1] ?? state.panes[0]
  if (pane) return state.panes.find((item) => item.id === pane) ?? state.panes[0]
  return state.panes.find((item) => item.id === state.activePaneId) ?? state.panes[0]
}

function currentPath(tab?: WorkspaceTab) {
  return tab?.history[tab.historyIndex] ?? '/home'
}

function compatibility(panes: WorkspacePane[], activePaneId: string, tabs: WorkspaceTab[]) {
  const primary = panes[0]
  const split = panes[1]
  const primaryTab = tabs.find((tab) => tab.id === primary?.tabId)
  const splitTab = tabs.find((tab) => tab.id === split?.tabId)
  return {
    splitTabId: split?.tabId ?? null,
    activePane: activePaneId === primary?.id ? ('primary' as const) : ('split' as const),
    primaryPath: currentPath(primaryTab),
    splitPath: split ? currentPath(splitTab) : null,
  }
}

export const useWorkspaceTabsStore = create<WorkspaceTabsState>((set, get) => ({
  tabs: [homeTab],
  panes: [primaryPane],
  activeTabId: homeTab.id,
  activePaneId: primaryPane.id,
  tabTitles: {},
  splitTabId: null,
  activePane: 'primary',
  primaryPath: '/home',
  splitPath: null,
  globalSearchMode: 'navigate',
  isGlobalSearchOpen: false,
  expectedRoute: null,
  setTabTitle: (tabId, title) =>
    set((state) => {
      if (state.tabTitles[tabId] === title) return state
      return { tabTitles: { ...state.tabTitles, [tabId]: title } }
    }),
  ensurePath: (path, pane) => {
    const state = get()
    const targetPane = getPane(state, pane)
    const targetId = targetPane?.tabId ?? state.activeTabId
    const current = state.tabs.find((tab) => tab.id === targetId)
    if (!current || currentPath(current) === path) return
    const history = current.history.slice(0, current.historyIndex + 1)
    history.push(path)
    const tabs = state.tabs.map((tab) =>
      tab.id === targetId ? { ...tab, history, historyIndex: history.length - 1 } : tab
    )
    const nextTabTitles = { ...state.tabTitles }
    delete nextTabTitles[targetId]
    set({ tabs, tabTitles: nextTabTitles, ...compatibility(state.panes, state.activePaneId, tabs) })
  },
  navigate: (path, options) => {
    const state = get()
    const targetPane = getPane(state, options?.pane)
    const targetPaneId = targetPane?.id ?? state.activePaneId ?? state.panes[0]?.id ?? 'primary'

    if (options?.newTab) {
      const tab: WorkspaceTab = { id: crypto.randomUUID(), history: [path], historyIndex: 0 }
      const panes = state.panes.map((p) => (p.id === targetPaneId ? { ...p, tabId: tab.id } : p))
      const tabs = [...state.tabs, tab]
      set({
        tabs,
        panes,
        activeTabId: tab.id,
        activePaneId: targetPaneId,
        expectedRoute: path,
        ...compatibility(panes, targetPaneId, tabs),
      })
      return tab.id
    }

    const targetId = targetPane?.tabId ?? state.activeTabId
    const current = state.tabs.find((tab) => tab.id === targetId)
    if (!current) return targetId
    const history = current.history.slice(0, current.historyIndex + 1)
    if (history.at(-1) !== path) history.push(path)
    const tabs = state.tabs.map((tab) =>
      tab.id === targetId ? { ...tab, history, historyIndex: history.length - 1 } : tab
    )
    const nextTabTitles = { ...state.tabTitles }
    delete nextTabTitles[targetId]
    set({
      tabs,
      tabTitles: nextTabTitles,
      activeTabId: targetId,
      activePaneId: targetPaneId,
      expectedRoute: path,
      ...compatibility(state.panes, targetPaneId, tabs),
    })
    return targetId
  },
  selectTab: (id, pane) =>
    set((state) => {
      const tab = state.tabs.find((item) => item.id === id)
      if (!tab) return state
      const targetPane = getPane(state, pane)
      if (!targetPane) return state
      const panes = state.panes.map((item) => (item.id === targetPane.id ? { ...item, tabId: id } : item))
      const path = currentPath(tab)
      return {
        panes,
        activeTabId: id,
        activePaneId: targetPane.id,
        expectedRoute: path,
        ...compatibility(panes, targetPane.id, state.tabs),
      }
    }),
  closeTab: (id) =>
    set((state) => {
      if (state.tabs.length === 1) return state
      const tabs = state.tabs.filter((tab) => tab.id !== id)
      const panes = state.panes.map((pane) => {
        if (pane.tabId !== id) return pane
        const replacement = tabs[Math.max(0, state.tabs.findIndex((tab) => tab.id === id) - 1)] ?? tabs[0]!
        return { ...pane, tabId: replacement.id }
      })
      const activePaneId = state.activePaneId
      const activeTabId = panes.find((pane) => pane.id === activePaneId)?.tabId ?? panes[0]!.tabId
      const nextTabTitles = { ...state.tabTitles }
      delete nextTabTitles[id]
      return {
        tabs,
        panes,
        tabTitles: nextTabTitles,
        activeTabId,
        expectedRoute: currentPath(tabs.find((tab) => tab.id === activeTabId)),
        ...compatibility(panes, activePaneId, tabs),
      }
    }),
  go: (direction, pane) =>
    set((state) => {
      const targetPane = getPane(state, pane)
      const tab = state.tabs.find((item) => item.id === targetPane?.tabId)
      if (!tab) return state
      const historyIndex = Math.max(0, Math.min(tab.history.length - 1, tab.historyIndex + direction))
      const tabs = state.tabs.map((item) => (item.id === tab.id ? { ...item, historyIndex } : item))
      const nextTabTitles = { ...state.tabTitles }
      delete nextTabTitles[tab.id]
      return {
        tabs,
        tabTitles: nextTabTitles,
        expectedRoute: currentPath(tabs.find((item) => item.id === tab.id)),
        ...compatibility(state.panes, state.activePaneId, tabs),
      }
    }),
  splitWith: (path) =>
    set((state) => {
      if (state.panes.length >= MAX_PANES) return state
      const tab: WorkspaceTab = { id: crypto.randomUUID(), history: [path], historyIndex: 0 }
      const pane: WorkspacePane = { id: crypto.randomUUID(), tabId: tab.id }
      const activeIndex = Math.max(0, state.panes.findIndex((item) => item.id === state.activePaneId))
      const panes = [...state.panes.slice(0, activeIndex + 1), pane, ...state.panes.slice(activeIndex + 1)]
      const tabs = [...state.tabs, tab]
      return {
        tabs,
        panes,
        activeTabId: tab.id,
        activePaneId: pane.id,
        expectedRoute: path,
        ...compatibility(panes, pane.id, tabs),
      }
    }),
  closeSplit: (paneId) =>
    set((state) => {
      if (state.panes.length <= 1) return state
      const targetId = paneId ?? state.panes.at(-1)?.id
      const targetPane = state.panes.find((p) => p.id === targetId)
      const panes = state.panes.filter((pane) => pane.id !== targetId)
      // Discard the closed pane's tab so it is not dumped back into pane 0
      const tabs = targetPane
        ? state.tabs.filter((t) => t.id !== targetPane.tabId || panes.some((p) => p.tabId === t.id))
        : state.tabs
      const activePaneId = state.activePaneId === targetId ? panes[0]!.id : state.activePaneId
      const activeTabId = panes.find((pane) => pane.id === activePaneId)?.tabId ?? panes[0]!.tabId
      const path = currentPath(tabs.find((tab) => tab.id === activeTabId))
      const nextTabTitles = { ...state.tabTitles }
      if (targetPane && !panes.some((p) => p.tabId === targetPane.tabId)) {
        delete nextTabTitles[targetPane.tabId]
      }
      return {
        tabs,
        panes,
        tabTitles: nextTabTitles,
        activePaneId,
        activeTabId,
        expectedRoute: path,
        ...compatibility(panes, activePaneId, tabs),
      }
    }),
  setActivePane: (pane) =>
    set((state) => {
      const targetPane = getPane(state, pane)
      if (!targetPane) return state
      const tab = state.tabs.find((t) => t.id === targetPane.tabId)
      const path = currentPath(tab)
      return {
        activePaneId: targetPane.id,
        activeTabId: targetPane.tabId,
        expectedRoute: path,
        ...compatibility(state.panes, targetPane.id, state.tabs),
      }
    }),
  openGlobalSearch: (globalSearchMode = 'navigate') => set({ globalSearchMode, isGlobalSearchOpen: true }),
  closeGlobalSearch: () => set({ isGlobalSearchOpen: false }),
  consumeExpectedRoute: (path) => {
    if (get().expectedRoute !== path) return false
    set({ expectedRoute: null })
    return true
  },
}))
