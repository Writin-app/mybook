// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { TextSelection } from '@tiptap/pm/state'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockTransformationEngine } from '../../features/writing-assistant/mockTransformationEngine'
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
      extensions: [StarterKit],
      content,
    })
    return editor
  }

  it('does not render floating pill when there is no text selection', () => {
    const ed = setupEditor()
    vi.spyOn(ed, 'isFocused', 'get').mockReturnValue(true)

    render(<MobileSelectionAiBar editor={ed} />)

    expect(screen.queryByLabelText('AI Actions on selection')).toBeNull()
  })

  it('renders floating accessory pill when text is selected', () => {
    const ed = setupEditor()
    vi.spyOn(ed, 'isFocused', 'get').mockReturnValue(true)

    render(<MobileSelectionAiBar editor={ed} />)

    act(() => {
      ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, 1, 12)))
    })

    const pill = screen.getByLabelText('AI Actions on selection')
    expect(pill).toBeTruthy()
    expect(screen.getByText('AI Actions')).toBeTruthy()
  })

  it('opens bottom sheet when accessory pill is clicked', () => {
    const ed = setupEditor()
    vi.spyOn(ed, 'isFocused', 'get').mockReturnValue(true)

    render(<MobileSelectionAiBar editor={ed} />)

    act(() => {
      ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, 1, 12)))
    })

    fireEvent.click(screen.getByLabelText('AI Actions on selection'))

    // Bottom sheet is now open
    for (const action of SELECTION_AI_ACTIONS) {
      expect(screen.getByText(action.label)).toBeTruthy()
    }
  })

  it('executes AI action and accepts result on mobile', async () => {
    const ed = setupEditor()
    vi.spyOn(ed, 'isFocused', 'get').mockReturnValue(true)
    const mockEngine = createMockTransformationEngine({
      supportedCapabilities: ['rewrite', 'translation'],
      transformFn: () => 'Shorter mobile text.',
    })

    render(<MobileSelectionAiBar editor={ed} fileId="mob-doc" customEngine={mockEngine} />)

    act(() => {
      ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, 1, 12)))
    })

    fireEvent.click(screen.getByLabelText('AI Actions on selection'))

    const shortenBtn = screen.getByRole('button', { name: /Shorten/i })
    fireEvent.click(shortenBtn)

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

    fireEvent.click(screen.getByLabelText('AI Actions on selection'))
    fireEvent.click(screen.getByRole('button', { name: /Shorten/i }))

    await waitFor(() => {
      expect(screen.getByText('Discarded proposal.')).toBeTruthy()
    })

    const discardBtn = screen.getByRole('button', { name: /Discard/i })
    act(() => {
      fireEvent.click(discardBtn)
    })

    expect(ed.getText()).toBe(originalText)
  })
})
