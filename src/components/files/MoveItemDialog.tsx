import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { ChevronDownIcon, DocumentTextIcon, ChevronRightIcon, MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/outline'

import type { RepositoryResult } from '../../database/repositories'
import type { MyBookFolder } from '../../types/files'
import { useIsMobile } from '../../hooks/use-mobile'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import { FieldError } from '../ui/field'
import { Input } from '../ui/input'
import { Sheet, SheetContent } from '../ui/sheet'
import { Tree, TreeItem } from '../ui/tree'

interface MoveItemDialogProps {
  isOpen: boolean
  itemKind: 'file' | 'folder'
  itemName?: string
  folders: MyBookFolder[]
  disabledFolderIds?: string[]
  onClose: () => void
  onMove: (folderId: string | null) => Promise<RepositoryResult> | RepositoryResult
  onCreateFolder: (name: string, parentId: string | null) => Promise<RepositoryResult<MyBookFolder>>
}

export function MoveItemDialog({
  isOpen,
  itemKind,
  itemName,
  folders,
  disabledFolderIds = [],
  onClose,
  onMove,
  onCreateFolder,
}: MoveItemDialogProps) {
  const isMobile = useIsMobile()
  const treeRef = useRef<HTMLDivElement>(null)
  const createInputRef = useRef<HTMLInputElement>(null)
  const selectedFolderIdRef = useRef<string | null | undefined>(undefined)
  const createRequestRef = useRef(false)
  const cancelledCreateRef = useRef(false)
  const [selectedFolderId, setSelectedFolderIdState] = useState<string | null | undefined>(undefined)
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set())
  const [isRootExpanded, setIsRootExpanded] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [createParentId, setCreateParentId] = useState<string | null | undefined>(undefined)
  const [newFolderName, setNewFolderName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createdFolders, setCreatedFolders] = useState<MyBookFolder[]>([])

  const setSelectedFolderId = (folderId: string | null | undefined) => {
    selectedFolderIdRef.current = folderId
    setSelectedFolderIdState(folderId)
  }

  const folderList = useMemo(() => {
    const folderIds = new Set(folders.map((folder) => folder.id))
    return [...folders, ...createdFolders.filter((folder) => !folderIds.has(folder.id))]
  }, [createdFolders, folders])
  const foldersByParent = useMemo(() => {
    const children = new Map<string | null, MyBookFolder[]>()
    for (const folder of folderList) {
      const siblings = children.get(folder.parentId) ?? []
      siblings.push(folder)
      children.set(folder.parentId, siblings)
    }
    for (const siblings of children.values()) {
      siblings.sort((left, right) => left.name.localeCompare(right.name))
    }
    return children
  }, [folderList])
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase()
  const matchingFolderIds = useMemo(() => {
    if (!normalizedQuery) return null
    const matchingIds = new Set<string>()
    const byId = new Map(folderList.map((folder) => [folder.id, folder]))
    for (const folder of folderList) {
      if (!folder.name.toLocaleLowerCase().includes(normalizedQuery)) continue
      let current: MyBookFolder | undefined = folder
      while (current && !matchingIds.has(current.id)) {
        matchingIds.add(current.id)
        current = current.parentId ? byId.get(current.parentId) : undefined
      }
    }
    return matchingIds
  }, [folderList, normalizedQuery])

  useEffect(() => {
    if (!isOpen) return
    setSelectedFolderId(undefined)
    setExpandedFolderIds(new Set())
    setIsRootExpanded(true)
    setSearchQuery('')
    setCreateParentId(undefined)
    setNewFolderName('')
    setError(null)
    setIsSubmitting(false)
    setCreatedFolders([])
    createRequestRef.current = false
  }, [isOpen])

  useEffect(() => {
    if (createParentId !== undefined) createInputRef.current?.focus()
  }, [createParentId])

  const visibleFolders = (parentId: string | null) =>
    (foldersByParent.get(parentId) ?? []).filter((folder) =>
      !matchingFolderIds || matchingFolderIds.has(folder.id)
    )

  const isInvalidMoveTarget = (folderId: string | null) =>
    disabledFolderIds.includes(folderId ?? 'root')

  const selectFolder = (folderId: string | null) => {
    if (folderId !== null && isInvalidMoveTarget(folderId)) return
    setSelectedFolderId(folderId)
    setError(null)
  }

  const toggleFolder = (folderId: string) => {
    setExpandedFolderIds((current) => {
      const next = new Set(current)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }

  const focusTreeItem = (item: HTMLElement | undefined) => {
    item?.focus()
  }

  const handleTreeKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target
    if (!(target instanceof HTMLElement) || target.getAttribute('role') !== 'treeitem') return
    const items = Array.from(
      treeRef.current?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? [],
    )
    const index = items.indexOf(target)
    if (index < 0) return
    const folderId = target.dataset.folderId
    const isRootItem = folderId === 'root'
    const hasChildren = target.dataset.hasChildren === 'true'
    const isExpanded = target.getAttribute('aria-expanded') === 'true'

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusTreeItem(items[index + 1])
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      focusTreeItem(items[index - 1])
    } else if (event.key === 'Home') {
      event.preventDefault()
      focusTreeItem(items[0])
    } else if (event.key === 'End') {
      event.preventDefault()
      focusTreeItem(items.at(-1))
    } else if (event.key === 'ArrowRight' && isRootItem && !isRootExpanded) {
      event.preventDefault()
      setIsRootExpanded(true)
    } else if (event.key === 'ArrowRight' && isRootItem) {
      event.preventDefault()
      focusTreeItem(items[index + 1])
    } else if (event.key === 'ArrowRight' && folderId) {
      event.preventDefault()
      if (hasChildren && !isExpanded) toggleFolder(folderId)
      else if (hasChildren) focusTreeItem(items[index + 1])
    } else if (event.key === 'ArrowLeft' && isRootItem && isRootExpanded) {
      event.preventDefault()
      setIsRootExpanded(false)
    } else if (event.key === 'ArrowLeft' && folderId && hasChildren && isExpanded) {
      event.preventDefault()
      toggleFolder(folderId)
    } else if (event.key === 'ArrowLeft' && folderId) {
      event.preventDefault()
      const parentId = folderList.find((folder) => folder.id === folderId)?.parentId
      focusTreeItem(parentId ? items.find((item) => item.dataset.folderId === parentId) : items[0])
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const destinationId = isRootItem ? null : folderId ?? null
      if (event.key === 'Enter' && selectedFolderIdRef.current === destinationId) {
        void moveItem()
      } else {
        selectFolder(destinationId)
      }
    }
  }

  const createFolderAt = async (parentId: string | null, name: string) => {
    const normalizedName = name.trim().replace(/\s+/g, ' ')
    if (!normalizedName || createRequestRef.current) return
    createRequestRef.current = true
    setError(null)
    const result = await onCreateFolder(normalizedName, parentId)
    createRequestRef.current = false
    if (!result?.success || !result?.data) {
      setError(result?.error ?? 'Unable to create this folder.')
      return
    }
    const createdFolder = result.data
    setCreatedFolders((current) => [...current, createdFolder])
    if (parentId) {
      setExpandedFolderIds((current) => new Set(current).add(parentId))
    } else {
      setIsRootExpanded(true)
    }
    if (selectedFolderIdRef.current === parentId) setSelectedFolderId(createdFolder.id)
    setCreateParentId(undefined)
    setNewFolderName('')
  }

  const handleCreateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (createParentId === undefined) return
    void createFolderAt(createParentId, newFolderName)
  }

  const moveItem = async () => {
    if (selectedFolderId === undefined || isInvalidMoveTarget(selectedFolderId) || isSubmitting) return
    setIsSubmitting(true)
    setError(null)
    const result = await onMove(selectedFolderId)
    if (!result.success) {
      setError(result.error ?? 'Unable to move this item.')
      setIsSubmitting(false)
      return
    }
    setIsSubmitting(false)
    onClose()
  }

  const selectedFolderName = selectedFolderId === undefined
    ? null
    : selectedFolderId === null
      ? 'Writin root'
      : folderList.find((folder) => folder.id === selectedFolderId)?.name ?? null

  const renderCreateInput = (parentId: string | null) => {
    if (createParentId !== parentId) return null
    return (
      <form
        className="my-1 ml-5 mr-1 sm:ml-8"
        onSubmit={handleCreateSubmit}
        onBlur={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
          if (cancelledCreateRef.current) {
            cancelledCreateRef.current = false
            return
          }
          if (newFolderName.trim()) void createFolderAt(parentId, newFolderName)
          else {
            setCreateParentId(undefined)
            setNewFolderName('')
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            cancelledCreateRef.current = true
            setCreateParentId(undefined)
            setNewFolderName('')
            setError(null)
            const parentItem = Array.from(
              treeRef.current?.querySelectorAll<HTMLElement>('[data-folder-id]') ?? [],
            ).find((item) => item.dataset.folderId === (parentId ?? 'root'))
            parentItem?.focus()
          }
        }}
      >
        <label htmlFor="move-new-folder-name" className="sr-only">New folder name</label>
        <Input
          ref={createInputRef}
          id="move-new-folder-name"
          value={newFolderName}
          onChange={(event) => setNewFolderName(event.target.value)}
          placeholder="New folder name"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'move-folder-error' : undefined}
          className="h-9"
        />
      </form>
    )
  }

  const renderFolder = (folder: MyBookFolder) => {
    const children = visibleFolders(folder.id)
    const hasChildren = children.length > 0
    const isExpanded = normalizedQuery.length > 0 || expandedFolderIds.has(folder.id)
    const isSelected = selectedFolderId === folder.id

    return (
      <TreeItem
        key={folder.id}
        aria-label={folder.name}
        selected={isSelected}
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-level={getFolderDepth(folder, folderList) + 2}
        tabIndex={selectedFolderId === folder.id ? 0 : -1}
        data-folder-id={folder.id}
        data-has-children={hasChildren}
        onClick={(event) => {
          event.stopPropagation()
          selectFolder(folder.id)
        }}
        className="group/tree-item"
      >
        <div
          data-tree-row
          className={`flex min-h-10 cursor-pointer items-center gap-1 rounded-lg px-1 ${
            isSelected
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted/70'
          }`}
        >
          <button
            type="button"
            tabIndex={-1}
            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${folder.name}`}
            aria-expanded={hasChildren ? isExpanded : undefined}
            disabled={!hasChildren}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-0 sm:size-7"
            onClick={(event) => {
              event.stopPropagation()
              toggleFolder(folder.id)
            }}
          >
            {hasChildren && isExpanded
              ? <ChevronDownIcon aria-hidden="true" className="size-4" />
              : <ChevronRightIcon aria-hidden="true" className="size-4" />}
          </button>
          <span className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-2 text-sm">
            <img src="/icons/folder.svg" alt="" aria-hidden="true" className="size-5 shrink-0" />
            <span className="truncate" title={folder.name}>{folder.name}</span>
          </span>
        </div>
        {renderCreateInput(folder.id)}
        {!hasChildren && !normalizedQuery && isSelected ? (
          <p className="py-1 pl-8 text-xs text-muted-foreground sm:pl-12">No Sub Folders</p>
        ) : null}
        {hasChildren && isExpanded ? (
          <div role="group" className="ml-2.5 border-l border-border pl-1.5 sm:ml-5 sm:pl-2">
            {children.map(renderFolder)}
          </div>
        ) : null}
      </TreeItem>
    )
  }

  const folderTitle = itemKind === 'file' ? 'Move file' : 'Move folder'
  const searchLabel = itemKind === 'file' ? 'Search files' : 'Search folders'
  const createButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label="Create new folder"
      disabled={selectedFolderId === undefined || isSubmitting || createParentId !== undefined}
      onClick={() => {
        if (selectedFolderId === undefined) return
        setError(null)
        setNewFolderName('')
        cancelledCreateRef.current = false
        setCreateParentId(selectedFolderId)
        if (selectedFolderId === null) setIsRootExpanded(true)
      }}
    >
      <PlusIcon aria-hidden="true" />
      New folder
    </Button>
  )

  const content = (
    <>
      <DialogHeader className="flex-row items-center justify-between border-b border-border px-5 py-4 pr-14">
        <div className="min-w-0">
          <DialogTitle className="text-base font-semibold">{folderTitle}</DialogTitle>
          {itemName ? (
            <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              {itemKind === 'folder'
                ? <img src="/icons/folder.svg" alt="" aria-hidden="true" className="size-4 shrink-0" />
                : <DocumentTextIcon aria-hidden="true" className="size-4 shrink-0" />}
              <span className="truncate">{itemName}</span>
            </p>
          ) : null}
        </div>
        {createButton}
      </DialogHeader>
      <div className="border-b border-border px-4 py-3">
        <label htmlFor="move-folder-search" className="sr-only">{searchLabel}</label>
        <div className="relative">
          <MagnifyingGlassIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="move-folder-search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={searchLabel}
            className="h-10 pl-9"
          />
        </div>
      </div>
      <div className="min-h-0 overflow-y-auto px-3 py-3">
        <Tree
          ref={treeRef}
          aria-label="Choose a destination folder"
          onKeyDown={handleTreeKeyDown}
          className="gap-0.5"
        >
          <TreeItem
            aria-label="Writin root"
            selected={selectedFolderId === null}
            aria-expanded={isRootExpanded}
            aria-level={1}
            tabIndex={selectedFolderId === null || selectedFolderId === undefined ? 0 : -1}
            data-folder-id="root"
            data-has-children={visibleFolders(null).length > 0}
            onClick={(event) => {
              event.stopPropagation()
              selectFolder(null)
            }}
            className="rounded-lg"
          >
            <div
              data-tree-row
              className={`flex min-h-10 cursor-pointer items-center gap-1 rounded-lg px-1 ${
                selectedFolderId === null
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted/70'
              }`}
            >
              <button
                type="button"
                tabIndex={-1}
                aria-label={`${isRootExpanded ? 'Collapse' : 'Expand'} Writin root`}
                aria-expanded={isRootExpanded}
                className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring sm:size-7"
                onClick={(event) => {
                  event.stopPropagation()
                  setIsRootExpanded((expanded) => !expanded)
                }}
              >
                {isRootExpanded
                  ? <ChevronDownIcon aria-hidden="true" className="size-4" />
                  : <ChevronRightIcon aria-hidden="true" className="size-4" />}
              </button>
              <span className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-2 text-sm">
                <img src="/icons/folder.svg" alt="" aria-hidden="true" className="size-5 shrink-0" />
                <span>Writin root</span>
              </span>
            </div>
            {isRootExpanded ? (
              <div role="group" className="ml-2.5 border-l border-border pl-1.5 sm:ml-5 sm:pl-2">
                {renderCreateInput(null)}
                {visibleFolders(null).map(renderFolder)}
                {visibleFolders(null).length === 0 && createParentId !== null ? (
                  <p className="py-2 pl-6 text-sm text-muted-foreground sm:pl-9">
                    {normalizedQuery ? 'No folders found.' : 'No Sub Folders'}
                  </p>
                ) : null}
              </div>
            ) : null}
          </TreeItem>
        </Tree>
      </div>
      <div className="border-t border-border px-4 py-3">
        {error ? <FieldError id="move-folder-error" className="mb-3">{error}</FieldError> : null}
        <DialogFooter className="flex-row justify-end pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-0">
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={onClose}>Cancel</Button>
          <Button
            type="button"
            disabled={selectedFolderId === undefined || isInvalidMoveTarget(selectedFolderId) || isSubmitting}
            onClick={() => void moveItem()}
          >
            {isSubmitting ? 'Moving…' : `Move to ${selectedFolderName ?? 'folder'}`}
          </Button>
        </DialogFooter>
      </div>
    </>
  )

  return isMobile ? (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent
        side="bottom"
        className="grid data-[side=bottom]:h-[95dvh] data-[side=bottom]:max-h-[95dvh] w-full grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-0 rounded-t-2xl p-0"
      >
        {content}
      </SheetContent>
    </Sheet>
  ) : (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent
        showCloseButton
        className="grid h-[min(82dvh,48rem)] max-h-[min(85dvh,48rem)] max-w-[calc(100%-2rem)] grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-xl"
      >
        {content}
      </DialogContent>
    </Dialog>
  )
}

function getFolderDepth(folder: MyBookFolder, folders: MyBookFolder[]) {
  const byId = new Map(folders.map((candidate) => [candidate.id, candidate]))
  const visited = new Set<string>()
  let depth = 0
  let parentId = folder.parentId
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId)
    depth += 1
    parentId = byId.get(parentId)?.parentId ?? null
  }
  return depth
}
