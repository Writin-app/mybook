// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { TextSelection } from '@tiptap/pm/state'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockTransformationEngine } from '../../features/writing-assistant/mockTransformationEngine'
import { InlineAiSuggestion } from '../../features/writing-assistant/InlineAiSuggestion'
import { SELECTION_AI_ACTIONS } from '../../features/writing-assistant/useContextualSelectionAi'
import { MobileSelectionAiBar } from './MobileSelectionAiBar'

describe('MobileSelectionAiBar', () => {
  let editor: Editor | null = null

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
    editor?.destroy()
    editor = null
  })

  function setupEditor(content = '<p>Mobile text selection testing passage.</p>') {
    editor = new Editor({
      element: document.body.appendChild(document.createElement('div')),
      extensions: [StarterKit, InlineAiSuggestion],
      content,
    })
    return editor
  }

  it('does not render floating pill when there is no text selection', () => {
    const ed = setupEditor()
    vi.spyOn(ed, 'isFocused', 'get').mockReturnValue(true)

    render(<MobileSelectionAiBar editor={ed} />)

    expect(screen.queryByLabelText('Writin Assist')).toBeNull()
  })

  it('renders floating accessory pill when text is selected', () => {
    const ed = setupEditor()
    vi.spyOn(ed, 'isFocused', 'get').mockReturnValue(true)

    render(<MobileSelectionAiBar editor={ed} />)

    act(() => {
      ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, 1, 12)))
    })

    const pill = screen.getByLabelText('Writin Assist')
    expect(pill).toBeTruthy()
    expect(screen.getByText('Writin Assist')).toBeTruthy()
  })

  it('keeps AI actions available when a mobile text selection blurs the editor', () => {
    const ed = setupEditor()
    ed.view.focus()

    render(<MobileSelectionAiBar editor={ed} />)

    act(() => {
      ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, 1, 12)))
    })
    fireEvent.blur(ed.view.dom)

    expect(screen.getByLabelText('Writin Assist')).toBeTruthy()
  })

  it('opens bottom sheet when accessory pill is clicked', () => {
    const ed = setupEditor()
    vi.spyOn(ed, 'isFocused', 'get').mockReturnValue(true)

    render(<MobileSelectionAiBar editor={ed} />)

    act(() => {
      ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, 1, 12)))
    })

    fireEvent.click(screen.getByLabelText('Writin Assist'))

    // Bottom sheet is now open
    for (const action of SELECTION_AI_ACTIONS) {
      expect(screen.getByText(action.label)).toBeTruthy()
    }
    expect(screen.getByRole('button', { name: /Translate/i })).toBeTruthy()
    expect(screen.queryByText('Proofread')).toBeNull()
  })

  it('executes AI action and accepts result on mobile', async () => {
    const ed = setupEditor()
    vi.spyOn(ed, 'isFocused', 'get').mockReturnValue(true)
    const mockEngine = createMockTransformationEngine({
      supportedCapabilities: ['rewrite', 'translation'],
      delayMs: 60,
      transformFn: () => 'Shorter mobile text.',
    })

    render(<MobileSelectionAiBar editor={ed} fileId="mob-doc" customEngine={mockEngine} />)

    act(() => {
      ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, 1, 12)))
    })

    fireEvent.click(screen.getByLabelText('Writin Assist'))

    fireEvent.click(screen.getByRole('button', { name: /Adjust/i }))
    const shortenBtn = screen.getByRole('button', { name: 'Shorter' })
    fireEvent.click(shortenBtn)

    await waitFor(() => expect(ed.view.dom.querySelector('.mybook-ai-suggestion-loading')).toBeTruthy())
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(ed.getText()).toBe('Mobile text selection testing passage.')

    await waitFor(() => {
      expect(screen.getByText('Shorter mobile text.')).toBeTruthy()
    })

    const acceptBtn = screen.getByRole('button', { name: /Accept/i })
    act(() => {
      fireEvent.click(acceptBtn)
    })

    expect(ed.getText()).toContain('Shorter mobile text. selection testing passage.')
  })

  it('allows discarding preview without document changes', async () => {
    const ed = setupEditor()
    const originalText = ed.getText()
    vi.spyOn(ed, 'isFocused', 'get').mockReturnValue(true)
    const mockEngine = createMockTransformationEngine({
      supportedCapabilities: ['rewrite', 'translation'],
      transformFn: () => 'Discarded proposal.',
    })

    render(<MobileSelectionAiBar editor={ed} fileId="mob-doc" customEngine={mockEngine} />)

    act(() => {
      ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, 1, 12)))
    })

    fireEvent.click(screen.getByLabelText('Writin Assist'))
    fireEvent.click(screen.getByRole('button', { name: /Adjust/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Shorter' }))

    await waitFor(() => {
      expect(screen.getByText('Discarded proposal.')).toBeTruthy()
    })

    const discardBtn = screen.getByRole('button', { name: /Discard/i })
    act(() => {
      fireEvent.click(discardBtn)
    })

    expect(ed.getText()).toBe(originalText)
  })

  it('closes the mobile action sheet and opens the prompt composer at the selected text', async () => {
    const ed = setupEditor()
    vi.spyOn(ed, 'isFocused', 'get').mockReturnValue(true)
    const mockEngine = createMockTransformationEngine({
      supportedCapabilities: ['rewrite', 'translation'],
      transformFn: () => 'Prompt result.',
    })

    render(<MobileSelectionAiBar editor={ed} fileId="mob-doc" customEngine={mockEngine} />)
    act(() => {
      ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, 1, 12)))
    })

    fireEvent.click(screen.getByLabelText('Writin Assist'))
    fireEvent.click(screen.getByRole('button', { name: /Write with Writin Assist/i }))

    const composer = screen.getByRole('region', { name: 'Write with Writin Assist' })
    expect(composer).toHaveStyle({ position: 'fixed' })
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.change(composer.querySelector('textarea') as HTMLTextAreaElement, { target: { value: 'Make it clearer' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send prompt to Writin Assist' }))

    await waitFor(() => expect(screen.getByText('Prompt result.')).toBeTruthy())
    expect(screen.getByRole('region', { name: 'Writin Assist review' })).toHaveStyle({ position: 'fixed' })
  })
})
