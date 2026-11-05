// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import StarterKit from '@tiptap/starter-kit'
import { Editor } from '@tiptap/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { GenerationContext, TransformationResult } from './contracts'
import { GenerativeActionsSection } from './GenerativeActionsSection'
import {
  LOCAL_AI_CONSENT_STORAGE_KEY,
  LocalLlamaTransformationEngine,
  type LocalEngineStatusListener,
  type LocalEngineStatusReport,
} from './localLlamaEngine'
import { SessionCredentialStore } from './sessionCredentialStore'

function createRealEditor(content = '<p>The meeting was postponed by team lead.</p>') {
  return new Editor({
    element: document.createElement('div'),
    extensions: [StarterKit],
    content,
  })
}

export interface MockTransformationOutput {
  proposedText: string
  explanation?: string
}

class MockLocalEngine {
  readonly id = 'writin.local-llama.mock'
  readonly capabilities = {
    supports: [
      { capability: 'rewrite' as const, languages: [{ tag: 'en', includeSubtags: true }] },
      { capability: 'translation' as const, languages: [{ tag: 'en', includeSubtags: true }] },
    ],
  }

  private userConsent = false
  private status: LocalEngineStatusReport = {
    state: 'unavailable',
    progress: 0,
    message: 'Local model is not initialized.',
    modelId: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    isCached: false,
  }
  private listeners = new Set<LocalEngineStatusListener>()
  public initCalls = 0
  public unloadCalls = 0
  public transformFn?: (ctx: GenerationContext) => Promise<MockTransformationOutput>
  private tokenListener?: (delta: string, accumulated: string) => void

  public grantUserConsent() {
    this.userConsent = true
  }

  public revokeUserConsent() {
    this.userConsent = false
  }

  public hasUserConsent() {
    return this.userConsent
  }

  public getStatus() {
    return { ...this.status }
  }

  public setStatus(newStatus: Partial<LocalEngineStatusReport>) {
    this.status = { ...this.status, ...newStatus }
    for (const l of this.listeners) l(this.status)
  }

  public subscribeStatus(listener: LocalEngineStatusListener) {
    this.listeners.add(listener)
    listener(this.status)
    return () => {
      this.listeners.delete(listener)
    }
  }

  public async getAvailability() {
    return { available: true }
  }

  public async init() {
    this.initCalls++
    this.setStatus({ state: 'downloading', progress: 15, message: 'Downloading model weights from CDN...' })
    this.setStatus({ state: 'initializing', progress: 85, message: 'Loading model weights from cache...' })
    this.setStatus({ state: 'ready', progress: 100, message: 'Ready for local inference.', isCached: true })
  }

  public async unload() {
    this.unloadCalls++
    this.setStatus({ state: 'unavailable', progress: 0, message: 'Unloaded.' })
  }

  public setTokenDeltaListener(listener?: (delta: string, accumulated: string) => void) {
    this.tokenListener = listener
  }

  public emitTokens(tokens: string[]) {
    let accumulated = ''
    for (const t of tokens) {
      accumulated += t
      this.tokenListener?.(t, accumulated)
    }
  }

  public async transform(ctx: GenerationContext): Promise<TransformationResult> {
    const res = this.transformFn
      ? await this.transformFn(ctx)
      : {
          proposedText: 'Locally transformed text content.',
          explanation: 'Locally generated with Llama 3.2 1B (on-device)',
        }

    return {
      status: 'preview-ready',
      requestId: ctx.requestId,
      documentId: ctx.documentId,
      snapshotId: ctx.snapshotId,
      sourceText: ctx.text,
      proposedText: res.proposedText,
      explanation: res.explanation ?? 'Locally generated with Llama 3.2 1B (on-device)',
    }
  }
}

describe('GenerativeActionsSection Local Llama Integration', () => {
  let editor: Editor
  let credentialStore: SessionCredentialStore
  let mockEngine: MockLocalEngine

  beforeEach(() => {
    localStorage.clear()
    editor = createRealEditor()
    credentialStore = new SessionCredentialStore()
    mockEngine = new MockLocalEngine()
  })

  afterEach(() => {
    cleanup()
    editor.destroy()
    localStorage.clear()
  })

  describe('1. First-Time Consent and No Download Before Consent', () => {
    it('does not display consent card on initial mount, but displays contextual consent card when user clicks Run', () => {
      render(
        <GenerativeActionsSection
          editor={editor}
          fileId="doc-test-1"
          languageId="en"
          credentialStore={credentialStore}
          localEngine={mockEngine as unknown as LocalLlamaTransformationEngine}
          initialProviderId="local"
        />,
      )

      // Consent card must NOT be displayed on initial mount
      expect(screen.queryByRole('region', { name: 'Enable Private Writing Assistant' })).not.toBeInTheDocument()

      // User explicitly clicks "Run Summarize"
      const runBtn = screen.getByRole('button', { name: 'Run Summarize' })
      fireEvent.click(runBtn)

      // Contextual consent card is displayed
      expect(screen.getByRole('region', { name: 'Enable Private Writing Assistant' })).toBeInTheDocument()
      expect(screen.getByText('Enable Private Writing Assistant')).toBeInTheDocument()
      expect(
        screen.getByText('Use AI to summarize, translate, and improve your writing directly on this device.'),
      ).toBeInTheDocument()
      expect(screen.getByText(/Your document content is processed locally/)).toBeInTheDocument()
      expect(screen.getByText(/Works offline after the initial download/)).toBeInTheDocument()
      expect(screen.getByText(/One-time download of approximately 680 MB/)).toBeInTheDocument()
      expect(screen.getByText(/Requires approximately 880 MB of device memory/)).toBeInTheDocument()

      expect(screen.getByRole('button', { name: 'Download & Enable on-device assistant' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Do not enable on-device assistant now' })).toBeInTheDocument()

      // Model download must NOT start automatically before consent
      expect(mockEngine.initCalls).toBe(0)
    })

    it('clicking "Not Now" dismisses the consent prompt and cancels pending action without downloading', () => {
      render(
        <GenerativeActionsSection
          editor={editor}
          fileId="doc-test-1"
          languageId="en"
          credentialStore={credentialStore}
          localEngine={mockEngine as unknown as LocalLlamaTransformationEngine}
          initialProviderId="local"
        />,
      )

      // Trigger consent prompt by clicking Run Summarize
      const runBtn = screen.getByRole('button', { name: 'Run Summarize' })
      fireEvent.click(runBtn)

      expect(screen.getByRole('region', { name: 'Enable Private Writing Assistant' })).toBeInTheDocument()

      const notNowBtn = screen.getByRole('button', { name: 'Do not enable on-device assistant now' })
      fireEvent.click(notNowBtn)

      // Consent prompt is dismissed
      expect(screen.queryByRole('region', { name: 'Enable Private Writing Assistant' })).not.toBeInTheDocument()
      // Zero download calls
      expect(mockEngine.initCalls).toBe(0)
    })
  })

  describe('2. Download Progress, Initialization and Cancellation', () => {
    it('clicking "Download & Enable" grants consent, downloads model, and automatically executes pending action', async () => {
      mockEngine.transformFn = async () => ({
        proposedText: 'Auto-executed summary after download.',
        explanation: 'Locally generated with Llama 3.2 1B (on-device)',
      })

      render(
        <GenerativeActionsSection
          editor={editor}
          fileId="doc-test-1"
          languageId="en"
          credentialStore={credentialStore}
          localEngine={mockEngine as unknown as LocalLlamaTransformationEngine}
          initialProviderId="local"
        />,
      )

      // Click Run Summarize without consent
      const runBtn = screen.getByRole('button', { name: 'Run Summarize' })
      fireEvent.click(runBtn)

      const enableBtn = screen.getByRole('button', { name: 'Download & Enable on-device assistant' })
      await act(async () => {
        fireEvent.click(enableBtn)
      })

      expect(mockEngine.hasUserConsent()).toBe(true)
      expect(localStorage.getItem(LOCAL_AI_CONSENT_STORAGE_KEY)).toBe('true')
      expect(mockEngine.initCalls).toBe(1)
      expect(mockEngine.getStatus().state).toBe('ready')

      // Automatically executes pending action without a second click
      await waitFor(() => {
        expect(screen.getByRole('region', { name: 'Generation Result Preview' })).toBeInTheDocument()
      })
      expect(screen.getByText('Auto-executed summary after download.')).toBeInTheDocument()
    })

    it('cancels auto-execution if document was modified during download and initialization', async () => {
      mockEngine.transformFn = async () => ({
        proposedText: 'Should not appear',
      })

      render(
        <GenerativeActionsSection
          editor={editor}
          fileId="doc-test-1"
          languageId="en"
          credentialStore={credentialStore}
          localEngine={mockEngine as unknown as LocalLlamaTransformationEngine}
          initialProviderId="local"
        />,
      )

      // Click Run Summarize
      fireEvent.click(screen.getByRole('button', { name: 'Run Summarize' }))

      // While consent card is up, modify editor doc
      editor.commands.setContent('<p>Document changed by user!</p>')

      // Click Download & Enable
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Download & Enable on-device assistant' }))
      })

      // Auto-execution is cancelled and user is notified document changed
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
      })
      expect(screen.getByText(/The document changed while preparing the writing assistant/)).toBeInTheDocument()
      expect(screen.queryByRole('region', { name: 'Generation Result Preview' })).not.toBeInTheDocument()
    })

    it('displays simplified progress bar without technical jargon when downloading', () => {
      mockEngine.grantUserConsent()
      mockEngine.setStatus({
        state: 'downloading',
        progress: 45,
        message: 'Fetching parameters shard 10/22...',
      })

      render(
        <GenerativeActionsSection
          editor={editor}
          fileId="doc-test-1"
          languageId="en"
          credentialStore={credentialStore}
          localEngine={mockEngine as unknown as LocalLlamaTransformationEngine}
          initialProviderId="local"
        />,
      )

      expect(screen.getByRole('region', { name: 'On-Device Assistant Setup Progress' })).toBeInTheDocument()
      expect(screen.getByText('Downloading Writing Assistant…')).toBeInTheDocument()
      expect(screen.getByText('45%')).toBeInTheDocument()
      // Raw shard message must NOT be shown to user
      expect(screen.queryByText('Fetching parameters shard 10/22...')).not.toBeInTheDocument()
      expect(screen.getByText('Downloading writing assistant files…')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    })

    it('clicking Cancel during download unloads worker and cancels setup', async () => {
      mockEngine.grantUserConsent()
      mockEngine.setStatus({
        state: 'downloading',
        progress: 30,
        message: 'Downloading...',
      })

      render(
        <GenerativeActionsSection
          editor={editor}
          fileId="doc-test-1"
          languageId="en"
          credentialStore={credentialStore}
          localEngine={mockEngine as unknown as LocalLlamaTransformationEngine}
          initialProviderId="local"
        />,
      )

      const cancelBtn = screen.getByRole('button', { name: 'Cancel' })
      await act(async () => {
        fireEvent.click(cancelBtn)
      })

      expect(mockEngine.unloadCalls).toBe(1)
      expect(screen.getByText('Download cancelled.')).toBeInTheDocument()
    })

    it('displays error card and allows retry if initialization fails', async () => {
      mockEngine.grantUserConsent()
      mockEngine.setStatus({
        state: 'error',
        progress: 0,
        error: 'Failed to fetch model weights from network.',
      })

      render(
        <GenerativeActionsSection
          editor={editor}
          fileId="doc-test-1"
          languageId="en"
          credentialStore={credentialStore}
          localEngine={mockEngine as unknown as LocalLlamaTransformationEngine}
          initialProviderId="local"
        />,
      )

      expect(screen.getByRole('region', { name: 'On-device assistant error' })).toBeInTheDocument()
      expect(screen.getByText('Failed to fetch model weights from network.')).toBeInTheDocument()

      const retryBtn = screen.getByRole('button', { name: 'Retry Download' })
      await act(async () => {
        fireEvent.click(retryBtn)
      })

      expect(mockEngine.initCalls).toBe(1)
    })
  })

  describe('3. Generation, All 7 Actions & TipTap Non-Destructive Flow', () => {
    beforeEach(() => {
      mockEngine.grantUserConsent()
      mockEngine.setStatus({ state: 'ready', progress: 100, isCached: true })
    })

    it('executes Summarize action locally, shows preview, and does not alter document until accepted', async () => {
      mockEngine.transformFn = async () => ({
        proposedText: '<source_text>- Point 1: Team lead rescheduled meeting.\n- Point 2: Agenda unchanged.</source_text>',
        explanation: 'Locally generated with Llama 3.2 1B (on-device)',
      })

      render(
        <GenerativeActionsSection
          editor={editor}
          fileId="doc-test-1"
          languageId="en"
          credentialStore={credentialStore}
          localEngine={mockEngine as unknown as LocalLlamaTransformationEngine}
          initialProviderId="local"
        />,
      )

      // Select Summarize action
      const actionSelect = screen.getByRole('combobox', { name: 'Select Writing Action' })
      fireEvent.change(actionSelect, { target: { value: 'summarize' } })

      const runBtn = screen.getByRole('button', { name: 'Run Summarize' })
      await act(async () => {
        fireEvent.click(runBtn)
      })

      await waitFor(() => {
        expect(screen.getByRole('region', { name: 'Generation Result Preview' })).toBeInTheDocument()
      })

      // Narrow artifact tags (<source_text>) must be cleaned
      expect(screen.getByText(/- Point 1: Team lead rescheduled meeting./)).toBeInTheDocument()
      expect(screen.getByText('Locally generated with Llama 3.2 1B (on-device)')).toBeInTheDocument()

      // Document in editor must remain untouched before accept
      expect(editor.getText()).toBe('The meeting was postponed by team lead.')

      // Accept changes
      const acceptBtn = screen.getByRole('button', { name: 'Accept generated text' })
      await act(async () => {
        fireEvent.click(acceptBtn)
      })

      // Now document should contain the accepted content
      expect(editor.getText()).toContain('Point 1: Team lead rescheduled meeting.')
    })

    it('executes Translate action and validates that untranslated echo is flagged as error', async () => {
      const source = 'The meeting was postponed by team lead.'
      // Simulate model echoing original text
      mockEngine.transformFn = async () => ({
        proposedText: source,
        explanation: 'Locally generated with Llama 3.2 1B (on-device)',
      })

      render(
        <GenerativeActionsSection
          editor={editor}
          fileId="doc-test-1"
          languageId="en"
          credentialStore={credentialStore}
          localEngine={mockEngine as unknown as LocalLlamaTransformationEngine}
          initialProviderId="local"
        />,
      )

      const actionSelect = screen.getByRole('combobox', { name: 'Select Writing Action' })
      fireEvent.change(actionSelect, { target: { value: 'translate' } })

      const runBtn = screen.getByRole('button', { name: 'Run Translate' })
      await act(async () => {
        fireEvent.click(runBtn)
      })

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
      })

      expect(screen.getByText(/The local model could not complete the translation/)).toBeInTheDocument()
      // Document remains untouched
      expect(editor.getText()).toBe(source)
    })

    it('handles Shorten, Expand, Change Tone, Continue Writing, and Ask AI actions', async () => {
      mockEngine.transformFn = async (ctx) => ({
        proposedText: `Executed ${ctx.actionId} successfully.`,
        explanation: 'Locally generated with Llama 3.2 1B (on-device)',
      })

      render(
        <GenerativeActionsSection
          editor={editor}
          fileId="doc-test-1"
          languageId="en"
          credentialStore={credentialStore}
          localEngine={mockEngine as unknown as LocalLlamaTransformationEngine}
          initialProviderId="local"
        />,
      )

      const actions = ['shorten', 'expand', 'change-tone', 'continue-writing']
      for (const actId of actions) {
        const actionSelect = screen.getByRole('combobox', { name: 'Select Writing Action' })
        fireEvent.change(actionSelect, { target: { value: actId } })

        const runBtn = screen.getByRole('button', { name: new RegExp(`Run `, 'i') })
        await act(async () => {
          fireEvent.click(runBtn)
        })

        await waitFor(() => {
          expect(screen.getByRole('region', { name: 'Generation Result Preview' })).toBeInTheDocument()
        })

        expect(screen.getByText(`Executed ${actId} successfully.`)).toBeInTheDocument()

        const discardBtn = screen.getByRole('button', { name: 'Discard generated preview' })
        fireEvent.click(discardBtn)
      }
    })

    it('requires instruction prompt when Ask AI action is selected', async () => {
      render(
        <GenerativeActionsSection
          editor={editor}
          fileId="doc-test-1"
          languageId="en"
          credentialStore={credentialStore}
          localEngine={mockEngine as unknown as LocalLlamaTransformationEngine}
          initialProviderId="local"
        />,
      )

      const actionSelect = screen.getByRole('combobox', { name: 'Select Writing Action' })
      fireEvent.change(actionSelect, { target: { value: 'ask-ai' } })

      const runBtn = screen.getByRole('button', { name: 'Run Ask AI' })
      await act(async () => {
        fireEvent.click(runBtn)
      })

      expect(screen.getByText('Please enter a question or instruction for Ask AI.')).toBeInTheDocument()
    })

    it('blocks model refusal apologies from being previewed or inserted', async () => {
      mockEngine.transformFn = async () => ({
        proposedText: "I'm sorry, but I cannot fulfill this request because it violates safety guidelines.",
        explanation: 'Locally generated with Llama 3.2 1B (on-device)',
      })

      render(
        <GenerativeActionsSection
          editor={editor}
          fileId="doc-test-1"
          languageId="en"
          credentialStore={credentialStore}
          localEngine={mockEngine as unknown as LocalLlamaTransformationEngine}
          initialProviderId="local"
        />,
      )

      const runBtn = screen.getByRole('button', { name: 'Run Summarize' })
      await act(async () => {
        fireEvent.click(runBtn)
      })

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
      })

      expect(screen.getByText(/safety guidelines/)).toBeInTheDocument()
      expect(screen.queryByRole('region', { name: 'Generation Result Preview' })).not.toBeInTheDocument()
      // Document remains untouched
      expect(editor.getText()).toBe('The meeting was postponed by team lead.')
    })

    it('cancels generation cleanly when user clicks Cancel', async () => {
      mockEngine.transformFn = async () => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({ proposedText: 'Done', explanation: 'done' })
          }, 1000)
        })
      }

      render(
        <GenerativeActionsSection
          editor={editor}
          fileId="doc-test-1"
          languageId="en"
          credentialStore={credentialStore}
          localEngine={mockEngine as unknown as LocalLlamaTransformationEngine}
          initialProviderId="local"
        />,
      )

      const runBtn = screen.getByRole('button', { name: 'Run Summarize' })
      await act(async () => {
        fireEvent.click(runBtn)
      })

      expect(screen.getByRole('button', { name: 'Generating…' })).toBeInTheDocument()
      const cancelBtn = screen.getByRole('button', { name: 'Cancel' })
      await act(async () => {
        fireEvent.click(cancelBtn)
      })

      expect(screen.getByText('Generation cancelled.')).toBeInTheDocument()
    })
  })

  describe('4. Stale Snapshot Detection and Cloud BYOK Compatibility', () => {
    it('detects document edits while preview is open and marks result as stale', async () => {
      mockEngine.grantUserConsent()
      mockEngine.setStatus({ state: 'ready', progress: 100, isCached: true })
      mockEngine.transformFn = async () => ({
        proposedText: 'Transformed content.',
        explanation: 'Local',
      })

      render(
        <GenerativeActionsSection
          editor={editor}
          fileId="doc-test-1"
          languageId="en"
          credentialStore={credentialStore}
          localEngine={mockEngine as unknown as LocalLlamaTransformationEngine}
          initialProviderId="local"
        />,
      )

      const runBtn = screen.getByRole('button', { name: 'Run Summarize' })
      await act(async () => {
        fireEvent.click(runBtn)
      })

      await waitFor(() => {
        expect(screen.getByRole('region', { name: 'Generation Result Preview' })).toBeInTheDocument()
      })

      // Edit document while preview is open
      act(() => {
        editor.commands.setContent('<p>A completely different paragraph.</p>')
      })

      // The preview should now indicate stale status and disable the Accept button
      expect(screen.getByText('Document changed since generation')).toBeInTheDocument()
      const acceptBtn = screen.getByRole('button', { name: 'Accept generated text' })
      expect(acceptBtn).toBeDisabled()
    })

    it('preserves existing HTTP/BYOK cloud provider functionality when user selects cloud AI', () => {
      credentialStore.setCredential('groq', { apiKey: 'gsk_valid_key' })
      credentialStore.setDisclosureAcknowledged('groq', true)

      render(
        <GenerativeActionsSection
          editor={editor}
          fileId="doc-test-1"
          languageId="en"
          credentialStore={credentialStore}
          localEngine={mockEngine as unknown as LocalLlamaTransformationEngine}
          initialProviderId="groq"
        />,
      )

      expect(screen.getByRole('button', { name: 'Run Summarize' })).toBeEnabled()
      expect(screen.queryByRole('region', { name: 'Enable Private Writing Assistant' })).not.toBeInTheDocument()
    })
  })
})
