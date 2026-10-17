import {
  Copy02Icon,
  CopyIcon,
  Delete02Icon,
  Download01Icon,
  MoreHorizontalIcon,
  TextWrapIcon,
  Tick02Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { CodeBlock as TiptapCodeBlock } from '@tiptap/extension-code-block'
import { ReactNodeViewRenderer, NodeViewContent, NodeViewWrapper, type NodeViewProps, type Editor } from '@tiptap/react'
import { Plugin } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { useEffect, useMemo, useRef, useState, type ElementType, type MouseEvent, type PointerEvent } from 'react'

import { useDeviceMode } from '../../../hooks/useDeviceMode'
import { Button } from '../../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { CODE_LANGUAGES, detectCodeLanguage, normalizeLanguage, syntaxDecorationsForCodeBlock } from './CodeBlockLanguage'

const CodeContent = NodeViewContent as ElementType

function CodeBlockView({ editor, getPos, node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const { isTouch } = useDeviceMode()
  const language = normalizeLanguage(node.attrs.language)
  const detectedLanguage = normalizeLanguage(node.attrs.detectedLanguage)
  const effectiveLanguage = language === 'auto' ? detectedLanguage : language
  const wrap = node.attrs.wrap !== false
  const [copied, setCopied] = useState(false)
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const [isLanguageOpen, setIsLanguageOpen] = useState(false)
  const containerRef = useRef<HTMLPreElement>(null)
  const label = useMemo(() => CODE_LANGUAGES.find((item) => item.value === language)?.label ?? 'Auto', [language])

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1400)
    return () => window.clearTimeout(timer)
  }, [copied])

  const keepEditorFocus = (event: MouseEvent | PointerEvent) => event.preventDefault()

  const handleCopy = () => {
    void navigator.clipboard?.writeText(node.textContent)
    setCopied(true)
    editor.view.focus()
  }

  const handleDuplicate = () => {
    const pos = getPos()
    if (pos === undefined) return
    editor.chain().focus().insertContentAt(pos + node.nodeSize, node.toJSON()).run()
  }

  const handleToggleWrap = () => {
    updateAttributes({ wrap: !wrap })
    editor.view.focus()
  }

  const handleDownload = () => {
    const code = node.textContent
    const filename = `code-snippet.md`
    const blob = new Blob([code], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleDelete = () => {
    if (deleteNode) {
      deleteNode()
      return
    }
    const pos = getPos()
    if (pos !== undefined) {
      editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run()
    }
  }

  const isToolbarActive = isMoreOpen || isLanguageOpen

  return (
    <NodeViewWrapper
      ref={containerRef}
      as="pre"
      className={`mybook-code-block group/code relative ${wrap ? 'mybook-code-block-wrap' : 'mybook-code-block-scroll'} ${
        selected ? 'ProseMirror-selectednode' : ''
      }`}
      data-language={effectiveLanguage}
      data-selected-language={language}
      data-menu-open={isToolbarActive ? 'true' : 'false'}
      onClick={(e: MouseEvent<HTMLPreElement>) => {
        if (e.target === containerRef.current) {
          editor.view.focus()
        }
      }}
    >
      <div
        className={`mybook-image-block-toolbar group-hover/code:opacity-100 group-hover/code:pointer-events-auto ${
          isToolbarActive ? 'is-open' : ''
        }`}
        data-state={isToolbarActive ? 'open' : 'closed'}
        contentEditable={false}
        data-testid="code-block-toolbar"
      >
        {/* 1. Language Selection Dropdown */}
        <span className="mybook-desktop-only-action">
          <Select
            value={language}
            open={isLanguageOpen}
            onOpenChange={setIsLanguageOpen}
            onValueChange={(value) => {
              updateAttributes({ language: value })
              editor.view.focus()
            }}
          >
            <SelectTrigger
              aria-label="Code language"
              size="sm"
              onMouseDown={(event) => event.stopPropagation()}
              className="h-[1.875rem] min-w-[4.75rem] max-w-[8.5rem] rounded-md border border-transparent bg-transparent px-2 text-xs font-medium text-foreground hover:bg-[var(--app-subtle)] focus-visible:border-ring shadow-none"
            >
              <SelectValue>{label}</SelectValue>
            </SelectTrigger>
            <SelectContent
              align="start"
              sideOffset={6}
              showScrollButtons={false}
              className="mybook-code-language-content max-h-72 min-w-44 rounded-xl"
            >
              {CODE_LANGUAGES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </span>

        {/* 2. Copy Code */}
        <span className="mybook-desktop-only-action">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={copied ? 'Copied code' : 'Copy code'}
            title={copied ? 'Copied' : 'Copy code'}
            onMouseDown={keepEditorFocus}
            onClick={handleCopy}
            className="mybook-image-toolbar-button"
          >
            <HugeiconsIcon icon={copied ? Tick02Icon : CopyIcon} strokeWidth={2} className="size-4" aria-hidden="true" />
          </Button>
        </span>

        {/* 3. Duplicate */}
        <span className="mybook-desktop-only-action">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Duplicate code block"
            title="Duplicate"
            onMouseDown={keepEditorFocus}
            onClick={handleDuplicate}
            className="mybook-image-toolbar-button"
          >
            <HugeiconsIcon icon={Copy02Icon} strokeWidth={2} className="size-4" aria-hidden="true" />
          </Button>
        </span>

        {/* 4. Wrap text */}
        <span className="mybook-desktop-only-action">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={wrap ? 'Disable text wrapping' : 'Enable text wrapping'}
            aria-pressed={wrap}
            data-state={wrap ? 'on' : 'off'}
            title={wrap ? 'Wrap text on' : 'Wrap text off'}
            onMouseDown={keepEditorFocus}
            onClick={handleToggleWrap}
            className="mybook-image-toolbar-button"
          >
            <HugeiconsIcon icon={TextWrapIcon} strokeWidth={2} className="size-4" aria-hidden="true" />
          </Button>
        </span>

        {/* 5. More Menu */}
        <DropdownMenu open={isMoreOpen} onOpenChange={setIsMoreOpen}>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="More code options"
                title="More options"
                className="mybook-image-toolbar-button"
              />
            }
          >
            <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent bottomSheet={isTouch} align="end" sideOffset={6} className="min-w-44 rounded-xl p-1.5 shadow-lg">
            {isTouch ? (
              <>
                <DropdownMenuItem
                  closeOnClick={false}
                  onClick={() => {
                    handleCopy()
                  }}
                  className="flex items-center gap-2"
                >
                  <HugeiconsIcon icon={copied ? Tick02Icon : CopyIcon} strokeWidth={2} className="size-4 shrink-0" />
                  <span className="whitespace-nowrap">{copied ? 'Copied' : 'Copy code'}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    handleDuplicate()
                    setIsMoreOpen(false)
                  }}
                  className="flex items-center gap-2"
                >
                  <HugeiconsIcon icon={Copy02Icon} strokeWidth={2} className="size-4 shrink-0" />
                  <span className="whitespace-nowrap">Duplicate</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    handleToggleWrap()
                    setIsMoreOpen(false)
                  }}
                  className="flex items-center gap-2"
                >
                  <HugeiconsIcon icon={TextWrapIcon} strokeWidth={2} className="size-4 shrink-0" />
                  <span className="whitespace-nowrap">{wrap ? 'Disable wrap' : 'Wrap text'}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            ) : null}
            <DropdownMenuItem
              onClick={() => {
                handleDownload()
                setIsMoreOpen(false)
              }}
              className="flex items-center gap-2"
            >
              <HugeiconsIcon icon={Download01Icon} strokeWidth={2} className="size-4 shrink-0" />
              <span className="whitespace-nowrap">Download</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                handleDelete()
                setIsMoreOpen(false)
              }}
              className="flex items-center gap-2"
            >
              <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4 shrink-0" />
              <span className="whitespace-nowrap">Delete</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <CodeContent as="code" className={`language-${effectiveLanguage}`} />
    </NodeViewWrapper>
  )
}

export const CodeBlock = TiptapCodeBlock.extend({
  addOptions() {
    return {
      languageClassPrefix: 'language-',
      exitOnTripleEnter: true,
      exitOnArrowDown: true,
      tabSize: 2,
      HTMLAttributes: {},
      ...this.parent?.(),
      defaultLanguage: 'auto',
      enableTabIndentation: true,
    }
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      language: {
        default: 'auto',
        parseHTML: (element) => normalizeLanguage(element.firstElementChild?.className.replace(/^language-/u, '') || element.getAttribute('data-selected-language') || 'auto'),
        rendered: false,
      },
      detectedLanguage: {
        default: 'text',
        parseHTML: (element) => normalizeLanguage(element.getAttribute('data-language') || 'text'),
        rendered: false,
      },
      wrap: {
        default: true,
        parseHTML: (element) => element.getAttribute('data-wrap') !== 'false',
        rendered: false,
      },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView)
  },
  addKeyboardShortcuts() {
    const handleSelectAllInBlock = ({ editor }: { editor?: Editor } = {}) => {
      const activeEditor = editor ?? this.editor
      if (!activeEditor?.state) return false

      const { state, commands } = activeEditor
      const { selection } = state
      const { $from, $to } = selection

      if ($from.parent.type.name !== this.name || !$from.sameParent($to)) {
        return false
      }

      const blockStart = $from.start()
      const blockEnd = $from.end()

      if (blockStart === blockEnd || (selection.from === blockStart && selection.to === blockEnd)) {
        return false
      }

      return commands.setTextSelection({
        from: blockStart,
        to: blockEnd,
      })
    }

    return {
      ...(typeof this.parent === 'function' ? this.parent() : {}),
      'Mod-a': handleSelectAllInBlock,
      'Mod-A': handleSelectAllInBlock,
    }
  },
  addProseMirrorPlugins() {
    const parentPlugins = this.parent?.() ?? []
    return [
      ...parentPlugins,
      new Plugin({
        // The React node view mounts after ProseMirror sets the caret, so the browser selection can land
        // outside a newly created, empty code block. Re-sync it once the view has rendered.
        view: () => ({
          update: (view, prevState) => {
            const { selection } = view.state
            const { $from } = selection
            if (!selection.empty || $from.parent.type.name !== this.name || $from.parent.content.size > 0) return
            if (prevState.selection.$from.parent === $from.parent) return
            window.setTimeout(() => {
              if (view.isDestroyed || !view.hasFocus()) return
              const current = view.state.selection.$from
              if (current.parent.type.name === this.name && current.parent.content.size === 0) view.focus()
            }, 0)
          },
        }),
        appendTransaction: (_transactions, _oldState, newState) => {
          let transaction = newState.tr
          let changed = false
          newState.doc.descendants((node, pos) => {
            if (node.type.name !== this.name) return
            const selectedLanguage = normalizeLanguage(node.attrs.language)
            if (selectedLanguage !== 'auto') return
            const detectedLanguage = detectCodeLanguage(node.textContent)
            if (normalizeLanguage(node.attrs.detectedLanguage) === detectedLanguage) return
            transaction = transaction.setNodeMarkup(pos, undefined, { ...node.attrs, detectedLanguage })
            changed = true
          })
          return changed ? transaction.setMeta('addToHistory', false) : null
        },
        props: {
          decorations: (state) => {
            const decorations: Decoration[] = []
            state.doc.descendants((node, pos) => {
              if (node.type.name !== this.name) return
              const selectedLanguage = normalizeLanguage(node.attrs.language)
              const language = selectedLanguage === 'auto' ? normalizeLanguage(node.attrs.detectedLanguage) : selectedLanguage
              decorations.push(...syntaxDecorationsForCodeBlock(node.textContent, language, pos + 1))
            })
            return DecorationSet.create(state.doc, decorations)
          },
        },
      }),
    ]
  },
})
