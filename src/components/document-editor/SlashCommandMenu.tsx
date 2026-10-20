import {
  Bars3BottomLeftIcon,
  ChatBubbleBottomCenterTextIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  CircleStackIcon,
  CommandLineIcon,
  DocumentIcon,
  DocumentTextIcon,
  HashtagIcon,
  ListBulletIcon,
  MinusIcon,
  MusicalNoteIcon,
  NumberedListIcon,
  PaperClipIcon,
  PhotoIcon,
  QueueListIcon,
  TableCellsIcon,
  VideoCameraIcon,
  ViewColumnsIcon,
} from '@heroicons/react/24/outline'
import type { Editor } from '@tiptap/react'
import { useEffect, useRef } from 'react'

import { useVisualViewport } from '../../hooks/useVisualViewport'
import { commandMenuTop, filterSlashCommands, groupSlashCommands, type SlashCommand, type SlashMenuState } from './slashCommands'

const DESKTOP_MENU_HEIGHT = 352
const MOBILE_MENU_HEIGHT = 320
const commandIcons = {
  paragraph: DocumentTextIcon,
  h1: HashtagIcon,
  h2: HashtagIcon,
  h3: HashtagIcon,
  h4: HashtagIcon,
  quote: ChatBubbleBottomCenterTextIcon,
  hr: MinusIcon,
  bullet: ListBulletIcon,
  numbered: NumberedListIcon,
  task: CheckCircleIcon,
  toggle: ChevronRightIcon,
  'toggle-h1': ChevronRightIcon,
  'toggle-h2': ChevronRightIcon,
  'toggle-h3': ChevronRightIcon,
  'toggle-h4': ChevronRightIcon,
  image: PhotoIcon,
  video: VideoCameraIcon,
  audio: MusicalNoteIcon,
  file: PaperClipIcon,
  'document-link': DocumentIcon,
  table: TableCellsIcon,
  database: CircleStackIcon,
  callout: ChatBubbleBottomCenterTextIcon,
  'columns-2': ViewColumnsIcon,
  'columns-3': ViewColumnsIcon,
  'columns-4': ViewColumnsIcon,
  'columns-5': ViewColumnsIcon,
  toc: QueueListIcon,
  'code-block': CommandLineIcon,
  'inline-code': CommandLineIcon,
} as const

function CommandIcon({ command, className }: { command: SlashCommand; className: string }) {
  const Icon = commandIcons[command.id as keyof typeof commandIcons] ?? Bars3BottomLeftIcon
  return <Icon aria-hidden="true" className={className} />
}

function scrollOptionIntoMenuView(option: HTMLElement | null) {
  if (!option) return
  const scroller = option.closest<HTMLElement>('[data-command-menu-scroller="true"]')
  if (!scroller) return
  const optionRect = option.getBoundingClientRect()
  const scrollerRect = scroller.getBoundingClientRect()
  if (optionRect.top < scrollerRect.top) scroller.scrollTop -= scrollerRect.top - optionRect.top
  else if (optionRect.bottom > scrollerRect.bottom) scroller.scrollTop += optionRect.bottom - scrollerRect.bottom
}

interface SlashCommandMenuProps {
  editor?: Editor
  menu: SlashMenuState
  selectedIndex: number
  onSelectIndex: (index: number) => void
  onRun: (command: SlashCommand) => void
}

export function BlockCommandMenu({
  ariaLabel,
  commands,
  selectedIndex,
  onSelectIndex,
  onRun,
  className = '',
}: {
  ariaLabel: string
  commands: SlashCommand[]
  selectedIndex: number
  onSelectIndex: (index: number) => void
  onRun: (command: SlashCommand) => void
  className?: string
}) {
  const selectedOptionRef = useRef<HTMLButtonElement>(null)
  const lastMouseCoordsRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    scrollOptionIntoMenuView(selectedOptionRef.current)
  }, [selectedIndex])

  const handleOptionMouseMove = (event: React.MouseEvent, index: number) => {
    if (
      lastMouseCoordsRef.current &&
      lastMouseCoordsRef.current.x === event.clientX &&
      lastMouseCoordsRef.current.y === event.clientY
    ) {
      return
    }
    lastMouseCoordsRef.current = { x: event.clientX, y: event.clientY }
    onSelectIndex(index)
  }

  return (
    <div role="listbox" aria-label={ariaLabel} className={className}>
      {commands.length ? groupSlashCommands(commands).map((group) => (
        <section key={group.category} aria-label={group.category}>
          <h3 className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{group.category}</h3>
          {group.commands.map((command) => {
            const index = commands.indexOf(command)
            const isSelected = index === selectedIndex
            return (
              <button
                key={command.id}
                ref={isSelected ? selectedOptionRef : undefined}
                type="button"
                tabIndex={-1}
                role="option"
                aria-selected={isSelected}
                onMouseMove={(event) => handleOptionMouseMove(event, index)}
                onMouseDown={(event) => {
                  event.preventDefault()
                  onRun(command)
                }}
                className={`flex min-h-10 w-full items-center gap-3 rounded-[7px] px-3 py-2 text-left ${isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-[var(--app-subtle)]'}`}
              >
                <CommandIcon command={command} className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 text-sm font-semibold">{command.title}</span>
                {command.shortcut ? <span className={`text-xs font-medium ${isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>{command.shortcut}</span> : null}
              </button>
            )
          })}
        </section>
      )) : (
        <p className="px-3 py-2 text-sm text-muted-foreground">No matching blocks</p>
      )}
    </div>
  )
}

export function SlashCommandMenu({ editor, menu, selectedIndex, onSelectIndex, onRun }: SlashCommandMenuProps) {
  const commands = filterSlashCommands(menu.query, editor)
  const estimatedHeight = Math.min(DESKTOP_MENU_HEIGHT, Math.max(72, commands.length * 36 + 24))
  const top = commandMenuTop(menu.rect, estimatedHeight, 8)
  const left = Math.max(8, Math.min(menu.rect.left, window.innerWidth - 320 - 8))

  return (
    <div
      className="fixed z-50 max-h-[min(22rem,calc(100dvh-1rem))] w-[min(20rem,calc(100vw-1rem))] overflow-y-auto rounded-[8px] border border-[var(--app-border)] bg-[var(--app-surface)] p-1 shadow-[0_16px_40px_rgba(0,0,0,0.14)]"
      data-slash-command-menu="true"
      data-command-menu-scroller="true"
      style={{ top: Math.max(8, top), left }}
    >
      <BlockCommandMenu ariaLabel="Slash command options" commands={commands} selectedIndex={selectedIndex} onSelectIndex={onSelectIndex} onRun={onRun} />
    </div>
  )
}

export function MobileSlashCommandMenu({ editor, menu, selectedIndex, onSelectIndex, onRun }: SlashCommandMenuProps) {
  const commands = filterSlashCommands(menu.query, editor)
  const selectedOptionRef = useRef<HTMLButtonElement>(null)
  const hasRunCommandRef = useRef(false)
  const lastMouseCoordsRef = useRef<{ x: number; y: number } | null>(null)
  const bounds = useVisualViewport(true)
  const estimatedHeight = Math.min(MOBILE_MENU_HEIGHT, Math.max(72, commands.length * 44 + 40))
  // Reserve space for mobile document toolbar (~64px) if present above keyboard
  const availableBottom = Math.max(80, bounds.visibleBottom - 64)
  const top = commandMenuTop(menu.rect, estimatedHeight, 8, 8, availableBottom)
  const menuWidth = Math.min(352, window.innerWidth - 16)
  const left = Math.max(8, Math.min(menu.rect.left, window.innerWidth - menuWidth - 8))
  const maxListHeight = Math.max(120, Math.min(288, availableBottom - top - 48))

  useEffect(() => {
    scrollOptionIntoMenuView(selectedOptionRef.current)
  }, [selectedIndex])

  useEffect(() => {
    hasRunCommandRef.current = false
  }, [menu.range.from, menu.range.to, menu.query])

  const handleOptionMouseMove = (event: React.MouseEvent, index: number) => {
    if (
      lastMouseCoordsRef.current &&
      lastMouseCoordsRef.current.x === event.clientX &&
      lastMouseCoordsRef.current.y === event.clientY
    ) {
      return
    }
    lastMouseCoordsRef.current = { x: event.clientX, y: event.clientY }
    onSelectIndex(index)
  }

  return (
    <div
      className="fixed z-50 w-[min(22rem,calc(100vw-1rem))] rounded-[10px] border border-[var(--app-border)] bg-[var(--app-surface)] p-1 shadow-[0_16px_40px_rgba(0,0,0,0.18)] md:hidden"
      data-slash-command-menu="true"
      style={{
        top: Math.max(8, top),
        left,
      }}
      role="presentation"
    >
      <div className="mb-1 px-2 py-1">
        <p className="text-xs font-semibold text-muted-foreground">Insert block</p>
      </div>
      <div
        role="listbox"
        aria-label="Slash command menu"
        className="overflow-y-auto overscroll-contain"
        data-command-menu-scroller="true"
        style={{ maxHeight: maxListHeight }}
      >
        {commands.length ? groupSlashCommands(commands).map((group) => (
          <section key={group.category} aria-label={group.category}>
            <h3 className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{group.category}</h3>
            {group.commands.map((command) => {
              const index = commands.indexOf(command)
              const isSelected = index === selectedIndex
              const runCommand = () => {
                if (hasRunCommandRef.current) return
                hasRunCommandRef.current = true
                onRun(command)
              }
              return (
                <button
                  key={command.id}
                  ref={isSelected ? selectedOptionRef : undefined}
                  type="button"
                  tabIndex={-1}
                  role="option"
                  aria-selected={isSelected}
                  onMouseMove={(event) => handleOptionMouseMove(event, index)}
                  onPointerDownCapture={(event) => { event.preventDefault(); runCommand() }}
                  onPointerDown={(event) => { event.preventDefault(); runCommand() }}
                  onMouseDownCapture={(event) => { event.preventDefault(); runCommand() }}
                  onMouseDown={(event) => { event.preventDefault(); runCommand() }}
                  onTouchStartCapture={(event) => { event.preventDefault(); runCommand() }}
                  onTouchStart={(event) => { event.preventDefault(); runCommand() }}
                  onClick={runCommand}
                  className={`flex min-h-12 w-full items-center gap-3 rounded-[8px] px-3 py-2 text-left transition ${
                    isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-[var(--app-subtle)]'
                  }`}
                >
                  <CommandIcon command={command} className="size-5 shrink-0" />
                  <span className="min-w-0 flex-1 text-sm font-semibold">{command.title}</span>
                  {command.shortcut ? <span className={`text-xs font-medium ${isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>{command.shortcut}</span> : null}
                </button>
              )
            })}
          </section>
        )) : (
          <p className="px-3 py-4 text-sm text-muted-foreground">No matching blocks</p>
        )}
      </div>
    </div>
  )
}
