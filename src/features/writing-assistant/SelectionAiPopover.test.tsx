// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { TextSelection } from '@tiptap/pm/state'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockTransformationEngine } from './mockTransformationEngine'
import { SelectionAiPopover } from './SelectionAiPopover'
import { SELECTION_AI_ACTIONS } from './useContextualSelectionAi'
import { modelAssetManager } from './modelAssetManager'

describe('SelectionAiPopover', () => {
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
      extensions: [StarterKit],
      content,
    })
    return editor
  }

  it('renders all 7 primary AI actions when open', () => {
    const ed = setupEditor()
    const onClose = vi.fn()

    render(<SelectionAiPopover editor={ed} onClose={onClose} />)

    expect(screen.getByRole('dialog', { name: 'Contextual AI Actions' })).toBeTruthy()

    for (const action of SELECTION_AI_ACTIONS) {
      expect(screen.getByText(action.label)).toBeTruthy()
    }
  })

  it('executes summarize action and allows accepting the result', async () => {
    const ed = setupEditor()
    const mockEngine = createMockTransformationEngine({
      supportedCapabilities: ['rewrite', 'translation'],
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

    // Wait for preview
    await waitFor(() => {
      expect(screen.getByText('A fast fox leapt.')).toBeTruthy()
    })

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
      expect(screen.getByText('A fast fox leapt.')).toBeTruthy()
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
      expect(screen.getByText('A fast fox leapt.')).toBeTruthy()
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
    fireEvent.click(screen.getByRole('button', { name: /Translate…/i }))

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

    fireEvent.click(screen.getByRole('button', { name: /Change Tone…/i }))
    expect(screen.getByText('Professional')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Professional/i }))

    await waitFor(() => {
      expect(screen.getByText('An expeditious vulpine.')).toBeTruthy()
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

    fireEvent.click(screen.getByRole('button', { name: /Ask AI…/i }))

    const input = screen.getByPlaceholderText(/Turn this into 3 bullet points/i)
    fireEvent.change(input, { target: { value: 'Make it passive voice' } })

    const submitBtn = screen.getByRole('button', { name: /Generate/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText('Inverted fox statement.')).toBeTruthy()
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
      expect(screen.getByText('A fast fox leapt.')).toBeTruthy()
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
})
