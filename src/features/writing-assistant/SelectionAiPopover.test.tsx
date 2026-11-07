// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { TextSelection } from '@tiptap/pm/state'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockTransformationEngine } from './mockTransformationEngine'
import { InlineAiSuggestion } from './InlineAiSuggestion'
import { SelectionAiPopover } from './SelectionAiPopover'
import { SELECTION_AI_ACTIONS } from './useContextualSelectionAi'
import { modelAssetManager } from './modelAssetManager'

describe('SelectionAiPopover', () => {
  it('offers the simplified writing actions and keeps translation separate', () => {
    expect(SELECTION_AI_ACTIONS.map((action) => action.label)).toEqual([
      'Rewrite',
      'Summarize',
      'Adjust…',
      'Write with Writin Assist…',
    ])
  })
  let editor: Editor | null = null

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
    editor?.destroy()
    editor = null
  })

  function setupEditor(content = '<p>The quick brown fox jumps over the lazy dog.</p>') {
    editor = new Editor({
      element: document.body.appendChild(document.createElement('div')),
      extensions: [StarterKit, InlineAiSuggestion],
      content,
    })
    return editor
  }

  it('renders the four writing actions, descriptions, and separate Translate action', () => {
    const ed = setupEditor()
    const onClose = vi.fn()

    render(<SelectionAiPopover editor={ed} onClose={onClose} />)

    expect(screen.getByRole('dialog', { name: 'Writin Assist' })).toBeTruthy()

    for (const action of SELECTION_AI_ACTIONS) {
      expect(screen.getByText(action.label)).toBeTruthy()
      expect(screen.getByText(action.description)).toBeTruthy()
    }
    expect(screen.getByText('Translate')).toBeTruthy()
  })

  it('executes summarize action and allows accepting the result', async () => {
    const ed = setupEditor()
    vi.spyOn(ed.view, 'coordsAtPos').mockReturnValue({ left: 100, right: 250, top: 300, bottom: 320 })
    vi.spyOn(ed.view.dom, 'getBoundingClientRect').mockReturnValue({
      x: 40, y: 100, left: 40, right: 940, top: 100, bottom: 500, width: 900, height: 400,
      toJSON: () => ({}),
    } as DOMRect)
    const mockEngine = createMockTransformationEngine({
      supportedCapabilities: ['rewrite', 'translation'],
      delayMs: 60,
      transformFn: () => 'A fast fox leapt.',
      explanation: 'Summarized text',
    })
    const onClose = vi.fn()

    // Select "The quick brown fox" (from 1 to 20)
    act(() => {
      ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, 1, 20)))
    })

    render(
      <SelectionAiPopover
        editor={ed}
        fileId="test-doc"
        customEngine={mockEngine}
        onClose={onClose}
      />
    )

    // Click Summarize
    const summarizeBtn = screen.getByRole('button', { name: /Summarize/i })
    fireEvent.click(summarizeBtn)

    await waitFor(() => expect(ed.view.dom.querySelector('.mybook-ai-suggestion-loading')).toBeTruthy())
    expect(screen.queryByRole('dialog', { name: 'Writin Assist' })).toBeNull()
    expect(ed.getText()).toBe('The quick brown fox jumps over the lazy dog.')

    // Wait for preview
    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Generation Result Preview' })).toBeTruthy()
    })

    const reviewPopover = screen.getByRole('region', { name: 'Writin Assist review' })
    expect(reviewPopover).toHaveStyle({ position: 'fixed', left: '100px', top: '292px' })
    expect(screen.queryByRole('dialog', { name: 'Writin Assist' })).toBeNull()

    expect(
      Array.from(ed.view.dom.querySelectorAll('.mybook-ai-suggestion-added'))
        .map((node) => node.textContent)
        .join(''),
    ).toContain('fast')
    expect(ed.getText()).toBe('The quick brown fox jumps over the lazy dog.')

    // Click Accept
    const acceptBtn = screen.getByRole('button', { name: /Accept/i })
    act(() => {
      fireEvent.click(acceptBtn)
    })

    // Text in editor should now be updated
    expect(ed.getText()).toContain('A fast fox leapt. jumps over the lazy dog.')
    expect(onClose).toHaveBeenCalled()
  })

  it('allows discarding the preview without modifying the editor', async () => {
    const ed = setupEditor()
    const originalText = ed.getText()
    const mockEngine = createMockTransformationEngine({
      supportedCapabilities: ['rewrite', 'translation'],
      transformFn: () => 'A fast fox leapt.',
    })
    const onClose = vi.fn()

    act(() => {
      ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, 1, 20)))
    })

    render(
      <SelectionAiPopover
        editor={ed}
        fileId="test-doc"
        customEngine={mockEngine}
        onClose={onClose}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Summarize/i }))

    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Generation Result Preview' })).toBeTruthy()
    })

    // Click Discard
    const discardBtn = screen.getByRole('button', { name: /Discard/i })
    act(() => {
      fireEvent.click(discardBtn)
    })

    // Text should remain completely untouched
    expect(ed.getText()).toBe(originalText)
  })

  it('rejects stale insertion if the document was modified before acceptance', async () => {
    const ed = setupEditor()
    const mockEngine = createMockTransformationEngine({
      supportedCapabilities: ['rewrite', 'translation'],
      transformFn: () => 'A fast fox leapt.',
    })
    const onClose = vi.fn()

    act(() => {
      ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, 1, 20)))
    })

    render(
      <SelectionAiPopover
        editor={ed}
        fileId="test-doc"
        customEngine={mockEngine}
        onClose={onClose}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Summarize/i }))

    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Generation Result Preview' })).toBeTruthy()
    })

    // In the meantime, mutate the document
    act(() => {
      ed.commands.insertContentAt(5, 'EXTRA ')
    })

    // Now try to click Accept
    const acceptBtn = screen.getByRole('button', { name: /Accept/i })
    act(() => {
      fireEvent.click(acceptBtn)
    })

    // Should display stale warning and not apply
    expect(screen.getByText(/Selection or Document Changed/i)).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('supports Translate sub-view and passes target language', async () => {
    vi.spyOn(modelAssetManager, 'isModelCached').mockResolvedValue(true)
    const ed = setupEditor()
    let passedTargetLang: string | undefined
    const mockEngine = createMockTransformationEngine({
      supportedCapabilities: ['rewrite', 'translation'],
      transformFn: (ctx) => {
        passedTargetLang = ctx.options?.targetLanguage as string | undefined
        return 'तेज़ भूरी लोमड़ी'
      },
    })
    const onClose = vi.fn()

    act(() => {
      ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, 1, 20)))
    })

    render(
      <SelectionAiPopover
        editor={ed}
        fileId="test-doc"
        customEngine={mockEngine}
        onClose={onClose}
      />
    )

    // Click Translate...
    fireEvent.click(screen.getByRole('button', { name: /^Translate/i }))

    // Language options should be visible
    expect(screen.getByLabelText('Select target language')).toBeTruthy()
    expect(screen.getByText('Offline Supported (en ↔ hi)')).toBeTruthy()

    // Click Translate button once ready
    const translateBtn = await screen.findByRole('button', { name: /Start offline translation/i })
    await waitFor(() => expect(translateBtn).not.toBeDisabled())
    fireEvent.click(translateBtn)

    await waitFor(() => {
      expect(screen.getByText('तेज़ भूरी लोमड़ी')).toBeTruthy()
    })

    expect(passedTargetLang).toBe('hi')
  })

  it('supports Change Tone sub-view and passes tone', async () => {
    const ed = setupEditor()
    let passedTone: string | undefined
    const mockEngine = createMockTransformationEngine({
      supportedCapabilities: ['rewrite', 'translation'],
      transformFn: (ctx) => {
        passedTone = ctx.options?.tone as string | undefined
        return 'An expeditious vulpine.'
      },
    })
    const onClose = vi.fn()

    act(() => {
      ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, 1, 20)))
    })

    render(
      <SelectionAiPopover
        editor={ed}
        fileId="test-doc"
        customEngine={mockEngine}
        onClose={onClose}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Adjust/i }))
    expect(screen.getByText('Professional')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Professional/i }))

    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Generation Result Preview' })).toBeTruthy()
    })

    expect(passedTone).toBe('professional')
  })

  it('supports Ask AI custom prompt sub-view', async () => {
    const ed = setupEditor()
    let passedInstruction: string | undefined
    const mockEngine = createMockTransformationEngine({
      supportedCapabilities: ['rewrite', 'translation'],
      transformFn: (ctx) => {
        passedInstruction = ctx.instruction
        return 'Inverted fox statement.'
      },
    })
    const onClose = vi.fn()

    act(() => {
      ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, 1, 20)))
    })

    render(
      <SelectionAiPopover
        editor={ed}
        fileId="test-doc"
        customEngine={mockEngine}
        onClose={onClose}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Write with Writin Assist/i }))

    const composer = screen.getByRole('region', { name: 'Write with Writin Assist' })
    expect(composer).toHaveStyle({ position: 'fixed' })
    expect(screen.queryByRole('dialog', { name: 'Writin Assist' })).toBeNull()

    const input = screen.getByPlaceholderText(/Write with Writin Assist/i)
    fireEvent.change(input, { target: { value: 'Make it passive voice' } })

    const submitBtn = screen.getByRole('button', { name: /Send prompt to Writin Assist/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Generation Result Preview' })).toBeTruthy()
    })

    expect(passedInstruction).toBe('Make it passive voice')
  })

  it('allows undoing accepted insertion with ProseMirror history', async () => {
    const ed = setupEditor()
    const originalText = ed.getText()
    const mockEngine = createMockTransformationEngine({
      supportedCapabilities: ['rewrite', 'translation'],
      transformFn: () => 'A fast fox leapt.',
    })

    act(() => {
      ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, 1, 20)))
    })

    render(
      <SelectionAiPopover
        editor={ed}
        fileId="test-doc"
        customEngine={mockEngine}
        onClose={() => undefined}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Summarize/i }))

    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Generation Result Preview' })).toBeTruthy()
    })

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Accept/i }))
    })

    expect(ed.getText()).toContain('A fast fox leapt.')

    // Trigger undo
    act(() => {
      ed.commands.undo()
    })

    expect(ed.getText()).toBe(originalText)
  })

  it('caps generating popover width and clamps position to prevent desktop clipping', async () => {
    const ed = setupEditor()
    vi.spyOn(ed.view, 'coordsAtPos').mockReturnValue({ left: 700, right: 850, top: 300, bottom: 320 })
    // Simulate an offset editor on desktop (e.g. 960px wide editor starting at left=250px with viewport 1024px)
    vi.spyOn(ed.view.dom, 'getBoundingClientRect').mockReturnValue({
      x: 250, y: 100, left: 250, right: 1210, top: 100, bottom: 600, width: 960, height: 500,
      toJSON: () => ({}),
    } as DOMRect)
    window.innerWidth = 1024

    const mockEngine = createMockTransformationEngine({
      supportedCapabilities: ['rewrite', 'translation'],
      delayMs: 200,
      transformFn: () => 'A fast fox leapt.',
    })

    act(() => {
      ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, 1, 20)))
    })

    render(
      <SelectionAiPopover
        editor={ed}
        fileId="test-doc"
        customEngine={mockEngine}
        onClose={() => undefined}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Summarize/i }))

    // Popover is now in loading/generating state
    const popover = screen.getByRole('region', { name: /Writin Assist review/i })
    expect(popover).toBeInTheDocument()

    // Width must be capped at 440px rather than expanding to editor's 960px width
    expect(popover.style.width).toBe('440px')

    // Popover left-aligns with text start and clamps to prevent right-edge clipping [16 <= left <= 1024 - 440 - 16 = 568]
    const leftNum = parseFloat(popover.style.left)
    expect(leftNum).toBeLessThanOrEqual(568)
    expect(leftNum).toBeGreaterThanOrEqual(16)
    expect(popover.style.transform).toBe('translateY(-100%)')
  })

  it('aligns sleek floating bar to the left margin of the text', async () => {
    const ed = setupEditor()
    vi.spyOn(ed.view, 'coordsAtPos').mockReturnValue({ left: 120, right: 260, top: 300, bottom: 320 })
    vi.spyOn(ed.view.dom, 'getBoundingClientRect').mockReturnValue({
      x: 120, y: 100, left: 120, right: 900, top: 100, bottom: 600, width: 780, height: 500,
      toJSON: () => ({}),
    } as DOMRect)
    window.innerWidth = 1200

    const mockEngine = createMockTransformationEngine({
      supportedCapabilities: ['rewrite', 'translation'],
      delayMs: 200,
      transformFn: () => 'A fast fox leapt.',
    })

    act(() => {
      ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, 5, 20)))
    })

    render(
      <SelectionAiPopover
        editor={ed}
        fileId="test-doc"
        customEngine={mockEngine}
        onClose={() => undefined}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Summarize/i }))

    const popover = screen.getByRole('region', { name: /Writin Assist review/i })
    expect(popover).toBeInTheDocument()

    // Left should align with the text start (120px)
    expect(popover.style.left).toBe('120px')
    expect(popover.style.transform).toBe('translateY(-100%)')
  })
})
