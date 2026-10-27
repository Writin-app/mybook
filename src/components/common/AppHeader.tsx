import {
  ArrowLeft01Icon,
  CloudCheckIcon,
  Loading03Icon,
  LockIcon,
  LockOpenIcon,
  MoreHorizontalIcon,
  PlusSignIcon,
  Share08Icon,
  SidebarLeft01Icon,
  SidebarRight01Icon,
  StarIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import { Fragment, useEffect, useRef, useState, type RefObject, type ReactNode } from 'react'

import { useIsMobile } from '../../hooks/use-mobile'
import { cn } from '../../lib/utils'
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../ui/breadcrumb'
import { Button } from '../ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { Input } from '../ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog'
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from '../ui/popover'
import { useSidebar } from '../ui/sidebar'

export interface AppHeaderBreadcrumb {
  label: string
  onPress?: () => void
}

export interface AppHeaderAction {
  id: string
  icon: IconSvgElement
  label: string
  isActive?: boolean
  isDisabled?: boolean
  onPress?: () => void
}

export interface AppHeaderProps {
  title?: string
  /** Show the desktop page title below the breadcrumbs. */
  showTitle?: boolean
  /** The editor title to track as it passes under the sticky header. */
  titleRef?: RefObject<HTMLElement | null>
  breadcrumbs?: AppHeaderBreadcrumb[]
  leadingAction?: 'sidebar' | 'back' | 'none'
  /** Hide leading controls below the mobile breakpoint. */
  hideLeadingOnMobile?: boolean
  /** Hide editor breadcrumbs below the mobile breakpoint. */
  hideBreadcrumbsOnMobile?: boolean
  onBack?: () => void
  onSidebarToggle?: () => void
  /** Show or hide the center-left actions group. Defaults to true. */
  showCenterLeftActions?: boolean
  centerLeftActions?: AppHeaderAction[]
  status?: 'saving' | 'saved' | ReactNode
  /** Show or hide the entire trailing actions group. Defaults to true. */
  showTrailingActions?: boolean
  /** Show the Add New (+) button in trailing actions. Defaults to true. */
  addNewAction?: boolean
  shareAction?: boolean
  onShare?: () => void
  favoriteAction?: boolean
  moreAction?: boolean
  isFavorite?: boolean
  onFavorite?: () => void
  lockAction?: boolean
  isLocked?: boolean
  onLockToggle?: () => void
  onMoreOpenChange?: (open: boolean) => void
  /** Dropdown menu items rendered by the More action. */
  moreContent?: ReactNode
  moreTriggerRef?: RefObject<HTMLButtonElement | null>
  /** Custom className for the More dropdown menu content. */
  moreMenuClassName?: string
  /** Dropdown menu items rendered inside the Add New (+) dropdown. Defaults to a single "Document" item. */
  addNewContent?: ReactNode
  /** Extra custom icons rendered inside the trailing actions group, after the built-in actions. */
  trailingActionsSlot?: ReactNode
  /** Allow editing the final breadcrumb. Defaults to true. */
  onRename?: boolean
  /** Persist an edited breadcrumb name in the consuming page. */
  onBreadcrumbRename?: (name: string) => void
  toolbar?: ReactNode
  segmentControl?: ReactNode
  className?: string
}

interface RenameBreadcrumbProps {
  label: string
  onRename: (name: string) => void
}

function RenameBreadcrumb({ label, onRename }: RenameBreadcrumbProps) {
  const isMobile = useIsMobile()
  const [isOpen, setIsOpen] = useState(false)
  const [value, setValue] = useState(label)

  useEffect(() => {
    setValue(label)
  }, [label])

  const trigger = <button type="button" aria-label={`Rename ${label}`} className="max-w-[140px] truncate font-normal text-foreground transition-colors hover:text-foreground sm:max-w-[200px] md:max-w-xs">{label}</button>
  const form = (
    <form className="flex gap-2" onSubmit={(event) => {
      event.preventDefault()
      const nextName = value.trim()
      if (nextName) onRename(nextName)
      setIsOpen(false)
    }}>
      <Input aria-label="File name" value={value} onChange={(event) => setValue(event.target.value)} autoFocus />
      <Button type="submit" size="sm">Save</Button>
    </form>
  )

  if (isMobile) {
    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger render={trigger} />
        <DialogContent>
          <DialogHeader><DialogTitle>Rename file</DialogTitle></DialogHeader>
          {form}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger render={trigger} />
      <PopoverContent align="start" className="w-64 gap-3 rounded-xl p-3">
        <PopoverHeader><PopoverTitle>Rename file</PopoverTitle></PopoverHeader>
        {form}
      </PopoverContent>
    </Popover>
  )
}

export function AppHeaderStatus({ status }: { status: 'saving' | 'saved' }) {
  return (
    <div
      className="flex h-7 shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
      role="status"
      aria-live="polite"
      aria-label={status === 'saving' ? 'Saving…' : 'Saved'}
    >
      <HugeiconsIcon
        icon={status === 'saving' ? Loading03Icon : CloudCheckIcon}
        strokeWidth={2}
        className={cn('size-4', status === 'saving' && 'animate-spin')}
      />
      <span className="hidden md:inline">{status === 'saving' ? 'Saving…' : 'Saved'}</span>
    </div>
  )
}

/** Responsive header with an optional title tracked from the editor content. */
export function AppHeader({
  title,
  showTitle = false,
  titleRef,
  breadcrumbs = [],
  leadingAction = 'sidebar',
  hideLeadingOnMobile = false,
  hideBreadcrumbsOnMobile = false,
  onBack,
  onSidebarToggle,
  showCenterLeftActions = true,
  centerLeftActions = [],
  status,
  showTrailingActions = true,
  addNewAction = true,
  shareAction = false,
  onShare,
  favoriteAction = false,
  moreAction = false,
  isFavorite = false,
  onFavorite,
  lockAction = false,
  isLocked = false,
  onLockToggle,
  onMoreOpenChange,
  moreContent,
  moreTriggerRef,
  moreMenuClassName,
  addNewContent,
  trailingActionsSlot,
  onRename = true,
  onBreadcrumbRename,
  toolbar,
  segmentControl,
  className,
}: AppHeaderProps) {
  const isMobile = useIsMobile()
  const headerRef = useRef<HTMLElement>(null)
  const [isCompact, setIsCompact] = useState(false)
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [copyMessage, setCopyMessage] = useState('')
  const link = typeof window !== 'undefined' ? window.location.href : ''
  const [renamedTitle, setRenamedTitle] = useState<string>()
  const lastBreadcrumbLabel = breadcrumbs.at(-1)?.label
  useEffect(() => setRenamedTitle(undefined), [title, lastBreadcrumbLabel])
  const displayTitle = renamedTitle ?? title
  const compactTitle = displayTitle || lastBreadcrumbLabel || 'Page'
  let sidebarToggle: (() => void) | undefined
  let isSidebarCollapsed = false
  try {
    const sidebar = useSidebar()
    sidebarToggle = sidebar.toggleSidebar
    isSidebarCollapsed = sidebar.state === 'collapsed'
  } catch {
    sidebarToggle = undefined
    isSidebarCollapsed = false
  }
  const hasLeading = leadingAction !== 'none' && !(isMobile && hideLeadingOnMobile)
  const leadingHandler = leadingAction === 'back' ? onBack : (onSidebarToggle ?? sidebarToggle)
  const leadingLabel = leadingAction === 'back' ? 'Go back' : 'Open navigation'
  const leadingIcon =
    leadingAction === 'back'
      ? ArrowLeft01Icon
      : isSidebarCollapsed
        ? SidebarRight01Icon
        : SidebarLeft01Icon

  const hasTrailingActions = addNewAction || shareAction || lockAction || favoriteAction || moreAction || !!trailingActionsSlot
  const showRightSide = !!status || (showTrailingActions && hasTrailingActions)

  // Indentation for toolbar/segmentControl rows to align with the breadcrumb/title area.
  // On md+: sidebar icon is size-7 (1.75rem) + gap-3 (0.75rem) = 2.5rem
  const slotIndentClass = hasLeading ? 'md:pl-[2.5rem]' : ''

  useEffect(() => {
    const header = headerRef.current
    const editorTitle = titleRef?.current
    if (!header || !editorTitle) {
      setIsCompact(false)
      return
    }

    const updateCompact = () => {
      // Compact scroll title is a mobile-only behaviour (below the md breakpoint).
      const isMobile = window.innerWidth < 768
      setIsCompact(isMobile && editorTitle.getBoundingClientRect().top <= header.getBoundingClientRect().bottom)
    }
    // Capture scrolls from nested editor containers as well as the document.
    window.addEventListener('scroll', updateCompact, { passive: true, capture: true })
    window.addEventListener('resize', updateCompact)
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(updateCompact)
    observer?.observe(header)
    observer?.observe(editorTitle)
    updateCompact()
    return () => {
      window.removeEventListener('scroll', updateCompact, true)
      window.removeEventListener('resize', updateCompact)
      observer?.disconnect()
    }
  }, [titleRef])

  return (
    <header
      ref={headerRef}
      data-compact={isCompact}
      className={cn(
        'group/app-header sticky top-0 z-40 flex w-full flex-col gap-2 bg-background/95 px-4 py-3 text-foreground backdrop-blur md:gap-1 md:px-4 md:py-4',
        className,
      )}
    >
      <div className="flex w-full items-start gap-2 group-data-[compact=true]/app-header:items-center md:items-center md:gap-3">
        {hasLeading ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={leadingLabel}
            title={leadingLabel}
            disabled={!leadingHandler}
            onClick={leadingHandler}
            className={cn('shrink-0 rounded-lg', leadingAction === 'sidebar' && onBack && 'hidden md:inline-flex')}
          >
            <HugeiconsIcon icon={leadingIcon} strokeWidth={2} className="size-5" />
          </Button>
        ) : null}

        {hasLeading && leadingAction === 'sidebar' && onBack ? (
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Go back" title="Go back"
            disabled={!onBack} onClick={onBack} className="shrink-0 rounded-lg md:hidden">
            <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-5" />
          </Button>
        ) : null}

        <div className="hidden min-w-0 flex-1 group-data-[compact=true]/app-header:block">
          <p className="truncate text-sm font-bold leading-5">{compactTitle}</p>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-3 group-data-[compact=true]/app-header:hidden">
          <div className="min-w-0 flex-1">
            {breadcrumbs.length && !(isMobile && hideBreadcrumbsOnMobile) ? (
              <Breadcrumb className={cn(hideBreadcrumbsOnMobile && 'hidden md:block')}>
                <BreadcrumbList>
                  {breadcrumbs.map((breadcrumb, index) => {
                    const isCurrent = index === breadcrumbs.length - 1
                    const shouldCollapse = breadcrumbs.length > 3
                    const isCollapsed = shouldCollapse && index > 0 && index < breadcrumbs.length - 1
                    if (isCollapsed && index > 1) return null

                    return (
                      <Fragment key={`${breadcrumb.label}:${index}`}>
                        {index ? <BreadcrumbSeparator /> : null}
                        <BreadcrumbItem className="min-w-0">
                          {isCollapsed ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger render={<button type="button" aria-label="More breadcrumbs" />}>
                                <BreadcrumbEllipsis />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                {breadcrumbs.slice(1, -1).map((hiddenBreadcrumb, hiddenIndex) => (
                                  <DropdownMenuItem
                                    key={`${hiddenBreadcrumb.label}:${hiddenIndex}`}
                                    disabled={!hiddenBreadcrumb.onPress}
                                    onClick={hiddenBreadcrumb.onPress}
                                  >
                                    {hiddenBreadcrumb.label}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : isCurrent ? (
                            onRename ? (
                              <RenameBreadcrumb label={renamedTitle ?? breadcrumb.label} onRename={(name) => {
                                setRenamedTitle(name)
                                onBreadcrumbRename?.(name)
                              }} />
                            ) : (
                              <BreadcrumbPage className="max-w-[140px] truncate sm:max-w-[200px] md:max-w-xs">
                                {renamedTitle ?? breadcrumb.label}
                              </BreadcrumbPage>
                            )
                          ) : breadcrumb.onPress ? (
                            <BreadcrumbLink
                              render={<button type="button" className="max-w-[120px] truncate sm:max-w-[180px]" />}
                              onClick={breadcrumb.onPress}
                            >
                              {breadcrumb.label}
                            </BreadcrumbLink>
                          ) : (
                            <BreadcrumbLink
                              render={<span className="max-w-[120px] truncate sm:max-w-[180px]" />}
                            >
                              {breadcrumb.label}
                            </BreadcrumbLink>
                          )}
                        </BreadcrumbItem>
                      </Fragment>
                    )
                  })}
                </BreadcrumbList>
              </Breadcrumb>
            ) : null}
            {showTitle && displayTitle ? (
              <h1 className={cn('truncate text-2xl font-bold leading-7 tracking-tight', breadcrumbs.length && 'mt-1')}>{displayTitle}</h1>
            ) : null}

          </div>

          {showCenterLeftActions && centerLeftActions.length ? (
            <div
              role="group"
              className="hidden shrink-0 items-center gap-1 md:flex"
              aria-label="Page actions"
            >
              {centerLeftActions.map((action) => (
                <Button
                  key={action.id}
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={action.label}
                  title={action.label}
                  aria-pressed={action.isActive}
                  disabled={action.isDisabled}
                  onClick={action.onPress}
                  className={cn('rounded-lg', action.isActive && 'bg-muted text-foreground')}
                >
                  <HugeiconsIcon icon={action.icon} strokeWidth={2} className="size-4" />
                </Button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Right side: Status (separate) + Trailing Actions group */}
        {showRightSide ? (
          <div className="flex shrink-0 items-center gap-3">
            {typeof status === 'string' && (status === 'saving' || status === 'saved') ? (
              <AppHeaderStatus status={status} />
            ) : (
              (status as ReactNode) ?? null
            )}

            {showTrailingActions && hasTrailingActions ? (
              <div
                role="group"
                aria-label="Trailing actions"
                className="flex shrink-0 items-center gap-2"
              >
                {addNewAction ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={<Button type="button" variant="default" size="icon-sm" className="rounded-lg" />}
                      aria-label="Add new"
                      title="Add new"
                    >
                      <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" bottomSheet={isMobile} showBackdrop={isMobile}>
                      {addNewContent ?? <DropdownMenuItem>Document</DropdownMenuItem>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}

                {shareAction ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Share"
                    title="Share"
                    onClick={() => {
                      if (onShare) {
                        onShare()
                        return
                      }
                      setCopyMessage('')
                      setIsShareOpen(true)
                    }}
                    className="rounded-lg"
                  >
                    <HugeiconsIcon icon={Share08Icon} strokeWidth={2} className="size-4" />
                  </Button>
                ) : null}

                {lockAction ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={isLocked ? 'Unlock page' : 'Lock page'}
                    title={isLocked ? 'Unlock page' : 'Lock page'}
                    aria-pressed={isLocked}
                    onClick={onLockToggle}
                    className={cn('rounded-lg md:hidden', isLocked && 'bg-muted text-foreground')}
                  >
                    <HugeiconsIcon
                      icon={isLocked ? LockIcon : LockOpenIcon}
                      strokeWidth={2}
                      className={cn('size-4', isLocked && 'text-amber-500 dark:text-amber-400')}
                    />
                  </Button>
                ) : null}

                {favoriteAction ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    aria-pressed={isFavorite}
                    onClick={onFavorite}
                    className={cn('rounded-lg', isFavorite && 'bg-muted text-foreground')}
                  >
                    <HugeiconsIcon
                      icon={StarIcon}
                      strokeWidth={2}
                      className={cn('size-4', isFavorite && 'fill-current text-amber-500')}
                    />
                  </Button>
                ) : null}

                {moreAction ? (
                  <DropdownMenu onOpenChange={onMoreOpenChange}>
                    <DropdownMenuTrigger
                      ref={moreTriggerRef}
                      render={<Button type="button" variant="ghost" size="icon-sm" className="rounded-lg" />}
                      aria-label="More actions"
                      title="More actions"
                      disabled={!moreContent}
                    >
                      <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" bottomSheet={isMobile} showBackdrop={isMobile} style={isMobile ? { maxHeight: '90vh' } : undefined} className={cn('min-w-48', moreMenuClassName)}>
                      {moreContent}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}

                {trailingActionsSlot}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {toolbar ? (
        <div className={cn('min-w-0 max-w-full overflow-x-auto overscroll-x-contain py-1', slotIndentClass)}>
          {toolbar}
        </div>
      ) : null}
      {segmentControl ? (
        <div className={cn('min-w-0 max-w-full overflow-x-auto overscroll-x-contain py-1', slotIndentClass)}>
          {segmentControl}
        </div>
      ) : null}

      {shareAction ? (
        <Dialog open={isShareOpen} onOpenChange={setIsShareOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Share {compactTitle}</DialogTitle>
              <DialogDescription>Copy a link to this page. This does not change access permissions.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <Input aria-label="Share link" value={link} readOnly onFocus={(event) => event.target.select()} />
              <Button onClick={async () => {
                try {
                  if (!navigator.clipboard) throw new Error('Clipboard unavailable')
                  await navigator.clipboard.writeText(link)
                  setCopyMessage('Link copied')
                } catch {
                  setCopyMessage('Could not copy the link. Select and copy it manually.')
                }
              }}>Copy link</Button>
              {copyMessage ? <p role="status">{copyMessage}</p> : null}
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </header>
  )
}
