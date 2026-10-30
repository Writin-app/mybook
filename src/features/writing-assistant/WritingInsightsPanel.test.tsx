// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createRef, type RefObject } from 'react'
import { Editor as TiptapEditor, type JSONContent } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Editor } from '@tiptap/react'

import { analyzeWriting } from './analysis'
import { buildProseMirrorTextMap, mapTextRangeToDocument } from './proseMirrorTextMap'
import { WritingAssistantPanel, type WritingAssistantPanelHandle } from './WritingInsightsPanel'
import type { WritingAnalysis } from './types'
import type { ProofreadWorkerRequest, ProofreadWorkerResponse } from './proofreadingTypes'

interface AnalysisRequest {
  requestId: number
  text: string
}

interface AnalysisResponse {
  requestId: number
  analysis: WritingAnalysis
}

class FakeProofreadWorker {
  static instances: FakeProofreadWorker[] = []
  onmessage: ((event: MessageEvent<ProofreadWorkerResponse>) => void) | null = null
  onerror: (() => void) | null = null
  onmessageerror: (() => void) | null = null
  requests: ProofreadWorkerRequest[] = []
  terminated = false

  constructor() { FakeProofreadWorker.instances.push(this) }
  postMessage(request: ProofreadWorkerRequest) { this.requests.push(request) }
  terminate() { this.terminated = true }
  respond(data: ProofreadWorkerResponse) { this.onmessage?.({ data } as MessageEvent<ProofreadWorkerResponse>) }
  fail() { this.onerror?.() }
}

class FakeAnalysisWorker {
  static instances: FakeAnalysisWorker[] = []
  onmessage: ((event: MessageEvent<AnalysisResponse>) => void) | null = null
  onerror: (() => void) | null = null
  onmessageerror: (() => void) | null = null
  request: AnalysisRequest | null = null
  terminated = false

  constructor() {
    FakeAnalysisWorker.instances.push(this)
  }

  postMessage(request: AnalysisRequest) {
    this.request = request
  }

  terminate() {
    this.terminated = true
  }

  respond(analysisOverride?: WritingAnalysis, requestIdOverride?: number) {
    if (!this.request) throw new Error('Worker request was not sent')
    this.onmessage?.({
      data: {
        requestId: requestIdOverride ?? this.request.requestId,
        analysis: analysisOverride ?? analyzeWriting(this.request.text),
      },
    } as MessageEvent<AnalysisResponse>)
  }

  fail() {
    this.onerror?.()
  }
}

const mountedEditors: Array<{ editor: TiptapEditor; element: HTMLDivElement }> = []
let previousDocumentLanguage = ''

function createMountedEditor(content: JSONContent) {
  const element = document.createElement('div')
  document.body.appendChild(element)
  const editor = new TiptapEditor({ element, extensions: [StarterKit], content })
  mountedEditors.push({ editor, element })
  return editor
}

function createEditor(getText: () => string) {
  return {
    getText: vi.fn(getText),
    isDestroyed: false,
    on: vi.fn(),
    off: vi.fn(),
    state: { doc: { toJSON: vi.fn(() => ({ type: 'doc', content: [] })) } },
    view: { dispatch: vi.fn() },
  } as unknown as Editor
}

function openPanel(ref: RefObject<WritingAssistantPanelHandle | null>) {
  act(() => ref.current?.open())
}

function renderWritingAssistantPanel(options: {
  ref: RefObject<WritingAssistantPanelHandle | null>
  editor: Editor
  fileId: string
  isMobile?: boolean
  writingLanguage?: string
  onWritingLanguageChange?: (preferenceId: string) => Promise<void>
}) {
  const writingLanguage = Object.prototype.hasOwnProperty.call(options, 'writingLanguage')
    ? options.writingLanguage
    : 'en-IN'
  return render(
    <WritingAssistantPanel
      ref={options.ref}
      editor={options.editor}
      fileId={options.fileId}
      isMobile={options.isMobile ?? false}
      writingLanguage={writingLanguage}
      onWritingLanguageChange={options.onWritingLanguageChange ?? vi.fn(async () => undefined)}
    />,
  )
}

describe('WritingAssistantPanel', () => {
  beforeEach(() => {
    FakeAnalysisWorker.instances = []
    FakeProofreadWorker.instances = []
    previousDocumentLanguage = document.documentElement.lang
    document.documentElement.lang = 'en'
    vi.stubGlobal('Worker', class {
      constructor(url: URL | string) {
        return String(url).includes('proofreading.worker') ? new FakeProofreadWorker() : new FakeAnalysisWorker()
      }
    })
  })

  afterEach(() => {
    cleanup()
    for (const mounted of mountedEditors.splice(0)) {
      mounted.editor.destroy()
      mounted.element.remove()
    }
    document.documentElement.lang = previousDocumentLanguage
    vi.unstubAllGlobals()
  })

  it('opens, displays active-document statistics and exact informational suggestion ranges, then closes', async () => {
    const editor = createEditor(() => 'the the')
    const initialDocument = editor.state.doc.toJSON()
    const ref = createRef<WritingAssistantPanelHandle>()
    renderWritingAssistantPanel({ ref, editor, fileId: "doc-a" })

    expect(editor.getText).not.toHaveBeenCalled()
    openPanel(ref)
    expect(editor.getText).toHaveBeenCalledTimes(1)
    expect(FakeAnalysisWorker.instances[0]?.request?.text).toBe('the the')
    expect(screen.getByRole('status')).toHaveTextContent('Analyzing this document')

    act(() => FakeAnalysisWorker.instances[0]?.respond())
    expect(await screen.findByText('Repeated words')).toBeInTheDocument()
    expect(screen.getByText('Words').nextElementSibling).toHaveTextContent('2')
    const repeatedWord = screen.getByText('the').closest('li')
    expect(repeatedWord).toHaveAttribute('data-start', '4')
    expect(repeatedWord).toHaveAttribute('data-end', '7')
    expect(editor.getText).toHaveBeenCalledTimes(1)
    expect(editor.state.doc.toJSON()).toEqual(initialDocument)
    expect(editor.view.dispatch).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByText('Repeated words')).not.toBeInTheDocument())
  })

  it('switches Overview and Actions without restarting analysis or changing the document', async () => {
    const editor = createEditor(() => 'the the document')
    const initialDocument = editor.state.doc.toJSON()
    const ref = createRef<WritingAssistantPanelHandle>()
    renderWritingAssistantPanel({ ref, editor, fileId: 'doc-tabs' })

    openPanel(ref)
    const worker = FakeAnalysisWorker.instances[0]!
    expect(FakeAnalysisWorker.instances).toHaveLength(1)
    expect(screen.getByRole('heading', { name: 'Writing Assistant' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Actions' }))
    expect(screen.getByRole('heading', { name: 'Proofread' })).toBeInTheDocument()
    expect(worker.terminated).toBe(false)
    expect(FakeAnalysisWorker.instances).toHaveLength(1)
    expect(editor.getText).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }))
    act(() => worker.respond())
    expect(await screen.findByText('Repeated words')).toBeInTheDocument()
    expect(FakeAnalysisWorker.instances).toHaveLength(1)
    expect(editor.getText).toHaveBeenCalledTimes(1)
    expect(editor.state.doc.toJSON()).toEqual(initialDocument)
    expect(editor.view.dispatch).not.toHaveBeenCalled()
  })

  it('reopens on Overview with one active worker and keeps Actions usable in the mobile sheet', async () => {
    const editor = createEditor(() => 'the the document')
    const ref = createRef<WritingAssistantPanelHandle>()
    renderWritingAssistantPanel({ ref, editor, fileId: 'doc-reopen', isMobile: true })

    openPanel(ref)
    const firstWorker = FakeAnalysisWorker.instances[0]!
    fireEvent.click(screen.getByRole('tab', { name: 'Actions' }))
    expect(document.querySelector('[data-slot="sheet-content"][data-side="bottom"]')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(firstWorker.terminated).toBe(true)
    openPanel(ref)

    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true')
    expect(FakeAnalysisWorker.instances).toHaveLength(2)
    expect(FakeAnalysisWorker.instances.filter((worker) => !worker.terminated)).toHaveLength(1)
    expect(FakeAnalysisWorker.instances[1]?.request?.text).toBe('the the document')
    fireEvent.click(screen.getByRole('tab', { name: 'Actions' }))
    expect(screen.getByRole('heading', { name: 'Proofread' })).toBeInTheDocument()
    expect(FakeAnalysisWorker.instances.filter((worker) => !worker.terminated)).toHaveLength(1)
  })

  it('refreshes only on request and analyzes the latest document text', async () => {
    let text = 'A clear draft.'
    const editor = createEditor(() => text)
    const ref = createRef<WritingAssistantPanelHandle>()
    renderWritingAssistantPanel({ ref, editor, fileId: "doc-a" })

    openPanel(ref)
    act(() => FakeAnalysisWorker.instances[0]?.respond())
    expect(await screen.findByText('No writing suggestions were found in this snapshot.')).toBeInTheDocument()

    text = 'very very'
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(editor.getText).toHaveBeenCalledTimes(2)
    expect(FakeAnalysisWorker.instances).toHaveLength(2)
    expect(FakeAnalysisWorker.instances[1]?.request?.text).toBe('very very')
    act(() => FakeAnalysisWorker.instances[1]?.respond())
    expect(await screen.findByText('Repeated words')).toBeInTheDocument()
  })

  it('does not route an unsupported document language through English insights', async () => {
    const ref = createRef<WritingAssistantPanelHandle>()
    renderWritingAssistantPanel({ ref, editor: createEditor(() => 'नमस्ते'), fileId: 'doc-hi', writingLanguage: 'hi-IN' })

    openPanel(ref)

    expect(await screen.findByRole('status')).toHaveTextContent('Hindi analysis is not available yet')
    expect(FakeAnalysisWorker.instances).toHaveLength(0)
  })

  it('keeps missing language unresolved and does not use the application language as a fallback', async () => {
    const editor = createEditor(() => 'English text')
    const ref = createRef<WritingAssistantPanelHandle>()
    renderWritingAssistantPanel({ ref, editor, fileId: 'doc-auto', writingLanguage: undefined })

    openPanel(ref)

    expect(screen.getByRole('combobox', { name: 'Document writing language' })).toHaveValue('automatic')
    expect(await screen.findByRole('status')).toHaveTextContent('Automatic detection is not available yet')
    expect(editor.getText).not.toHaveBeenCalled()
    expect(FakeAnalysisWorker.instances).toHaveLength(0)
    expect(document.documentElement.lang).toBe('en')
  })

  it('persists manual selection and requires an explicit refresh for a supported English profile', async () => {
    const editor = createEditor(() => 'very very useful')
    const ref = createRef<WritingAssistantPanelHandle>()
    const onWritingLanguageChange = vi.fn(async () => undefined)
    renderWritingAssistantPanel({ ref, editor, fileId: 'doc-manual', writingLanguage: undefined, onWritingLanguageChange })
    openPanel(ref)

    fireEvent.change(screen.getByRole('combobox', { name: 'Document writing language' }), { target: { value: 'en-GB' } })
    await waitFor(() => expect(onWritingLanguageChange).toHaveBeenCalledWith('en-GB'))

    expect(screen.getByRole('combobox', { name: 'Document writing language' })).toHaveValue('en-GB')
    expect(screen.getByText('Manual')).toBeInTheDocument()
    expect(FakeAnalysisWorker.instances).toHaveLength(0)
    expect(editor.getText).not.toHaveBeenCalled()
    expect(document.documentElement.lang).toBe('en')

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(editor.getText).toHaveBeenCalledTimes(1)
    expect(FakeAnalysisWorker.instances[0]?.request?.text).toBe('very very useful')
    act(() => FakeAnalysisWorker.instances[0]?.respond())
    expect(await screen.findByText('Repeated words')).toBeInTheDocument()
  })

  it.each([
    ['hi-IN', 'Hindi'],
    ['hi-Latn', 'Hindi (Roman)'],
    ['mixed-hi-en', 'Hinglish'],
  ])('does not run the English engine for %s', async (writingLanguage, displayName) => {
    const editor = createEditor(() => 'document text')
    const ref = createRef<WritingAssistantPanelHandle>()
    renderWritingAssistantPanel({ ref, editor, fileId: `doc-${writingLanguage}`, writingLanguage })

    openPanel(ref)

    expect(await screen.findByRole('status')).toHaveTextContent(`${displayName} analysis is not available yet`)
    expect(editor.getText).not.toHaveBeenCalled()
    expect(FakeAnalysisWorker.instances).toHaveLength(0)
  })

  it('normalizes an unknown stored language to unresolved Automatic', async () => {
    const editor = createEditor(() => 'English text')
    const ref = createRef<WritingAssistantPanelHandle>()
    renderWritingAssistantPanel({ ref, editor, fileId: 'doc-unknown', writingLanguage: 'en-AU' })

    openPanel(ref)
    expect(screen.getByRole('combobox', { name: 'Document writing language' })).toHaveValue('automatic')
    expect(await screen.findByRole('status')).toHaveTextContent('Automatic detection is not available yet')
    expect(FakeAnalysisWorker.instances).toHaveLength(0)
  })

  it('clears an analysis snapshot when the document writing language changes', async () => {
    const editor = createEditor(() => 'very very useful')
    const ref = createRef<WritingAssistantPanelHandle>()
    const onWritingLanguageChange = vi.fn(async () => undefined)
    const view = renderWritingAssistantPanel({ ref, editor, fileId: 'doc-language-change', writingLanguage: 'en-IN', onWritingLanguageChange })

    openPanel(ref)
    act(() => FakeAnalysisWorker.instances[0]?.respond())
    expect(await screen.findByText('Repeated words')).toBeInTheDocument()

    view.rerender(
      <WritingAssistantPanel
        ref={ref}
        editor={editor}
        fileId="doc-language-change"
        isMobile={false}
        writingLanguage="hi-IN"
        onWritingLanguageChange={onWritingLanguageChange}
      />,
    )

    await waitFor(() => expect(screen.queryByText('Repeated words')).not.toBeInTheDocument())
    expect(screen.getByRole('combobox', { name: 'Document writing language' })).toHaveValue('hi-IN')
    expect(screen.getByText(/Hindi analysis is not available yet/)).toBeInTheDocument()
    expect(FakeAnalysisWorker.instances).toHaveLength(1)
  })

  it('terminates the active worker when the panel closes and ignores its late response', async () => {
    const editor = createEditor(() => 'late result late result')
    const ref = createRef<WritingAssistantPanelHandle>()
    renderWritingAssistantPanel({ ref, editor, fileId: "doc-a" })

    openPanel(ref)
    const worker = FakeAnalysisWorker.instances[0]!
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(worker.terminated).toBe(true)

    act(() => worker.respond())
    expect(screen.queryByText('Repeated words')).not.toBeInTheDocument()
  })

  it('keeps only the latest repeated refresh request and ignores stale responses', async () => {
    let text = 'stale stale'
    const editor = createEditor(() => text)
    const ref = createRef<WritingAssistantPanelHandle>()
    renderWritingAssistantPanel({ ref, editor, fileId: "doc-a" })

    openPanel(ref)
    const staleWorker = FakeAnalysisWorker.instances[0]!
    expect(FakeAnalysisWorker.instances.filter((worker) => !worker.terminated)).toHaveLength(1)

    text = 'current snapshot'
    act(() => staleWorker.respond())
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    const latestWorker = FakeAnalysisWorker.instances[1]!
    expect(staleWorker.terminated).toBe(true)
    expect(FakeAnalysisWorker.instances.filter((worker) => !worker.terminated)).toHaveLength(1)

    act(() => staleWorker.respond())
    expect(screen.queryByText('Repeated words')).not.toBeInTheDocument()
    act(() => latestWorker.respond())
    expect(await screen.findByText('No writing suggestions were found in this snapshot.')).toBeInTheDocument()
    expect(FakeAnalysisWorker.instances.filter((worker) => !worker.terminated)).toHaveLength(0)
  })

  it('shows an error after worker initialization failure and recovers on refresh', async () => {
    const editor = createEditor(() => 'ready after retry')
    const ref = createRef<WritingAssistantPanelHandle>()
    renderWritingAssistantPanel({ ref, editor, fileId: "doc-a" })
    vi.stubGlobal('Worker', class { constructor() { throw new Error('worker unavailable') } })

    openPanel(ref)
    expect(await screen.findByRole('alert')).toHaveTextContent('Analysis could not be completed')

    vi.stubGlobal('Worker', FakeAnalysisWorker)
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    act(() => FakeAnalysisWorker.instances[0]?.respond())
    expect(await screen.findByText('No writing suggestions were found in this snapshot.')).toBeInTheDocument()
  })

  it('shows an error after worker execution failure and recovers on refresh', async () => {
    const editor = createEditor(() => 'retry retry')
    const ref = createRef<WritingAssistantPanelHandle>()
    renderWritingAssistantPanel({ ref, editor, fileId: "doc-a" })

    openPanel(ref)
    const failedWorker = FakeAnalysisWorker.instances[0]!
    act(() => failedWorker.fail())
    expect(await screen.findByRole('alert')).toHaveTextContent('Analysis could not be completed')
    expect(failedWorker.terminated).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    act(() => FakeAnalysisWorker.instances[1]?.respond())
    expect(await screen.findByText('Repeated words')).toBeInTheDocument()
  })

  it('terminates the worker and reports an error for a mismatched response ID', async () => {
    const ref = createRef<WritingAssistantPanelHandle>()
    renderWritingAssistantPanel({ ref, editor: createEditor(() => "snapshot"), fileId: "doc-a" })

    openPanel(ref)
    const worker = FakeAnalysisWorker.instances[0]!
    act(() => worker.respond(undefined, worker.request!.requestId + 1))

    expect(await screen.findByRole('alert')).toHaveTextContent('Analysis could not be completed')
    expect(worker.terminated).toBe(true)
  })

  it('terminates active analysis when the panel unmounts', () => {
    const editor = createEditor(() => 'in progress')
    const ref = createRef<WritingAssistantPanelHandle>()
    const view = renderWritingAssistantPanel({ ref, editor, fileId: "doc-a" })

    openPanel(ref)
    const worker = FakeAnalysisWorker.instances[0]!
    view.unmount()

    expect(worker.terminated).toBe(true)
  })

  it('renders repeated phrases, filler phrases, and long sentences with their source offsets', async () => {
    const longSentence = [...Array(31).keys()].map((index) => `word${index + 1}`).join(' ')
    const text = `the the. in order to in order to. I think this is really very useful. ${longSentence}`
    const editor = createEditor(() => text)
    const ref = createRef<WritingAssistantPanelHandle>()
    renderWritingAssistantPanel({ ref, editor, fileId: "doc-a" })

    openPanel(ref)
    act(() => FakeAnalysisWorker.instances[0]?.respond())

    expect(await screen.findByText('Repeated words')).toBeInTheDocument()
    expect(screen.getByText('Repeated phrases')).toBeInTheDocument()
    expect(screen.getByText('Filler words and phrases')).toBeInTheDocument()
    expect(screen.getByText('Long sentences')).toBeInTheDocument()

    const repeatedPhrase = screen.getByText('in order to').closest('li')
    const phraseStart = text.lastIndexOf('in order to')
    expect(repeatedPhrase).toHaveAttribute('data-start', String(phraseStart))
    expect(repeatedPhrase).toHaveAttribute('data-end', String(phraseStart + 'in order to'.length))
    const fillerPhrase = screen.getByText('I think').closest('li')
    const fillerStart = text.indexOf('I think')
    expect(fillerPhrase).toHaveAttribute('data-start', String(fillerStart))
    expect(fillerPhrase).toHaveAttribute('data-end', String(fillerStart + 'I think'.length))
    const longSentenceItem = screen.getByText(longSentence).closest('li')
    expect(longSentenceItem).toHaveAttribute('data-start', String(text.indexOf(longSentence)))
    expect(longSentenceItem).toHaveAttribute('data-end', String(text.length))
  })

  it('clears and cancels stale analysis when the active document changes', async () => {
    const editorA = createEditor(() => 'old document')
    const editorB = createEditor(() => 'new new')
    const ref = createRef<WritingAssistantPanelHandle>()
    const view = renderWritingAssistantPanel({ ref, editor: editorA, fileId: "doc-a" })

    openPanel(ref)
    const oldWorker = FakeAnalysisWorker.instances[0]!
    view.rerender(<WritingAssistantPanel ref={ref} editor={editorB} fileId="doc-b" isMobile={false} writingLanguage="en-IN" onWritingLanguageChange={vi.fn(async () => undefined)} />)
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Writing Assistant' })).not.toBeInTheDocument())
    expect(oldWorker.terminated).toBe(true)

    openPanel(ref)
    const newWorker = FakeAnalysisWorker.instances[1]!
    expect(newWorker.request?.text).toBe('new new')
    act(() => {
      oldWorker.respond()
      newWorker.respond()
    })
    expect(await screen.findByText('Repeated words')).toBeInTheDocument()
    expect(screen.queryByText('old document')).not.toBeInTheDocument()
  })

  it('shows an empty-document state and adapts the sheet side for mobile', async () => {
    const editor = createEditor(() => '')
    const ref = createRef<WritingAssistantPanelHandle>()
    renderWritingAssistantPanel({ ref, editor, fileId: "empty-doc", isMobile: true })

    openPanel(ref)
    expect(document.querySelector('[data-slot="sheet-content"][data-side="bottom"]')).toBeInTheDocument()
    act(() => FakeAnalysisWorker.instances[0]?.respond())

    expect(await screen.findByText('Start writing to see statistics and suggestions.')).toBeInTheDocument()
    expect(screen.getByText('Words').nextElementSibling).toHaveTextContent('0')
  })

  it('analyzes large documents in the worker and adapts the sheet side for desktop', async () => {
    const text = 'clear words stay steady. '.repeat(4000)
    const editor = createEditor(() => text)
    const ref = createRef<WritingAssistantPanelHandle>()
    renderWritingAssistantPanel({ ref, editor, fileId: "large-doc" })

    openPanel(ref)
    expect(document.querySelector('[data-slot="sheet-content"][data-side="right"]')).toBeInTheDocument()
    expect(FakeAnalysisWorker.instances[0]?.request?.text).toHaveLength(100000)
    act(() => FakeAnalysisWorker.instances[0]?.respond())

    expect(await screen.findByText('No writing suggestions were found in this snapshot.')).toBeInTheDocument()
    expect(screen.getByText('Words').nextElementSibling).toHaveTextContent('16000')
  })

  it('navigates to the exact repeated occurrence without changing document content', async () => {
    const editor = createMountedEditor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '😀 very very calm, very very' }] }],
    })
    const originalDocument = editor.getJSON()
    const updates = vi.fn()
    editor.on('update', updates)
    const ref = createRef<WritingAssistantPanelHandle>()
    renderWritingAssistantPanel({ ref, editor, fileId: "doc-a" })
    openPanel(ref)
    act(() => FakeAnalysisWorker.instances[0]?.respond())

    const suggestions = await screen.findAllByRole('button', { name: /Navigate to suggestion/ })
    const target = analyzeWriting(editor.getText()).repeatedWords[1]!
    const map = buildProseMirrorTextMap(editor.state.doc)
    const expectedRange = mapTextRangeToDocument(map, target.start, target.end)!
    const dispatch = vi.spyOn(editor.view, 'dispatch')
    const focus = vi.spyOn(editor.view, 'focus')
    fireEvent.click(suggestions[1]!)

    expect(editor.state.selection.from).toBe(expectedRange.from)
    expect(editor.state.selection.to).toBe(expectedRange.to)
    expect(editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to)).toBe(target.text)
    expect(dispatch.mock.calls.some(([transaction]) => transaction.scrolledIntoView)).toBe(true)
    expect(dispatch.mock.calls.every(([transaction]) => !transaction.docChanged)).toBe(true)
    expect(editor.getJSON()).toEqual(originalDocument)
    expect(updates).not.toHaveBeenCalled()
    await waitFor(() => expect(focus).toHaveBeenCalled())
  })

  it('rejects stale suggestions after an editor document change', async () => {
    const editor = createMountedEditor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'same same' }] }],
    })
    const ref = createRef<WritingAssistantPanelHandle>()
    renderWritingAssistantPanel({ ref, editor, fileId: "doc-a" })
    openPanel(ref)
    act(() => FakeAnalysisWorker.instances[0]?.respond())
    const suggestion = await screen.findByRole('button', { name: /Navigate to suggestion/ })

    act(() => editor.commands.insertContent(' changed'))
    const documentAfterEdit = editor.getJSON()
    const selectionAfterEdit = { from: editor.state.selection.from, to: editor.state.selection.to }
    fireEvent.click(suggestion)

    expect(await screen.findByRole('status')).toHaveTextContent('Document changed. Refresh Writing Assistant before navigating.')
    expect(editor.getJSON()).toEqual(documentAfterEdit)
    expect(editor.state.selection.from).toBe(selectionAfterEdit.from)
    expect(editor.state.selection.to).toBe(selectionAfterEdit.to)
  })

  it('shows a safe fallback for invalid analyzer offsets', async () => {
    const editor = createMountedEditor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'simple text' }] }],
    })
    const ref = createRef<WritingAssistantPanelHandle>()
    renderWritingAssistantPanel({ ref, editor, fileId: "doc-a" })
    openPanel(ref)
    const invalidAnalysis = analyzeWriting(editor.getText())
    invalidAnalysis.repeatedWords = [{ text: 'text', start: -1, end: 4 }]
    act(() => FakeAnalysisWorker.instances[0]?.respond(invalidAnalysis))
    const suggestion = await screen.findByRole('button', { name: /Navigate to suggestion/ })
    const initialDocument = editor.getJSON()
    const initialSelection = { from: editor.state.selection.from, to: editor.state.selection.to }

    fireEvent.click(suggestion)

    expect(await screen.findByRole('status')).toHaveTextContent('This suggestion could not be mapped safely. No text was selected.')
    expect(editor.getJSON()).toEqual(initialDocument)
    expect(editor.state.selection.from).toBe(initialSelection.from)
    expect(editor.state.selection.to).toBe(initialSelection.to)
  })

  it('loads the proofread Worker only after an explicit action and accepts one UTF-16 correction with undo', async () => {
    const editor = createMountedEditor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '😀 This are wrong.' }] }],
    })
    const original = editor.getJSON()
    const updates = vi.fn()
    const transactions = vi.fn()
    editor.on('update', updates)
    editor.on('transaction', transactions)
    const ref = createRef<WritingAssistantPanelHandle>()
    renderWritingAssistantPanel({ ref, editor, fileId: 'proofread-doc', writingLanguage: 'en-GB' })
    openPanel(ref)
    fireEvent.click(screen.getByRole('tab', { name: 'Actions' }))

    expect(FakeProofreadWorker.instances).toHaveLength(0)
    fireEvent.click(screen.getByRole('radio', { name: 'Entire document' }))
    fireEvent.click(screen.getByRole('button', { name: 'Run Proofread' }))
    const worker = FakeProofreadWorker.instances[0]!
    const analyzeRequest = worker.requests[0]!
    expect(analyzeRequest.type).toBe('analyze')
    if (analyzeRequest.type !== 'analyze') throw new Error('Expected analyze request')
    expect(analyzeRequest.dialect).toBe('en-GB')
    expect(analyzeRequest.text).toBe('😀 This are wrong.')
    expect(editor.getJSON()).toEqual(original)
    expect(updates).not.toHaveBeenCalled()
    expect(transactions).not.toHaveBeenCalled()

    act(() => worker.respond({ type: 'ready', requestId: analyzeRequest.requestId, sessionId: analyzeRequest.sessionId, initMs: 90 }))
    act(() => worker.respond({
      type: 'findings', requestId: analyzeRequest.requestId, sessionId: analyzeRequest.sessionId, analysisMs: 12,
      findings: [{ id: '0', kind: 'Agreement', category: 'grammar', message: 'Use the matching verb.', text: 'are', start: 8, end: 11 }],
    }))
    fireEvent.click(await screen.findByRole('button', { name: /are/ }))
    const suggestionsRequest = worker.requests.at(-1)!
    expect(suggestionsRequest.type).toBe('suggest')
    if (suggestionsRequest.type !== 'suggest') throw new Error('Expected suggestions request')
    act(() => worker.respond({ type: 'suggestions', requestId: suggestionsRequest.requestId, sessionId: suggestionsRequest.sessionId, findingId: '0', suggestions: ['is'] }))
    expect(await screen.findByText('is')).toBeInTheDocument()
    expect(editor.getJSON()).toEqual(original)
    expect(updates).not.toHaveBeenCalled()
    expect(transactions).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    expect(editor.getText()).toBe('😀 This is wrong.')
    expect(updates).toHaveBeenCalledTimes(1)
    expect(transactions).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status')).toHaveTextContent('Correction applied. Run Proofread again')
    expect(editor.commands.undo()).toBe(true)
    expect(editor.getJSON()).toEqual(original)
  })

  it('does not initialize the English engine for unsupported language profiles', async () => {
    const ref = createRef<WritingAssistantPanelHandle>()
    renderWritingAssistantPanel({ ref, editor: createEditor(() => 'नमस्ते'), fileId: 'proofread-hi', writingLanguage: 'hi-IN' })
    openPanel(ref)
    fireEvent.click(screen.getByRole('tab', { name: 'Actions' }))

    expect(screen.getByRole('status')).toHaveTextContent('Proofread is unavailable for this language')
    expect(FakeProofreadWorker.instances).toHaveLength(0)
  })

  it('cancels a running proofread session when requested', async () => {
    const editor = createMountedEditor({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A short sentence.' }] }] })
    const ref = createRef<WritingAssistantPanelHandle>()
    renderWritingAssistantPanel({ ref, editor, fileId: 'proofread-cancel' })
    openPanel(ref)
    fireEvent.click(screen.getByRole('tab', { name: 'Actions' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Entire document' }))
    fireEvent.click(screen.getByRole('button', { name: 'Run Proofread' }))
    const worker = FakeProofreadWorker.instances[0]!

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(worker.terminated).toBe(true)
    expect(screen.getByRole('status')).toHaveTextContent('Proofread cancelled')
    expect(editor.getText()).toBe('A short sentence.')
  })

  it('terminates its Worker when the panel closes during analysis', async () => {
    const editor = createMountedEditor({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A short sentence.' }] }] })
    const ref = createRef<WritingAssistantPanelHandle>()
    renderWritingAssistantPanel({ ref, editor, fileId: 'proofread-close' })
    openPanel(ref)
    fireEvent.click(screen.getByRole('tab', { name: 'Actions' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Entire document' }))
    fireEvent.click(screen.getByRole('button', { name: 'Run Proofread' }))
    const worker = FakeProofreadWorker.instances[0]!

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    await waitFor(() => expect(worker.terminated).toBe(true))
  })

  it('shows recoverable worker startup and execution errors', async () => {
    const editor = createMountedEditor({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A short sentence.' }] }] })
    const ref = createRef<WritingAssistantPanelHandle>()
    renderWritingAssistantPanel({ ref, editor, fileId: 'proofread-error' })
    openPanel(ref)
    fireEvent.click(screen.getByRole('tab', { name: 'Actions' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Entire document' }))
    vi.stubGlobal('Worker', class { constructor() { throw new Error('worker blocked') } })
    fireEvent.click(screen.getByRole('button', { name: 'Run Proofread' }))
    expect(screen.getByRole('status')).toHaveTextContent('Could not start Proofread')

    vi.stubGlobal('Worker', class { constructor() { return new FakeProofreadWorker() } })
    fireEvent.click(screen.getByRole('button', { name: 'Run Proofread' }))
    const worker = FakeProofreadWorker.instances[0]!
    act(() => worker.fail())
    expect(screen.getByRole('status')).toHaveTextContent('stopped unexpectedly')
    expect(worker.terminated).toBe(true)
  })

  it('terminates the prior session when Proofread is explicitly run again', async () => {
    const editor = createMountedEditor({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A short sentence.' }] }] })
    const ref = createRef<WritingAssistantPanelHandle>()
    renderWritingAssistantPanel({ ref, editor, fileId: 'proofread-repeat' })
    openPanel(ref)
    fireEvent.click(screen.getByRole('tab', { name: 'Actions' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Entire document' }))
    fireEvent.click(screen.getByRole('button', { name: 'Run Proofread' }))
    const firstWorker = FakeProofreadWorker.instances[0]!

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Run Proofread' }))

    expect(firstWorker.terminated).toBe(true)
    expect(FakeProofreadWorker.instances).toHaveLength(2)
    expect(FakeProofreadWorker.instances.filter((worker) => !worker.terminated)).toHaveLength(1)
  })

  it('terminates the session and gates Proofread when the active language changes', async () => {
    const editor = createMountedEditor({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A short sentence.' }] }] })
    const ref = createRef<WritingAssistantPanelHandle>()
    const view = renderWritingAssistantPanel({ ref, editor, fileId: 'proofread-language', writingLanguage: 'en-IN' })
    openPanel(ref)
    fireEvent.click(screen.getByRole('tab', { name: 'Actions' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Entire document' }))
    fireEvent.click(screen.getByRole('button', { name: 'Run Proofread' }))
    const worker = FakeProofreadWorker.instances[0]!

    view.rerender(
      <WritingAssistantPanel
        ref={ref}
        editor={editor}
        fileId="proofread-language"
        isMobile={false}
        writingLanguage="hi-IN"
        onWritingLanguageChange={vi.fn(async () => undefined)}
      />,
    )

    await waitFor(() => expect(worker.terminated).toBe(true))
    expect(screen.getByRole('status')).toHaveTextContent('Proofread is unavailable for this language')
  })

  it('surfaces Harper initialization errors and permits a later retry', async () => {
    const editor = createMountedEditor({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A short sentence.' }] }] })
    const ref = createRef<WritingAssistantPanelHandle>()
    renderWritingAssistantPanel({ ref, editor, fileId: 'proofread-init-error' })
    openPanel(ref)
    fireEvent.click(screen.getByRole('tab', { name: 'Actions' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Entire document' }))
    fireEvent.click(screen.getByRole('button', { name: 'Run Proofread' }))
    const worker = FakeProofreadWorker.instances[0]!
    const request = worker.requests[0]!
    if (!request || request.type !== 'analyze') throw new Error('Expected analyze request')
    act(() => worker.respond({ type: 'error', requestId: request.requestId, sessionId: request.sessionId, message: 'WASM initialization failed.' }))

    expect(worker.terminated).toBe(true)
    expect(screen.getByRole('status')).toHaveTextContent('WASM initialization failed')
    fireEvent.click(screen.getByRole('button', { name: 'Run Proofread' }))
    expect(FakeProofreadWorker.instances).toHaveLength(2)
    expect(FakeProofreadWorker.instances[1]?.terminated).toBe(false)
  })

  it('invalidates an in-flight result when the document changes', async () => {
    const editor = createMountedEditor({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A short sentence.' }] }] })
    const ref = createRef<WritingAssistantPanelHandle>()
    renderWritingAssistantPanel({ ref, editor, fileId: 'proofread-stale' })
    openPanel(ref)
    fireEvent.click(screen.getByRole('tab', { name: 'Actions' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Entire document' }))
    fireEvent.click(screen.getByRole('button', { name: 'Run Proofread' }))
    const worker = FakeProofreadWorker.instances[0]!

    act(() => editor.commands.insertContent(' changed'))

    expect(worker.terminated).toBe(true)
    expect(screen.getByRole('status')).toHaveTextContent('document or selection changed')
    const request = worker.requests[0]
    if (!request || request.type !== 'analyze') throw new Error('Expected analyze request')
    act(() => worker.respond({ type: 'findings', requestId: request.requestId, sessionId: request.sessionId, analysisMs: 1, findings: [
      { id: '0', kind: 'Spelling', category: 'spelling', message: 'Old snapshot.', text: 'short', start: 2, end: 7 },
    ] }))
    expect(screen.queryByRole('heading', { name: /Spelling/ })).not.toBeInTheDocument()
    expect(editor.getText()).toBe(' changedA short sentence.')
  })

  it('requests suggestions only after opening a finding and Ignore leaves the editor unchanged', async () => {
    const editor = createMountedEditor({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A clear sentence.' }] }] })
    const original = editor.getJSON()
    const transactions = vi.fn()
    editor.on('transaction', transactions)
    const ref = createRef<WritingAssistantPanelHandle>()
    renderWritingAssistantPanel({ ref, editor, fileId: 'proofread-ignore' })
    openPanel(ref)
    fireEvent.click(screen.getByRole('tab', { name: 'Actions' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Entire document' }))
    fireEvent.click(screen.getByRole('button', { name: 'Run Proofread' }))
    const worker = FakeProofreadWorker.instances[0]!
    const request = worker.requests[0]!
    if (request.type !== 'analyze') throw new Error('Expected analyze request')
    act(() => worker.respond({ type: 'ready', requestId: request.requestId, sessionId: request.sessionId, initMs: 10 }))
    act(() => worker.respond({ type: 'findings', requestId: request.requestId, sessionId: request.sessionId, analysisMs: 1, findings: [
      { id: '0', kind: 'Spelling', category: 'spelling', message: 'Review spelling.', text: 'clear', start: 2, end: 7 },
    ] }))
    expect(worker.requests).toHaveLength(1)
    fireEvent.click(await screen.findByRole('button', { name: /clear/ }))
    const suggestionRequest = worker.requests.at(-1)!
    expect(suggestionRequest.type).toBe('suggest')
    if (suggestionRequest.type !== 'suggest') throw new Error('Expected suggestions request')
    act(() => worker.respond({ type: 'suggestions', requestId: suggestionRequest.requestId, sessionId: suggestionRequest.sessionId, findingId: '0', suggestions: ['clean'] }))
    expect(await screen.findByText('clean')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ignore' }))

    expect(editor.getJSON()).toEqual(original)
    expect(transactions).not.toHaveBeenCalled()
    expect(worker.terminated).toBe(false)
  })

  it('analyzes only the selected text and maps its result back to the original document range', async () => {
    const editor = createMountedEditor({
      type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '😀 Prefix wrong word.' }] }],
    })
    editor.commands.setTextSelection({ from: 11, to: 16 })
    const ref = createRef<WritingAssistantPanelHandle>()
    renderWritingAssistantPanel({ ref, editor, fileId: 'proofread-selected' })
    openPanel(ref)
    fireEvent.click(screen.getByRole('tab', { name: 'Actions' }))
    fireEvent.click(screen.getByRole('button', { name: 'Run Proofread' }))
    const worker = FakeProofreadWorker.instances[0]!
    const analyzeRequest = worker.requests[0]!
    if (analyzeRequest.type !== 'analyze') throw new Error('Expected analyze request')
    expect(analyzeRequest.text).toBe('wrong')

    act(() => worker.respond({ type: 'ready', requestId: analyzeRequest.requestId, sessionId: analyzeRequest.sessionId, initMs: 20 }))
    act(() => worker.respond({ type: 'findings', requestId: analyzeRequest.requestId, sessionId: analyzeRequest.sessionId, analysisMs: 2, findings: [
      { id: '0', kind: 'Spelling', category: 'spelling', message: 'Check this word.', text: 'wrong', start: 0, end: 5 },
    ] }))
    const finding = await screen.findByRole('button', { name: /wrong/ })
    fireEvent.click(finding)
    const suggestionsRequest = worker.requests.at(-1)!
    if (suggestionsRequest.type !== 'suggest') throw new Error('Expected suggestions request')
    act(() => worker.respond({ type: 'suggestions', requestId: suggestionsRequest.requestId, sessionId: suggestionsRequest.sessionId, findingId: '0', suggestions: ['right'] }))
    fireEvent.click(await screen.findByRole('button', { name: 'Accept' }))
    expect(editor.getText()).toBe('😀 Prefix right word.')
  })
})
