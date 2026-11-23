import * as React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

type ChatContextValue = { layout: "bubble" | "document" }
const ChatContext = React.createContext<ChatContextValue>({ layout: "bubble" })
const ChatSpeakerContext = React.createContext<"user" | "assistant" | "system">("assistant")

function Chat({ className, children, stickToLatest = true, layout = "bubble", hasOlder = false, onLoadOlder, onLoadOlderError, ...props }: React.ComponentProps<"div"> & { stickToLatest?: boolean; layout?: "bubble" | "document"; hasOlder?: boolean; onLoadOlder?: () => void | Promise<void>; onLoadOlderError?: (error: unknown) => void }) {
  const viewport = React.useRef<HTMLDivElement>(null)
  const content = React.useRef<HTMLDivElement>(null)
  const shouldStick = React.useRef(true)
  const loadingOlder = React.useRef(false)
  const [isLoadingOlder, setIsLoadingOlder] = React.useState(false)
  const previousBottomGap = React.useRef<number | null>(null)
  const [olderError, setOlderError] = React.useState<string | null>(null)
  const [atBottom, setAtBottom] = React.useState(true)
  const [unread, setUnread] = React.useState(0)
  const scrollToBottom = React.useCallback((behavior: ScrollBehavior = "instant") => {
    const node = viewport.current
    if (!node) return
    shouldStick.current = true
    setAtBottom(true)
    setUnread(0)
    node.scrollTo({ top: node.scrollHeight, behavior })
  }, [])
  const loadOlder = React.useCallback(async () => {
    const node = viewport.current
    if (!node || !hasOlder || !onLoadOlder || loadingOlder.current) return
    loadingOlder.current = true
    setIsLoadingOlder(true)
    setOlderError(null)
    previousBottomGap.current = node.scrollHeight - node.scrollTop
    try { await onLoadOlder() } catch (error) {
      setOlderError(error instanceof Error ? error.message : "Could not load earlier messages.")
      onLoadOlderError?.(error)
    } finally {
      requestAnimationFrame(() => {
        if (viewport.current && previousBottomGap.current !== null) viewport.current.scrollTop = viewport.current.scrollHeight - previousBottomGap.current
        previousBottomGap.current = null
        loadingOlder.current = false
        setIsLoadingOlder(false)
      })
    }
  }, [hasOlder, onLoadOlder, onLoadOlderError])
  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const node = event.currentTarget
    const bottom = node.scrollHeight - node.scrollTop - node.clientHeight <= 32
    shouldStick.current = bottom
    setAtBottom(bottom)
    if (bottom) setUnread(0)
    if (node.scrollTop <= 64 && node.scrollHeight > node.clientHeight) void loadOlder()
  }
  React.useEffect(() => {
    const node = viewport.current
    const body = content.current
    if (!node || !body || !stickToLatest) return
    node.scrollTop = node.scrollHeight
    const follow = () => { if (shouldStick.current && previousBottomGap.current === null) node.scrollTop = node.scrollHeight }
    const mutation = new MutationObserver((records) => {
      let addedAssistant = 0
      let addedUser = false
      for (const record of records) for (const node of record.addedNodes) {
        if (!(node instanceof HTMLElement)) continue
        const messages = [node, ...node.querySelectorAll<HTMLElement>('[data-slot="chat-message"]')].filter((element) => element.dataset.slot === "chat-message")
        for (const message of messages) {
          if (message.dataset.from === "user") addedUser = true
          else if (message.dataset.from !== "system") addedAssistant += 1
        }
      }
      if (addedUser) scrollToBottom()
      else if (!shouldStick.current) setUnread((count) => count + addedAssistant)
      follow()
    })
    mutation.observe(body, { subtree: true, childList: true, characterData: true })
    const resize = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(follow)
    resize?.observe(body)
    return () => { mutation.disconnect(); resize?.disconnect() }
  }, [stickToLatest, scrollToBottom])
  return <ChatContext.Provider value={{ layout }}><div data-slot="chat" data-layout={layout} className={cn("relative flex min-h-0 flex-col overflow-hidden", className)} {...props}><div ref={viewport} data-slot="chat-viewport" role="log" aria-live="polite" aria-relevant="additions" aria-busy={isLoadingOlder || undefined} tabIndex={0} onScroll={handleScroll} className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4">{isLoadingOlder ? <div role="status" className="pb-2 text-center text-xs text-muted-foreground">Loading earlier messages…</div> : olderError ? <div role="alert" className="pb-2 text-center text-xs text-destructive">{olderError}</div> : null}<div ref={content} data-slot="chat-content" className="flex min-h-full flex-col justify-end gap-5">{children}</div></div><button type="button" data-slot="chat-jump-to-latest" data-state={atBottom ? "closed" : "open"} aria-label={unread ? `Jump to latest, ${unread} new messages` : "Jump to latest"} aria-hidden={atBottom || undefined} tabIndex={atBottom ? -1 : 0} onClick={() => scrollToBottom("smooth")} className="absolute bottom-3 left-1/2 z-10 inline-flex h-10 -translate-x-1/2 items-center gap-2 rounded-full border border-[var(--glass-rim)] bg-[color-mix(in_srgb,var(--glass-tint)_var(--glass-opacity-strong),transparent)] px-4 text-sm shadow-lg backdrop-blur-xl transition-[opacity,transform] data-[state=closed]:pointer-events-none data-[state=closed]:scale-90 data-[state=closed]:opacity-0">↓{unread ? <span className="tabular-nums">{unread > 99 ? "99+" : unread}</span> : null}</button></div></ChatContext.Provider>
}

type ChatMessageProps = React.ComponentProps<"article"> & {
  role?: "user" | "assistant" | "system"
  author?: React.ReactNode
  avatarSrc?: string
  avatarFallback?: string
  timestamp?: React.ReactNode
  from?: "user" | "assistant" | "system"
  name?: string
  grouped?: boolean
  streaming?: boolean
  status?: "sending" | "failed" | "edited"
  onRetry?: () => void
  receipt?: React.ReactNode
  avatar?: React.ReactNode
  actions?: React.ReactNode
  reactions?: React.ReactNode
}

function ChatMessage({ role, from, author, name, grouped = false, streaming = false, status, onRetry, receipt, avatar, avatarSrc, avatarFallback, timestamp, actions, reactions, className, children, ...props }: ChatMessageProps) {
  const { layout } = React.useContext(ChatContext)
  const speaker = from ?? role ?? "assistant"
  const displayName = name ?? author ?? (speaker === "user" ? "You" : "Assistant")
  const user = speaker === "user"
  return <ChatSpeakerContext.Provider value={speaker}><article data-slot="chat-message" data-from={speaker} data-role={speaker} data-grouped={grouped || undefined} aria-busy={streaming || undefined} aria-label={typeof displayName === "string" ? displayName : user ? "You" : "Assistant"} className={cn("group/chat-message flex gap-3", user && "flex-row-reverse", speaker === "system" && "justify-center", grouped && "-mt-3", className)} {...props}>
    {speaker !== "system" && !grouped ? (avatar ?? <Avatar size="sm" className="mt-1 shrink-0"><AvatarImage src={avatarSrc} alt="" /><AvatarFallback>{avatarFallback ?? (user ? "You" : "AI")}</AvatarFallback></Avatar>) : null}
    <div data-slot="chat-message-content" className={cn("flex min-w-0 max-w-[min(85%,var(--chat-bubble-max,44rem))] flex-col items-start gap-1", user && "items-end", layout === "document" && !user && "w-full max-w-full")}>
      {(name || author || timestamp) && !grouped ? <div className={cn("mb-1 flex items-center gap-2 text-xs text-muted-foreground", user && "justify-end")}><span className="font-medium">{displayName}</span>{timestamp ? <time>{timestamp}</time> : null}</div> : null}
      {children}{streaming ? <span className="sr-only">Response streaming</span> : null}
      {status === "sending" ? <span className="mt-1 text-xs text-muted-foreground">Sending…</span> : status === "failed" ? <span className="mt-1 flex items-center gap-2 text-xs text-destructive">Not delivered <button type="button" onClick={onRetry} className="underline underline-offset-2">Retry</button></span> : status === "edited" ? <span className="mt-1 text-xs text-muted-foreground">Edited</span> : null}
      {receipt ? <div className="mt-1 text-xs text-muted-foreground">{receipt}</div> : null}
      {reactions || actions ? <div className={cn("mt-1 flex items-center gap-2", user && "justify-end")}>{reactions}{actions ? <div className="ml-auto opacity-0 transition-opacity group-hover/chat-message:opacity-100 focus-within:opacity-100">{actions}</div> : null}</div> : null}
    </div>
  </article></ChatSpeakerContext.Provider>
}

function ChatMeta({ time, children, className, ...props }: React.ComponentProps<"div"> & { time?: Date | string }) {
  const dateTime = time instanceof Date ? time.toISOString() : time
  return <div data-slot="chat-meta" className={cn("mt-1 text-xs text-muted-foreground", className)} {...props}>{dateTime ? <time dateTime={dateTime}>{children ?? (time instanceof Date ? time.toLocaleTimeString() : time)}</time> : children}</div>
}

const ChatSuggestionsContext = React.createContext<((value: string) => void) | undefined>(undefined)

function ChatSuggestions({ suggestions, onSelect, className, children, ...props }: Omit<React.ComponentProps<"div">, "onSelect"> & { suggestions?: Array<string | { value: string; label: React.ReactNode }>; onSelect?: (value: string) => void }) {
  return <ChatSuggestionsContext.Provider value={onSelect}><div data-slot="chat-suggestions" role="group" aria-label={props["aria-label"] ?? "Suggestions"} className={cn("flex snap-x snap-proximity gap-2 overflow-x-auto overscroll-x-contain py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)} {...props}>{children}{suggestions?.map((suggestion, index) => { const value = typeof suggestion === "string" ? suggestion : suggestion.value; const label = typeof suggestion === "string" ? suggestion : suggestion.label; return <ChatSuggestion key={`${value}-${index}`} value={value}>{label}</ChatSuggestion> })}</div></ChatSuggestionsContext.Provider>
}

function ChatSuggestion({ value, onClick, className, children, ...props }: React.ComponentProps<"button"> & { value?: string }) {
  const onSelect = React.useContext(ChatSuggestionsContext)
  return <button type="button" data-slot="chat-suggestion" className={cn("shrink-0 snap-start rounded-full border border-[var(--glass-rim)] bg-[color-mix(in_srgb,var(--glass-tint)_var(--glass-opacity-subtle),transparent)] px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground", className)} onClick={(event) => { onClick?.(event); if (!event.defaultPrevented) onSelect?.(value ?? (typeof children === "string" ? children : "")) }} {...props}>{children}</button>
}

function ChatAttachment({ name, detail, className, ...props }: React.ComponentProps<"div"> & { name: string; detail?: React.ReactNode }) {
  return <div data-slot="chat-attachment" className={cn("inline-flex max-w-full items-center gap-2 rounded-xl border border-[var(--glass-rim)] bg-[var(--app-surface)]/75 px-3 py-2 text-xs", className)} {...props}><span aria-hidden="true">▤</span><span className="min-w-0 truncate font-medium">{name}</span>{detail ? <span className="text-muted-foreground">{detail}</span> : null}</div>
}

type ChatComposerProps = Omit<React.ComponentProps<"form">, "onSubmit"> & {
  value?: string; defaultValue?: string; onValueChange?: (value: string) => void
  onSubmit?: (text: string) => void; onSend?: () => void; onStop?: () => void
  status?: "ready" | "submitted" | "streaming" | "error"; disabled?: boolean
  placeholder?: string; quickReplies?: string[]; variant?: "inset" | "floating"
  leading?: React.ReactNode; trailing?: React.ReactNode; attachments?: React.ReactNode
  onAttach?: (files: File[]) => void; maxLength?: number; submitOnEnter?: boolean
  textareaProps?: React.ComponentProps<typeof Textarea>
}

function ChatComposer({ value: controlledValue, defaultValue = "", onValueChange, onSubmit, onSend, onStop, status = "ready", disabled = false, placeholder = "Write a message…", quickReplies = [], variant = "inset", leading, trailing, attachments, onAttach, maxLength, submitOnEnter = true, textareaProps, className, ...props }: ChatComposerProps) {
  const [draft, setDraft] = React.useState(defaultValue)
  const [dragging, setDragging] = React.useState(false)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const value = controlledValue ?? draft
  const hasAttachments = React.Children.count(attachments) > 0
  const change = (next: string) => { if (controlledValue === undefined) setDraft(next); onValueChange?.(next) }
  const send = () => {
    const trimmed = value.trim()
    if ((!trimmed && !hasAttachments) || (maxLength !== undefined && value.length > maxLength)) return
    if (onSubmit) onSubmit(trimmed)
    else onSend?.()
    if (controlledValue === undefined) setDraft("")
  }
  const submit = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); if (status === "streaming" || status === "submitted") { onStop?.(); return }; if (!disabled) send() }
  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    textareaProps?.onKeyDown?.(event)
    const shouldSubmit = submitOnEnter ? event.key === "Enter" && !event.shiftKey : event.key === "Enter" && (event.metaKey || event.ctrlKey)
    if (shouldSubmit && !event.nativeEvent.isComposing) { event.preventDefault(); if (!disabled && status !== "streaming" && status !== "submitted") send() }
  }
  const acceptFiles = (files: FileList | null) => { if (files?.length) onAttach?.(Array.from(files)) }
  const canSend = (Boolean(value.trim()) || hasAttachments) && (maxLength === undefined || value.length <= maxLength)
  React.useLayoutEffect(() => {
    const field = textareaRef.current
    if (!field || (typeof CSS !== "undefined" && CSS.supports?.("field-sizing", "content"))) return
    field.style.height = "auto"
    field.style.height = `${Math.min(field.scrollHeight, 160)}px`
  }, [value])
  return <div className="grid gap-2"><ChatSuggestions suggestions={quickReplies} onSelect={change} />{attachments ? <div data-slot="chat-composer-attachments" className="flex flex-wrap gap-2">{attachments}</div> : null}<form data-slot="chat-composer" data-variant={variant} data-status={status} data-dragging={dragging || undefined} onSubmit={submit} onDragOver={(event) => { if (onAttach && event.dataTransfer.types.includes("Files")) { event.preventDefault(); setDragging(true) } }} onDragLeave={() => setDragging(false)} onDrop={(event) => { if (onAttach) { const files = event.dataTransfer.files; setDragging(false); if (files.length) { event.preventDefault(); acceptFiles(files) } } }} className={cn("flex items-end gap-2 border border-[var(--glass-rim)] p-2 shadow-[var(--glass-chrome-shadow),inset_0_1px_0_var(--glass-chrome-highlight)] backdrop-blur-xl focus-within:ring-2 focus-within:ring-ring/30", variant === "floating" ? "rounded-full bg-[color-mix(in_srgb,var(--glass-tint)_var(--glass-opacity-strong),transparent)]" : "rounded-3xl bg-[color-mix(in_srgb,var(--glass-tint)_var(--glass-opacity),transparent)]", dragging && "border-dashed border-ring", disabled && "opacity-60", className)} {...props}>
    {leading}{onAttach ? <label className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-muted" aria-label="Attach files">＋<input type="file" multiple className="sr-only" onChange={(event) => { acceptFiles(event.target.files); event.currentTarget.value = "" }} /></label> : null}
    <Textarea {...textareaProps} ref={textareaRef} value={value} onChange={(event) => { change(event.target.value); textareaProps?.onChange?.(event) }} onPaste={(event) => { if (event.clipboardData.files.length) { event.preventDefault(); acceptFiles(event.clipboardData.files) }; textareaProps?.onPaste?.(event) }} onKeyDown={onKeyDown} disabled={disabled} placeholder={placeholder} rows={1} maxLength={maxLength} aria-invalid={maxLength !== undefined && value.length > maxLength || undefined} className={cn("max-h-40 min-h-10 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0", textareaProps?.className)} />
    {maxLength !== undefined && value.length >= maxLength * 0.8 ? <span aria-live="polite" className={cn("pb-2 text-[10px] tabular-nums", value.length > maxLength && "text-destructive")}>{value.length}/{maxLength}</span> : null}{trailing}
    {status === "streaming" || status === "submitted" ? <Button type="button" size="icon" aria-label="Stop generating" onClick={onStop}>■</Button> : <Button type="submit" size="icon" aria-label="Send message" disabled={disabled || !canSend}>↑</Button>}
  </form></div>
}

function ChatTypingIndicator({ name = "Assistant", label }: { name?: string; label?: string }) {
  const announcement = label ?? `${name} is typing`
  return <div data-slot="chat-typing-indicator" role="status" aria-label={announcement} className="inline-flex items-center gap-1 rounded-full border border-[var(--glass-rim)] bg-[color-mix(in_srgb,var(--glass-tint)_var(--glass-opacity-subtle),transparent)] px-3 py-2"><span className="size-1.5 animate-pulse rounded-full bg-muted-foreground" /><span className="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:150ms]" /><span className="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:300ms]" /></div>
}

function ChatDayDivider({ children, className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="chat-divider" role="separator" className={cn("my-4 flex items-center gap-3 py-2 text-xs font-medium text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border", className)} {...props}>{children}</div>
}

function ChatBubble({ variant, className, children, ...props }: React.ComponentProps<"div"> & { variant?: "user" | "assistant" | "system" | "document" }) {
  const speaker = React.useContext(ChatSpeakerContext)
  const { layout } = React.useContext(ChatContext)
  const appearance = variant ?? (layout === "document" && speaker === "assistant" ? "document" : speaker)
  return <div data-slot="chat-bubble" data-variant={appearance} className={cn("text-sm leading-relaxed", appearance === "system" ? "text-center text-xs text-muted-foreground" : appearance === "document" ? "w-full py-1 text-foreground" : "rounded-3xl border px-4 py-3 shadow-[inset_0_1px_0_rgb(255_255_255/55%)]", appearance === "user" && "border-primary/15 bg-primary/10", appearance === "assistant" && "border-[var(--glass-rim)] bg-[color-mix(in_srgb,var(--glass-tint)_var(--glass-opacity-subtle),transparent)] backdrop-blur-xl", appearance === "user" && "group-data-grouped/chat-message:rounded-tr-lg", appearance === "assistant" && "group-data-grouped/chat-message:rounded-tl-lg", typeof children === "string" && "whitespace-pre-wrap", className)} {...props}>{children}</div>
}

function isSafeLink(href: string) {
  return /^(https?:|mailto:)/i.test(href) || (!/^[a-z][a-z\d+.-]*:/i.test(href) && !href.startsWith("//"))
}

function inlineMarkdown(text: string): React.ReactNode[] {
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g
  return text.split(pattern).map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">{part.slice(1, -1)}</code>
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>
    if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part)
    const linkText = link?.[1] ?? ""
    const href = link?.[2] ?? ""
    if (link && isSafeLink(href)) return <a key={index} href={href} className="text-primary underline underline-offset-2" target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined}>{linkText}</a>
    if (link) return linkText
    return part
  })
}

function isSpecialLine(line: string) {
  return /^(\s*```|#{1,6}\s|>\s?|[-*+]\s|\d+\.\s|\|.*\|\s*$)/.test(line)
}

function ChatCodeBlock({ code, language, wrap = false, className }: { code: string; language?: string; wrap?: boolean; className?: string }) {
  const [copied, setCopied] = React.useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); window.setTimeout(() => setCopied(false), 1400) } catch { setCopied(false) }
  }
  return <div data-slot="chat-code-block" className={cn("my-3 overflow-hidden rounded-2xl border border-[var(--glass-rim)] bg-muted/70", className)}><div className="flex items-center justify-between border-b border-border/60 px-3 py-2 text-xs text-muted-foreground"><span>{language ?? "Code"}</span><button type="button" onClick={copy} className="rounded-md px-2 py-1 hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">{copied ? "Copied" : "Copy"}</button></div><pre className={cn("overflow-x-auto p-4 text-xs leading-relaxed", wrap && "whitespace-pre-wrap break-words")}><code>{code}</code></pre></div>
}

function ChatMarkdown({ content, streaming = false, className }: { content: string; streaming?: boolean; className?: string }) {
  const lines = content.replace(/\r\n?/g, "\n").split("\n")
  const blocks: React.ReactNode[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index] ?? ""
    if (!line.trim()) { index += 1; continue }
    const fence = /^\s*```([\w-]*)/.exec(line)
    if (fence) {
      index += 1; const code: string[] = []
      while (index < lines.length && !/^\s*```/.test(lines[index] ?? "")) { code.push(lines[index] ?? ""); index += 1 }
      if (index < lines.length) index += 1
      blocks.push(<ChatCodeBlock key={blocks.length} code={code.join("\n")} language={fence[1] ?? ""} />)
      continue
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) { const level = (heading[1] ?? "##").length; const headingText = heading[2] ?? ""; const Tag = (level === 1 ? "h1" : level === 2 ? "h2" : level === 3 ? "h3" : "h4") as "h1" | "h2" | "h3" | "h4"; blocks.push(<Tag key={blocks.length} className="my-2 font-semibold">{inlineMarkdown(headingText)}</Tag>); index += 1; continue }
    if (/^>/.test(line)) { const quote: string[] = []; while (index < lines.length && /^>/.test(lines[index] ?? "")) { quote.push((lines[index] ?? "").replace(/^>\s?/, "")); index += 1 }; blocks.push(<blockquote key={blocks.length} className="my-2 border-l-2 border-primary/40 pl-3 text-muted-foreground">{inlineMarkdown(quote.join(" "))}</blockquote>); continue }
    if (/^\s*\|.*\|\s*$/.test(line) && index + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[index + 1] ?? "")) {
      const parseRow = (value: string) => value.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim())
      const headers = parseRow(line); index += 2; const rows: string[][] = []
      while (index < lines.length && /^\s*\|.*\|\s*$/.test(lines[index] ?? "")) { rows.push(parseRow(lines[index] ?? "")); index += 1 }
      blocks.push(<div key={blocks.length} className="my-3 overflow-x-auto rounded-xl border"><table className="w-full text-left text-xs"><thead><tr>{headers.map((cell, col) => <th key={col} className="bg-muted/70 px-3 py-2 font-semibold">{inlineMarkdown(cell)}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex} className="border-t">{headers.map((_, col) => <td key={col} className="px-3 py-2">{inlineMarkdown(row[col] ?? "")}</td>)}</tr>)}</tbody></table></div>); continue
    }
    const listMatch = /^\s*(?:[-*+]\s|\d+\.\s)/.test(line)
    if (listMatch) {
      const items: Array<{ text: string; checked?: boolean }> = []; const ordered = /^\s*\d+\./.test(line)
      while (index < lines.length && /^\s*(?:[-*+]\s|\d+\.\s)/.test(lines[index] ?? "")) { const current = (lines[index] ?? "").replace(/^\s*(?:[-*+]\s|\d+\.\s)/, ""); const task = /^\[([ xX])\]\s+(.*)$/.exec(current); items.push(task ? { text: task[2] ?? "", checked: (task[1] ?? " ").toLowerCase() === "x" } : { text: current }); index += 1 }
      const Tag = ordered ? "ol" : "ul"
      blocks.push(<Tag key={blocks.length} className={cn("my-2 space-y-1 pl-5", ordered ? "list-decimal" : "list-disc")}>{items.map((item, itemIndex) => <li key={itemIndex}>{item.checked === undefined ? null : <input type="checkbox" checked={item.checked} readOnly aria-label={item.checked ? "Complete" : "Incomplete"} className="mr-2 accent-primary" />}{inlineMarkdown(item.text)}</li>)}</Tag>); continue
    }
    const paragraph: string[] = []
    while (index < lines.length && (lines[index] ?? "").trim() && !isSpecialLine(lines[index] ?? "")) { paragraph.push(lines[index] ?? ""); index += 1 }
    if (!paragraph.length) { paragraph.push(lines[index] ?? ""); index += 1 }
    blocks.push(<p key={blocks.length} className="my-2 whitespace-pre-wrap">{inlineMarkdown(paragraph.join(" "))}{streaming && index >= lines.length ? <span className="ml-0.5 inline-block h-4 w-1 animate-pulse rounded-full bg-primary" aria-label="Response generating" /> : null}</p>)
  }
  return <div data-slot="chat-markdown" className={cn("min-w-0", className)}>{blocks}</div>
}

type ChatPart =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string; duration?: string }
  | { type: "tool"; name: string; input?: string; result?: string; status?: "running" | "complete" | "error"; requiresApproval?: boolean }
  | { type: "source"; title: string; url: string }
  | { type: "file"; name: string; detail?: string }
  | { type: "error"; message: string; retry?: boolean }

function ChatParts({ parts, streaming = false, onApprove, onDeny, onRetry, className }: { parts: ChatPart[]; streaming?: boolean; onApprove?: (part: ChatPart & { type: "tool" }) => void; onDeny?: (part: ChatPart & { type: "tool" }) => void; onRetry?: () => void; className?: string }) {
  return <div data-slot="chat-parts" className={cn("grid gap-2", className)}>{parts.map((part, index) => {
    if (part.type === "text") return <ChatMarkdown key={index} content={part.text} streaming={streaming} />
    if (part.type === "reasoning") return <details key={index} className="rounded-xl border border-[var(--glass-rim)] bg-muted/30 px-3 py-2 text-xs"><summary className="cursor-pointer text-muted-foreground">Thought{part.duration ? ` for ${part.duration}` : ""}</summary><p className="mt-2 whitespace-pre-wrap">{part.text}</p></details>
    if (part.type === "tool") return <div key={index} data-slot="chat-tool" className="rounded-2xl border border-[var(--glass-rim)] bg-[color-mix(in_srgb,var(--glass-tint)_var(--glass-opacity-subtle),transparent)] p-3 text-xs"><div className="flex items-center justify-between gap-3"><strong>{part.name}</strong><span className="text-muted-foreground">{part.status ?? "complete"}</span></div>{part.input ? <pre className="mt-2 overflow-x-auto text-muted-foreground">{part.input}</pre> : null}{part.result ? <p className="mt-2">{part.result}</p> : null}{part.requiresApproval ? <div className="mt-3 flex gap-2"><Button size="xs" onClick={() => onApprove?.(part)}>Approve</Button><Button size="xs" variant="outline" onClick={() => onDeny?.(part)}>Deny</Button></div> : null}</div>
    if (part.type === "source") return isSafeLink(part.url) ? <a key={index} href={part.url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-2 truncate rounded-xl border border-[var(--glass-rim)] bg-primary/5 px-3 py-2 text-xs text-primary">↗ {part.title}</a> : <span key={index} className="text-xs text-muted-foreground">{part.title}</span>
    if (part.type === "file") return <div key={index} className="inline-flex max-w-full items-center gap-3 rounded-2xl border border-[var(--glass-rim)] bg-[color-mix(in_srgb,var(--glass-tint)_var(--glass-opacity-subtle),transparent)] px-3 py-2"><span aria-hidden="true">▤</span><span className="min-w-0"><strong className="block truncate text-xs">{part.name}</strong>{part.detail ? <small className="text-muted-foreground">{part.detail}</small> : null}</span></div>
    return <div key={index} role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive"><span>{part.message}</span>{part.retry ? <Button size="xs" variant="outline" onClick={onRetry}>Retry</Button> : null}</div>
  })}</div>
}

function renderParts(parts: ChatPart[], options: Omit<React.ComponentProps<typeof ChatParts>, "parts"> = {}) {
  return <ChatParts parts={parts} {...options} />
}

export { Chat, Chat as ChatThread, ChatMessage, ChatComposer, ChatTypingIndicator, ChatTypingIndicator as ChatTyping, ChatDayDivider, ChatDayDivider as ChatDivider, ChatSuggestions, ChatSuggestion, ChatMeta, ChatBubble, ChatAttachment, ChatMarkdown, ChatCodeBlock, ChatParts, renderParts, type ChatPart }
