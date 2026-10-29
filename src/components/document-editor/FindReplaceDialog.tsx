import type { Editor } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'

import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { createSearchHighlightPlugin, findMatchesInDoc, searchHighlightPluginKey } from './extensions/SearchHighlight'
import { scrollActiveMatchIntoView } from './findReplaceScroll'

export function FindReplaceDialog({
  editor,
  open,
  onOpenChange,
}: {
  editor: Editor
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [query, setQuery] = useState('')
  const [replacement, setReplacement] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [showReplacement, setShowReplacement] = useState(false)
  const [docVersion, setDocVersion] = useState(0)

  const findInputRef = useRef<HTMLInputElement>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    if (searchHighlightPluginKey.get(editor.state) !== undefined) return
    editor.registerPlugin(createSearchHighlightPlugin())
    return () => {
      if (!editor.isDestroyed) editor.unregisterPlugin(searchHighlightPluginKey)
    }
  }, [editor])

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    const handleTransaction = () => {
      setDocVersion((v) => v + 1)
    }
    editor.on('transaction', handleTransaction)
    return () => {
      editor.off('transaction', handleTransaction)
    }
  }, [editor])

  const matches = useMemo(
    () => (!editor || editor.isDestroyed || !open ? [] : findMatchesInDoc(editor.state.doc, query)),
    // docVersion ensures matches update immediately when document changes (e.g. on replace)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, query, open, docVersion],
  )

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    editor.view.dispatch(
      editor.state.tr.setMeta(searchHighlightPluginKey, {
        query: open ? query : '',
        activeIndex: open ? activeIndex : 0,
      }),
    )
  }, [editor, open, query, activeIndex])

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        findInputRef.current?.focus()
        findInputRef.current?.select()
      })
    }
  }, [open])

  useEffect(() => {
    if (showReplacement) {
      requestAnimationFrame(() => {
        replaceInputRef.current?.focus()
        replaceInputRef.current?.select()
      })
    }
  }, [showReplacement])

  useEffect(() => () => {
    if (editor && !editor.isDestroyed) {
      editor.view.dispatch(editor.state.tr.setMeta(searchHighlightPluginKey, { query: '', activeIndex: 0 }))
    }
  }, [editor])

  const selectMatch = (index: number) => {
    if (!matches.length || editor.isDestroyed) return
    const normalized = ((index % matches.length) + matches.length) % matches.length
    const match = matches[normalized]!
    setActiveIndex(normalized)
    editor.view.dispatch(
      editor.state.tr
        .setSelection(TextSelection.create(editor.state.doc, match.from, match.to))
        .setMeta(searchHighlightPluginKey, { query, activeIndex: normalized }),
    )
    requestAnimationFrame(() => {
      if (editor.isDestroyed) return
      try {
        const activeEl = editor.view.dom.querySelector<HTMLElement>('.mybook-search-match-active')
        if (activeEl) {
          scrollActiveMatchIntoView(activeEl, dialogRef.current)
        }
      } catch {
        /* The editor can unmount before the frame runs. */
      }
    })
  }

  const findNext = (direction: 1 | -1) => {
    if (!matches.length || editor.isDestroyed) return
    const current = editor.state.selection.from
    const nextIndex =
      direction > 0
        ? matches.findIndex((match) => match.from > current)
        : matches.map((match) => match.from < current).lastIndexOf(true)
    selectMatch(nextIndex < 0 ? (direction > 0 ? 0 : matches.length - 1) : nextIndex)
  }

  const replaceCurrent = () => {
    if (!matches.length || editor.isDestroyed) return
    let match = matches[activeIndex]
    const selected = editor.state.selection
    const selectedText = editor.state.doc.textBetween(selected.from, selected.to)
    if (!selected.empty && selectedText.toLocaleLowerCase().includes(query.toLocaleLowerCase())) {
      match = { from: selected.from, to: selected.to }
    } else if (!match) {
      findNext(1)
      return
    }
    editor.view.dispatch(editor.state.tr.insertText(replacement, match.from, match.to))
    findNext(1)
  }

  const replaceAll = () => {
    if (!matches.length || editor.isDestroyed) return
    const transaction = editor.state.tr
    for (const match of [...matches].reverse()) transaction.insertText(replacement, match.from, match.to)
    editor.view.dispatch(transaction)
    setActiveIndex(0)
  }

  const handleFindKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (event.shiftKey) findNext(-1)
      else findNext(1)
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      onOpenChange(false)
    }
  }

  const handleReplaceKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      replaceCurrent()
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      onOpenChange(false)
    }
  }

  if (!open) return null

  return (
    <div
      ref={dialogRef}
      role="region"
      aria-label="Find and replace"
      data-find-replace="true"
      data-editor-popover="true"
      className="absolute inset-x-0 top-0 z-50 border-b border-border bg-background/95 shadow-md backdrop-blur supports-[backdrop-filter]:bg-background/85"
    >
      <div className="mx-auto flex max-w-screen-2xl flex-col gap-1.5 px-2.5 py-2 sm:gap-2 sm:px-5">
        {/* Row 1: Search & Navigation */}
        <div className="flex w-full items-center gap-1 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={showReplacement ? 'Hide replace' : 'Toggle replace'}
            title={showReplacement ? 'Hide replace' : 'Toggle replace'}
            aria-expanded={showReplacement}
            onClick={() => setShowReplacement((shown) => !shown)}
          >
            {showReplacement ? (
              <ChevronDownIcon className="size-4" />
            ) : (
              <ChevronRightIcon className="size-4" />
            )}
          </Button>

          <div className="relative min-w-0 flex-1">
            <MagnifyingGlassIcon
              aria-hidden="true"
              className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground sm:left-2.5 sm:size-4"
            />
            <Input
              ref={findInputRef}
              aria-label="Find"
              placeholder="Find..."
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setActiveIndex(0)
              }}
              onKeyDown={handleFindKeyDown}
              className="h-8 pl-7 text-xs sm:pl-8 sm:text-sm"
            />
          </div>

          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            <span
              aria-live="polite"
              className="min-w-7 px-0.5 text-center text-xs tabular-nums text-muted-foreground sm:min-w-8 sm:px-0 sm:text-sm"
            >
              {matches.length
                ? `${Math.min(activeIndex + 1, matches.length)}/${matches.length}`
                : '0/0'}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Previous match"
              title="Previous match"
              disabled={!matches.length}
              onClick={() => findNext(-1)}
            >
              <ChevronUpIcon className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Next match"
              title="Next match"
              disabled={!matches.length}
              onClick={() => findNext(1)}
            >
              <ChevronDownIcon className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Close find and replace"
              title="Close"
              onClick={() => onOpenChange(false)}
            >
              <XMarkIcon className="size-4" />
            </Button>
          </div>
        </div>

        {/* Row 2: Replace controls */}
        {showReplacement && (
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
              <div className="hidden size-8 shrink-0 sm:block" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <Input
                  ref={replaceInputRef}
                  aria-label="Replace with"
                  placeholder="Replace with"
                  value={replacement}
                  onChange={(event) => setReplacement(event.target.value)}
                  onKeyDown={handleReplaceKeyDown}
                  className="h-8 text-xs sm:text-sm"
                />
              </div>
            </div>
            <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 flex-1 px-2.5 text-xs sm:flex-initial sm:px-3 sm:text-sm"
                disabled={!matches.length}
                onClick={replaceCurrent}
              >
                Replace
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 flex-1 px-2.5 text-xs sm:flex-initial sm:px-3 sm:text-sm"
                disabled={!matches.length}
                onClick={replaceAll}
              >
                Replace all
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
