// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import StarterKit from '@tiptap/starter-kit'
import { Editor } from '@tiptap/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { GenerativeActionsSection } from './GenerativeActionsSection'
import { prepareContentForInsertion } from './generativeInsertion'
import { createMockTransformationEngine } from './mockTransformationEngine'
import { SessionCredentialStore } from './sessionCredentialStore'

function createRealEditor(content = '<p>The meeting was postponed by team lead.</p>') {
  return new Editor({
    element: document.createElement('div'),
    extensions: [StarterKit],
    content,
  })
}

describe('GenerativeActionsSection', () => {
  let editor: Editor
  let credentialStore: SessionCredentialStore

  beforeEach(() => {
    editor = createRealEditor()
    credentialStore = new SessionCredentialStore()
    // Configure default provider (groq) with valid session key and disclosure
    credentialStore.setCredential('groq', { apiKey: 'gsk_session_secret_key' })
    credentialStore.setDisclosureAcknowledged('groq', true)
  })

  afterEach(() => {
    cleanup()
    editor.destroy()
  })

  it('renders generative writing header, action picker, and scope selector', () => {
    render(
      <GenerativeActionsSection
        editor={editor}
        fileId="doc-test-1"
        languageId="en"
        credentialStore={credentialStore}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Generative Writing' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Select Writing Action' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'AI Entire document' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run Summarize' })).toBeInTheDocument()
  })

  it('shows configuration card when AI Settings button is clicked', () => {
    render(
      <GenerativeActionsSection
        editor={editor}
        fileId="doc-test-1"
        languageId="en"
        credentialStore={credentialStore}
      />,
    )

    const settingsBtn = screen.getByRole('button', { name: 'AI Settings' })
    fireEvent.click(settingsBtn)

    expect(screen.getByRole('region', { name: 'AI Provider Configuration' })).toBeInTheDocument()
    const providerSelect = screen.getByRole('combobox', { name: 'Select AI Provider' })
    expect(providerSelect).toBeInTheDocument()
    expect(screen.getByText('Local Processing')).toBeInTheDocument()

    fireEvent.change(providerSelect, { target: { value: 'groq' } })
    expect(screen.getByText('Destination Endpoint:')).toBeInTheDocument()
    expect(screen.getByText('https://api.groq.com/openai/v1/chat/completions')).toBeInTheDocument()
  })

  it('runs Improve Writing on entire document, previews output, and allows Discard without modifying document', async () => {
    const mockEngine = createMockTransformationEngine({
      transformFn: () => 'The team lead postponed the meeting.',
    })

    render(
      <GenerativeActionsSection
        editor={editor}
        fileId="doc-test-1"
        languageId="en"
        credentialStore={credentialStore}
        customEngine={mockEngine}
        initialActionId="improve-writing"
      />,
    )

    const runBtn = screen.getByRole('button', { name: 'Run Improve Writing' })
    fireEvent.click(runBtn)

    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Generation Result Preview' })).toBeInTheDocument()
    })

    expect(screen.getByText('The team lead postponed the meeting.')).toBeInTheDocument()
    // Document must not be modified before acceptance
    expect(editor.getText()).toBe('The meeting was postponed by team lead.')

    // Click Discard
    const discardBtn = screen.getByRole('button', { name: 'Discard generated preview' })
    fireEvent.click(discardBtn)

    expect(screen.queryByRole('region', { name: 'Generation Result Preview' })).not.toBeInTheDocument()
    expect(editor.getText()).toBe('The meeting was postponed by team lead.')
  })

  it('accepts Improve Writing via standard TipTap transaction and preserves Undo history', async () => {
    const mockEngine = createMockTransformationEngine({
      transformFn: () => 'The team lead postponed the meeting.',
    })

    render(
      <GenerativeActionsSection
        editor={editor}
        fileId="doc-test-1"
        languageId="en"
        credentialStore={credentialStore}
        customEngine={mockEngine}
        initialActionId="improve-writing"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Run Improve Writing' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Accept generated text' })).toBeInTheDocument()
    })

    // Click Accept
    fireEvent.click(screen.getByRole('button', { name: 'Accept generated text' }))

    // Document must now contain the proposed text
    expect(editor.getText()).toBe('The team lead postponed the meeting.')
    expect(screen.getByText(/Changes applied to document/)).toBeInTheDocument()

    // Undo should restore original text
    act(() => {
      editor.commands.undo()
    })
    expect(editor.getText()).toBe('The meeting was postponed by team lead.')
  })

  it('transforms selected text scope when text is highlighted in editor', async () => {
    // Select "postponed" (from 17 to 26)
    act(() => {
      editor.commands.setTextSelection({ from: 17, to: 26 })
    })

    let capturedContextText = ''
    const mockEngine = createMockTransformationEngine({
      transformFn: (ctx) => {
        capturedContextText = ctx.text
        return 'rescheduled'
      },
    })

    render(
      <GenerativeActionsSection
        editor={editor}
        fileId="doc-test-1"
        languageId="en"
        credentialStore={credentialStore}
        customEngine={mockEngine}
        initialActionId="improve-writing"
      />,
    )

    // Scope should default to selected text
    const selectedRadio = screen.getByRole('radio', { name: 'AI Selected text' })
    expect(selectedRadio).toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: 'Run Improve Writing' }))

    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Generation Result Preview' })).toBeInTheDocument()
    })

    expect(capturedContextText).toBe('postponed')
    expect(screen.getByText('rescheduled')).toBeInTheDocument()

    // Accept only selected range replacement
    fireEvent.click(screen.getByRole('button', { name: 'Accept generated text' }))
    expect(editor.getText()).toBe('The meeting was rescheduled by team lead.')

    // Undo restores original
    act(() => {
      editor.commands.undo()
    })
    expect(editor.getText()).toBe('The meeting was postponed by team lead.')
  })

  it('supports cancellation during generation and leaves document unchanged', async () => {
    const mockEngine = createMockTransformationEngine({
      delayMs: 200,
      transformFn: () => 'Delayed output',
    })

    render(
      <GenerativeActionsSection
        editor={editor}
        fileId="doc-test-1"
        languageId="en"
        credentialStore={credentialStore}
        customEngine={mockEngine}
        initialActionId="improve-writing"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Run Improve Writing' }))
    expect(screen.getByRole('button', { name: 'Generating…' })).toBeInTheDocument()

    // Cancel mid-flight
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' })
    fireEvent.click(cancelBtn)

    expect(screen.getByText('Generation cancelled.')).toBeInTheDocument()
    expect(editor.getText()).toBe('The meeting was postponed by team lead.')
  })

  it('marks result stale and blocks acceptance if document was edited while generation was in flight', async () => {
    let resolveGeneration: (text: string) => void = () => {}
    const slowPromise = new Promise<string>((resolve) => {
      resolveGeneration = resolve
    })

    const mockEngine = createMockTransformationEngine({
      transformFn: () => slowPromise,
    })

    render(
      <GenerativeActionsSection
        editor={editor}
        fileId="doc-test-1"
        languageId="en"
        credentialStore={credentialStore}
        customEngine={mockEngine}
        initialActionId="improve-writing"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Run Improve Writing' }))

    // User types in document while generation is running
    act(() => {
      editor.commands.insertContent(' Additional user typing.')
    })

    // Resolve generation
    act(() => {
      resolveGeneration('Generated text')
    })

    await waitFor(() => {
      expect(
        screen.getByText('The document changed while generation was running. Please generate again.'),
      ).toBeInTheDocument()
    })

    // Preview must not be shown, document preserves user typing
    expect(screen.queryByRole('region', { name: 'Generation Result Preview' })).not.toBeInTheDocument()
    expect(editor.getText()).toContain('Additional user typing.')
  })

  it('marks preview stale and disables Accept button if document changes after preview is rendered', async () => {
    const mockEngine = createMockTransformationEngine({
      transformFn: () => 'Cleaned up text.',
    })

    const { rerender } = render(
      <GenerativeActionsSection
        editor={editor}
        fileId="doc-test-1"
        languageId="en"
        credentialStore={credentialStore}
        customEngine={mockEngine}
        initialActionId="improve-writing"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Run Improve Writing' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Accept generated text' })).toBeInTheDocument()
    })

    // Before accepting, user edits the editor
    act(() => {
      editor.commands.insertContent(' Extra edit.')
    })

    // Force re-render to check stale state
    rerender(
      <GenerativeActionsSection
        editor={editor}
        fileId="doc-test-1"
        languageId="en"
        credentialStore={credentialStore}
        customEngine={mockEngine}
        initialActionId="improve-writing"
      />,
    )

    expect(screen.getByText('Document changed since generation')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Accept generated text' })).toBeDisabled()
  })

  it('rejects stale result if document was switched to another fileId', async () => {
    const mockEngine = createMockTransformationEngine({
      transformFn: () => 'Cleaned text',
    })

    const { rerender } = render(
      <GenerativeActionsSection
        editor={editor}
        fileId="doc-file-alpha"
        languageId="en"
        credentialStore={credentialStore}
        customEngine={mockEngine}
        initialActionId="improve-writing"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Run Improve Writing' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Accept generated text' })).toBeInTheDocument()
    })

    // Switch fileId
    rerender(
      <GenerativeActionsSection
        editor={editor}
        fileId="doc-file-beta"
        languageId="en"
        credentialStore={credentialStore}
        customEngine={mockEngine}
        initialActionId="improve-writing"
      />,
    )

    // Preview should now be marked stale and Accept button disabled
    expect(screen.getByText('Document changed since generation')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Accept generated text' })).toBeDisabled()
  })

  it('supports Ask AI action and requires prompt input', async () => {
    render(
      <GenerativeActionsSection
        editor={editor}
        fileId="doc-test-1"
        languageId="en"
        credentialStore={credentialStore}
      />,
    )

    // Switch to Ask AI
    const actionSelect = screen.getByRole('combobox', { name: 'Select Writing Action' })
    fireEvent.change(actionSelect, { target: { value: 'ask-ai' } })

    expect(screen.getByLabelText('Your Question or Instruction (Required)')).toBeInTheDocument()

    // Clicking generate without prompt gives error
    fireEvent.click(screen.getByRole('button', { name: 'Run Ask AI' }))
    expect(screen.getByText('Please enter a question or instruction for Ask AI.')).toBeInTheDocument()
  })

  it('supports Continue Writing and appends continuation without deleting original text', async () => {
    const mockEngine = createMockTransformationEngine({
      transformFn: () => 'This is the continued next paragraph.',
    })

    render(
      <GenerativeActionsSection
        editor={editor}
        fileId="doc-test-1"
        languageId="en"
        credentialStore={credentialStore}
        customEngine={mockEngine}
        initialActionId="improve-writing"
      />,
    )

    // Switch to Continue Writing
    const actionSelect = screen.getByRole('combobox', { name: 'Select Writing Action' })
    fireEvent.change(actionSelect, { target: { value: 'continue-writing' } })

    fireEvent.click(screen.getByRole('button', { name: 'Run Continue Writing' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Accept generated text' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Accept generated text' }))

    // Must preserve original text AND append continuation
    expect(editor.getText()).toContain('The meeting was postponed by team lead.')
    expect(editor.getText()).toContain('This is the continued next paragraph.')
  })

  it('supports Translate, Shorten, Expand, Summarize, and Change Tone actions', async () => {
    let capturedActionId = ''
    const mockEngine = createMockTransformationEngine({
      supportedCapabilities: ['rewrite', 'translation'],
      transformFn: (ctx) => {
        capturedActionId = ctx.actionId
        return `Result for ${ctx.actionId}`
      },
    })

    render(
      <GenerativeActionsSection
        editor={editor}
        fileId="doc-test-1"
        languageId="en"
        credentialStore={credentialStore}
        customEngine={mockEngine}
        initialActionId="improve-writing"
      />,
    )

    const actionSelect = screen.getByRole('combobox', { name: 'Select Writing Action' })

    // Test Summarize
    fireEvent.change(actionSelect, { target: { value: 'summarize' } })
    expect(screen.getByLabelText('Summary length')).toBeInTheDocument()
    expect(screen.getByLabelText('Summary format')).toBeInTheDocument()

    // Test Translate
    fireEvent.change(actionSelect, { target: { value: 'translate' } })
    expect(screen.getByLabelText('Target language')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Run Translate' }))
    await waitFor(() => expect(capturedActionId).toBe('translate'))

    // Test Change Tone
    fireEvent.change(actionSelect, { target: { value: 'change-tone' } })
    expect(screen.getByLabelText('Desired tone')).toBeInTheDocument()

    // Test Shorten
    fireEvent.change(actionSelect, { target: { value: 'shorten' } })
    expect(screen.getByRole('button', { name: 'Run Shorten' })).toBeInTheDocument()

    // Test Expand
    fireEvent.change(actionSelect, { target: { value: 'expand' } })
    expect(screen.getByRole('button', { name: 'Run Expand' })).toBeInTheDocument()
  })

  it('verifies credentials remain strictly session-only and never persist to localStorage or sessionStorage', () => {
    const freshStore = new SessionCredentialStore()
    const testKey = 'gsk_temporary_session_key_12345'
    freshStore.setCredential('groq', { apiKey: testKey })

    // Memory contains key
    expect(freshStore.getCredential('groq')?.apiKey).toBe(testKey)

    // localStorage and sessionStorage must be completely free of key
    expect(localStorage.getItem('groq')).toBeNull()
    expect(localStorage.getItem('apiKey')).toBeNull()
    expect(sessionStorage.getItem('groq')).toBeNull()
    expect(JSON.stringify(localStorage)).not.toContain(testKey)
    expect(JSON.stringify(sessionStorage)).not.toContain(testKey)
  })

  it('preserves Roman Hindi (hi-Latn) language tag when delegating to transformation engine', async () => {
    let capturedLangTag = ''
    const mockEngine = createMockTransformationEngine({
      transformFn: (ctx) => {
        capturedLangTag = ctx.languageTag
        return 'Meeting postpone ho gaya hai.'
      },
    })

    render(
      <GenerativeActionsSection
        editor={editor}
        fileId="doc-test-1"
        languageId="hi-Latn"
        credentialStore={credentialStore}
        customEngine={mockEngine}
        initialActionId="improve-writing"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Run Improve Writing' }))

    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Generation Result Preview' })).toBeInTheDocument()
    })

    expect(capturedLangTag).toBe('hi-Latn')
    expect(screen.getByText('Meeting postpone ho gaya hai.')).toBeInTheDocument()
  })

  describe('prepareContentForInsertion unit behavior', () => {
    it('parses structured markdown into TipTap blocks for document scope', () => {
      const ed = createRealEditor('<p>Old text</p>')
      const result = prepareContentForInsertion(
        ed.state.doc,
        'improve-writing',
        'document',
        undefined,
        '# Executive Summary\n\n- Milestone 1\n- Milestone 2',
      )

      expect(result.target).toEqual({ from: 0, to: ed.state.doc.content.size })
      expect(Array.isArray(result.content)).toBe(true)
      const blocks = result.content as Array<{ type: string }>
      expect(blocks[0]?.type).toBe('heading')
      expect(blocks[1]?.type).toBe('bulletList')
    })

    it('replaces inline text inside single block without splitting paragraph', () => {
      const ed = createRealEditor('<p>The meeting was postponed by lead.</p>')
      // "postponed" is at 17..26
      const result = prepareContentForInsertion(
        ed.state.doc,
        'improve-writing',
        'selected',
        { from: 17, to: 26 },
        'rescheduled',
      )

      expect(result.target).toEqual({ from: 17, to: 26 })
      expect(result.content).toBe('rescheduled')
    })

    it('adds leading space for inline continue-writing when previous char is not whitespace', () => {
      const ed = createRealEditor('<p>Hello</p>')
      const result = prepareContentForInsertion(
        ed.state.doc,
        'continue-writing',
        'selected',
        { from: 6, to: 6 },
        'world',
      )

      expect(result.target).toBe(6)
      expect(result.content).toBe(' world')
    })

    it('appends structured blocks after current block for continue-writing at block end', () => {
      const ed = createRealEditor('<p>First section.</p>')
      const endPos = ed.state.doc.content.size - 1
      const result = prepareContentForInsertion(
        ed.state.doc,
        'continue-writing',
        'document',
        { from: endPos, to: endPos },
        '# Next Header\n\nNext paragraph.',
      )

      expect(typeof result.target).toBe('number')
      expect(Array.isArray(result.content)).toBe(true)
      const blocks = result.content as Array<{ type: string }>
      expect(blocks[0]?.type).toBe('heading')
      expect(blocks[1]?.type).toBe('paragraph')
    })
  })

  it('accepts multi-block selection and replaces across paragraph boundaries with single-step undo and redo', async () => {
    const multiBlockEditor = createRealEditor('<p>First paragraph.</p><p>Second paragraph.</p>')
    // Select across both paragraphs
    multiBlockEditor.commands.setTextSelection({ from: 1, to: multiBlockEditor.state.doc.content.size - 1 })

    const mockEngine = createMockTransformationEngine({
      transformFn: () => 'Single unified paragraph replacing both.',
    })

    render(
      <GenerativeActionsSection
        editor={multiBlockEditor}
        fileId="doc-multi-1"
        languageId="en"
        credentialStore={credentialStore}
        customEngine={mockEngine}
        initialActionId="improve-writing"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Run Improve Writing' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Accept generated text' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Accept generated text' }))

    // Both paragraphs replaced by single unified paragraph
    expect(multiBlockEditor.getText()).toBe('Single unified paragraph replacing both.')

    // Single undo restores both original paragraphs
    act(() => {
      multiBlockEditor.commands.undo()
    })
    expect(multiBlockEditor.getText()).toBe('First paragraph.\n\nSecond paragraph.')

    // Redo cleanly re-applies the unified replacement
    act(() => {
      multiBlockEditor.commands.redo()
    })
    expect(multiBlockEditor.getText()).toBe('Single unified paragraph replacing both.')
  })

  it('accepts structured Markdown with headings and bullet lists into real TipTap blocks', async () => {
    const structuredEditor = createRealEditor('<p>Initial draft.</p>')

    const mockEngine = createMockTransformationEngine({
      transformFn: () => '# Executive Summary\n\n- Key finding 1\n- Key finding 2',
    })

    render(
      <GenerativeActionsSection
        editor={structuredEditor}
        fileId="doc-struct-1"
        languageId="en"
        credentialStore={credentialStore}
        customEngine={mockEngine}
        initialActionId="improve-writing"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Run Improve Writing' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Accept generated text' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Accept generated text' }))

    // TipTap nodes are real heading and bulletList
    const docJson = structuredEditor.getJSON()
    expect(docJson.content?.[0]?.type).toBe('heading')
    expect(docJson.content?.[0]?.attrs?.level).toBe(1)
    expect(docJson.content?.[1]?.type).toBe('bulletList')
    expect(docJson.content?.[1]?.content).toHaveLength(2)

    // Single undo restores initial draft
    act(() => {
      structuredEditor.commands.undo()
    })
    expect(structuredEditor.getText()).toBe('Initial draft.')

    // Redo restores structured blocks
    act(() => {
      structuredEditor.commands.redo()
    })
    expect(structuredEditor.getJSON().content?.[0]?.type).toBe('heading')
  })

  it('instantly marks preview stale when user types in editor without requiring rerender()', async () => {
    const liveEditor = createRealEditor('<p>Stable content.</p>')

    const mockEngine = createMockTransformationEngine({
      transformFn: () => 'Cleaned content.',
    })

    render(
      <GenerativeActionsSection
        editor={liveEditor}
        fileId="doc-live-1"
        languageId="en"
        credentialStore={credentialStore}
        customEngine={mockEngine}
        initialActionId="improve-writing"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Run Improve Writing' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Accept generated text' })).toBeInTheDocument()
    })

    // User types in editor: transaction fires
    act(() => {
      liveEditor.commands.insertContent(' Extra typing.')
    })

    // Transaction listener triggers real-time stale warning without calling rerender()
    expect(screen.getByText('Document changed since generation')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Accept generated text' })).toBeDisabled()
  })

  it('supports Continue Writing with cursor position when selection is empty', async () => {
    const cursorEditor = createRealEditor('<p>Intro text.</p>')
    // Set caret at end of text
    cursorEditor.commands.setTextSelection(12)

    const mockEngine = createMockTransformationEngine({
      transformFn: () => 'Following continuation.',
    })

    render(
      <GenerativeActionsSection
        editor={cursorEditor}
        fileId="doc-cursor-1"
        languageId="en"
        credentialStore={credentialStore}
        customEngine={mockEngine}
      />,
    )

    // Select Continue Writing
    const actionSelect = screen.getByRole('combobox', { name: 'Select Writing Action' })
    fireEvent.change(actionSelect, { target: { value: 'continue-writing' } })

    fireEvent.click(screen.getByRole('button', { name: 'Run Continue Writing' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Accept generated text' })).toBeInTheDocument()
    })

    // Verify Continue Writing displays clear insertion badge and notice
    expect(screen.getByText('Insertion / Append')).toBeInTheDocument()
    expect(
      screen.getByText('This continuation will be inserted following your text/cursor without replacing existing content.'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Accept generated text' }))

    // Preserves original intro text and appends continuation
    expect(cursorEditor.getText()).toContain('Intro text.')
    expect(cursorEditor.getText()).toContain('Following continuation.')

    // Undo reverts back to original
    act(() => {
      cursorEditor.commands.undo()
    })
    expect(cursorEditor.getText()).toBe('Intro text.')
  })

  it('rejects generation when document is completely empty', () => {
    const emptyEditor = createRealEditor('<p></p>')

    render(
      <GenerativeActionsSection
        editor={emptyEditor}
        fileId="doc-empty-1"
        languageId="en"
        credentialStore={credentialStore}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Run Summarize' }))
    expect(screen.getByText('Document is empty. Enter some text in the editor before generating.')).toBeInTheDocument()
  })
})