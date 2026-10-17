import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  PlusSignIcon,
  Cancel01Icon,
  SidebarLeft01Icon,
  SidebarRight01Icon,
  ChevronDownIcon,
  ListViewIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useNavigate } from 'react-router-dom'
import { db } from '../../database/db'
import type { MyBookFile } from '../../types/files'
import { useWorkspaceTabsStore, type WorkspaceTab } from '../../stores/useWorkspaceTabsStore'
import { useSidebar } from '../ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'

const MIN_TAB_WIDTH = 96
const EMPTY_FILES: MyBookFile[] = []

function tabLabel(path: string, files: MyBookFile[], tabTitles: Record<string, string>, tabId: string) {
  if (path === '/home') return 'Home'
  if (path === '/favorites') return 'Favorites'
  if (path === '/folders') return 'Library'
  if (path.startsWith('/folders/')) return 'Folder'
  if (path.startsWith('/search')) return 'Search'
  if (path === '/trash') return 'Trash'
  if (path === '/settings') return 'Preferences'

  if (path.startsWith('/document/') || path.startsWith('/spreadsheet/')) {
    const id = path.split('/')[2]
    return (id ? tabTitles[id] : undefined) ?? tabTitles[tabId] ?? files.find((file) => file.id === id)?.name ?? 'Untitled'
  }

  return tabTitles[tabId] ?? (path.slice(1) || 'Home')
}

function currentPath(tab?: WorkspaceTab) {
  return tab?.history[tab.historyIndex] ?? '/home'
}

export function WorkspaceTabBar({ pane = 'primary' }: { pane?: 'primary' | 'split' | string }) {
  const queriedFiles = useLiveQuery(() => db.files.toArray(), [])
  const files = queriedFiles ?? EMPTY_FILES
  const navigate = useNavigate()
  const sidebar = useSidebar()
  const tabs = useWorkspaceTabsStore((state) => state.tabs)
  const activeTabId = useWorkspaceTabsStore((state) => state.activeTabId)
  const activePaneId = useWorkspaceTabsStore((state) => state.activePaneId)
  const panes = useWorkspaceTabsStore((state) => state.panes)
  const tabTitles = useWorkspaceTabsStore((state) => state.tabTitles)
  const selectTab = useWorkspaceTabsStore((state) => state.selectTab)
  const closeTab = useWorkspaceTabsStore((state) => state.closeTab)
  const closeSplit = useWorkspaceTabsStore((state) => state.closeSplit)
  const openGlobalSearch = useWorkspaceTabsStore((state) => state.openGlobalSearch)

  const isPrimary = pane === 'primary' || pane === panes[0]?.id
  const targetPaneId = isPrimary ? panes[0]?.id ?? 'primary' : pane === 'split' ? panes[1]?.id ?? pane : pane
  const paneTabId = panes.find((item) => item.id === targetPaneId)?.tabId ?? (isPrimary ? panes[0]?.tabId : undefined)
  const isFocusedPane = targetPaneId === activePaneId

  const paneTabs = isPrimary
    ? tabs.filter((tab) => !panes.some((item, index) => index > 0 && item.tabId === tab.id))
    : tabs.filter((tab) => tab.id === paneTabId)

  const activeId = paneTabId ?? activeTabId

  const rowRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState<number>(0)
  const [windowOffset, setWindowOffset] = useState<number>(0)

  useEffect(() => {
    const element = rowRef.current
    if (!element) return

    setContainerWidth(element.getBoundingClientRect().width)

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContainerWidth(entry.contentRect.width)
        }
      })
      observer.observe(element)
      return () => observer.disconnect()
    }
  }, [])

  const maxVisibleCount = containerWidth > 0
    ? Math.max(1, Math.floor(containerWidth / MIN_TAB_WIDTH))
    : paneTabs.length

  const activeIndex = Math.max(0, paneTabs.findIndex((tab) => tab.id === activeId))

  // Adjust window offset smoothly so active tab is always in view
  let currentOffset = windowOffset
  if (activeIndex < currentOffset) {
    currentOffset = activeIndex
  } else if (activeIndex >= currentOffset + maxVisibleCount) {
    currentOffset = activeIndex - maxVisibleCount + 1
  }
  const maxOffset = Math.max(0, paneTabs.length - maxVisibleCount)
  currentOffset = Math.max(0, Math.min(maxOffset, currentOffset))

  const visibleTabs = paneTabs.slice(currentOffset, currentOffset + maxVisibleCount)
  const hiddenTabs = paneTabs.filter((tab) => !visibleTabs.some((vt) => vt.id === tab.id))

  const handleSelectTab = (tab: WorkspaceTab) => {
    const nextIndex = paneTabs.findIndex((t) => t.id === tab.id)
    if (nextIndex !== -1) {
      if (nextIndex < currentOffset) {
        setWindowOffset(nextIndex)
      } else if (nextIndex >= currentOffset + maxVisibleCount) {
        setWindowOffset(Math.max(0, nextIndex - maxVisibleCount + 1))
      }
    }
    selectTab(tab.id, targetPaneId)
    navigate(currentPath(tab))
  }

  const handleClose = (tab: WorkspaceTab) => {
    if (!isPrimary) {
      closeSplit(targetPaneId)
      navigate(useWorkspaceTabsStore.getState().primaryPath, { replace: true })
      return
    }
    const wasActive = tab.id === activeId
    closeTab(tab.id)
    if (wasActive) {
      const remaining = useWorkspaceTabsStore.getState().tabs.filter((item) => item.id !== tab.id)
      const next = remaining[0]
      if (next) navigate(currentPath(next), { replace: true })
    }
  }

  return (
    <div
      className="hidden min-h-0 shrink-0 items-center border-b border-sidebar-border bg-sidebar text-sidebar-foreground md:flex"
      role="tablist"
      aria-label="Open tabs"
    >
      {isPrimary ? (
        <button
          type="button"
          aria-label="Toggle sidebar"
          title="Toggle sidebar"
          onClick={sidebar.toggleSidebar}
          className="flex size-10 shrink-0 items-center justify-center text-sidebar-foreground/75 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <HugeiconsIcon
            icon={sidebar.state === 'collapsed' ? SidebarRight01Icon : SidebarLeft01Icon}
            strokeWidth={2}
            className="size-4"
          />
        </button>
      ) : null}

      {hiddenTabs.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Hidden tabs (${hiddenTabs.length})`}
            title={`Hidden tabs (${hiddenTabs.length})`}
            className="flex size-10 shrink-0 items-center justify-center text-sidebar-foreground/75 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <div className="relative flex items-center justify-center">
              <HugeiconsIcon icon={ChevronDownIcon} strokeWidth={2} className="size-4" />
              <span className="sr-only">Hidden tabs ({hiddenTabs.length})</span>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 max-h-72 overflow-y-auto">
            <DropdownMenuLabel>Hidden tabs ({hiddenTabs.length})</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {hiddenTabs.map((tab) => {
              const path = currentPath(tab)
              const label = tabLabel(path, files, tabTitles, tab.id)
              return (
                <DropdownMenuItem
                  key={tab.id}
                  onClick={() => handleSelectTab(tab)}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="truncate flex-1 text-sm">{label}</span>
                  {paneTabs.length > 1 ? (
                    <button
                      type="button"
                      aria-label={`Close ${label}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        handleClose(tab)
                      }}
                      className="size-5 rounded hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center"
                    >
                      <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-3" />
                    </button>
                  ) : null}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      <div ref={rowRef} className="flex min-w-0 flex-1 items-center overflow-hidden">
        {visibleTabs.map((tab, index) => {
          const path = currentPath(tab)
          const active = tab.id === activeId
          const label = tabLabel(path, files, tabTitles, tab.id)

          const activeClasses = active
            ? isFocusedPane
              ? 'bg-background text-foreground shadow-xs font-medium'
              : 'bg-sidebar-accent/60 text-sidebar-foreground font-medium'
            : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/70'

          return (
            <div
              key={tab.id}
              role="presentation"
              className={`group flex min-w-0 min-w-[5rem] max-w-52 shrink-0 items-center border-r border-sidebar-border transition-colors ${
                index === 0 && hiddenTabs.length === 0 ? 'border-l' : ''
              } ${activeClasses}`}
            >
              <button
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => handleSelectTab(tab)}
                className="flex min-h-10 min-w-0 flex-1 items-center px-3 text-left text-sm"
              >
                <span className="truncate">{label}</span>
              </button>
              {!isPrimary || paneTabs.length > 1 ? (
                <button
                  type="button"
                  aria-label={`Close ${label} ${isPrimary ? 'tab' : 'pane'}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    handleClose(tab)
                  }}
                  className="mr-1 flex size-6 shrink-0 items-center justify-center text-sidebar-foreground/50 opacity-0 hover:bg-sidebar-accent hover:text-sidebar-foreground group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-3.5" />
                </button>
              ) : null}
            </div>
          )
        })}
      </div>

      <div className="flex shrink-0 items-center">
        {isPrimary ? (
          <button
            type="button"
            aria-label="Open a file in a new tab"
            title="Open a file in a new tab"
            onClick={() => openGlobalSearch('new-tab')}
            className="flex size-10 shrink-0 items-center justify-center text-sidebar-foreground/75 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} className="size-5" />
          </button>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="All open tabs"
            title="All open tabs"
            className="flex size-10 shrink-0 items-center justify-center text-sidebar-foreground/75 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <HugeiconsIcon icon={ListViewIcon} strokeWidth={2} className="size-4.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 max-h-80 overflow-y-auto">
            <DropdownMenuLabel>All open tabs ({tabs.length})</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {tabs.map((tab) => {
              const path = currentPath(tab)
              const label = tabLabel(path, files, tabTitles, tab.id)
              const isActive = tab.id === activeId

              return (
                <DropdownMenuItem
                  key={tab.id}
                  onClick={() => handleSelectTab(tab)}
                  className={`flex items-center justify-between gap-2 ${
                    isActive ? 'font-semibold text-primary' : ''
                  }`}
                >
                  <span className="truncate flex-1 text-sm">{label}</span>
                  {isActive ? (
                    <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      Active
                    </span>
                  ) : null}
                  {tabs.length > 1 ? (
                    <button
                      type="button"
                      aria-label={`Close ${label}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        handleClose(tab)
                      }}
                      className="size-5 rounded hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center"
                    >
                      <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-3" />
                    </button>
                  ) : null}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
