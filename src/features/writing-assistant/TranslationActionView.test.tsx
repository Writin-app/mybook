// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TranslationActionView } from './TranslationActionView'
import { modelAssetManager } from './modelAssetManager'

describe('Stage 23.2.B.17 — TranslationActionView UX', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })
  describe('1. Language Classification & Warnings in UI', () => {
    it('detects English source text and defaults target to Hindi', async () => {
      vi.spyOn(modelAssetManager, 'isModelCached').mockResolvedValue(true)

      render(
        <TranslationActionView
          sourceText="Hello, how are you?"
          onTranslate={vi.fn()}
          onCancel={vi.fn()}
        />
      )

      expect(screen.getByText('English')).toBeInTheDocument()
      expect(screen.getByText('Detected')).toBeInTheDocument()
      const select = screen.getByLabelText('Select target language') as HTMLSelectElement
      expect(select.value).toBe('hi')
    })

    it('detects Devanagari Hindi source text and defaults target to English', async () => {
      vi.spyOn(modelAssetManager, 'isModelCached').mockResolvedValue(true)

      render(
        <TranslationActionView
          sourceText="नमस्ते, आप कैसे हैं?"
          onTranslate={vi.fn()}
          onCancel={vi.fn()}
        />
      )

      expect(screen.getByText('Hindi (हिंदी)')).toBeInTheDocument()
      expect(screen.getByText('Detected (Devanagari)')).toBeInTheDocument()
      const select = screen.getByLabelText('Select target language') as HTMLSelectElement
      expect(select.value).toBe('en')
    })

    it('detects Roman Hindi and displays explicit unsupported warning with disabled translate button', async () => {
      const onTranslate = vi.fn()

      render(
        <TranslationActionView
          sourceText="Mujhe office jana hai"
          onTranslate={onTranslate}
          onCancel={vi.fn()}
        />
      )

      expect(screen.getByText('Roman Hindi')).toBeInTheDocument()
      expect(screen.getByText('Unsupported Language Input')).toBeInTheDocument()
      expect(
        screen.getByText(/Roman Hindi \(Latin script\) is not supported for offline translation/i)
      ).toBeInTheDocument()

      const translateBtn = screen.getByRole('button', { name: /start offline translation/i })
      expect(translateBtn).toBeDisabled()
      fireEvent.click(translateBtn)
      expect(onTranslate).not.toHaveBeenCalled()
    })

    it('detects Hinglish ("Aaj meeting hai at 5 PM") and displays explicit unsupported warning', async () => {
      const onTranslate = vi.fn()

      render(
        <TranslationActionView
          sourceText="Aaj meeting hai at 5 PM"
          onTranslate={onTranslate}
          onCancel={vi.fn()}
        />
      )

      expect(screen.getByText('Hinglish')).toBeInTheDocument()
      expect(screen.getByText('Unsupported Language Input')).toBeInTheDocument()
      expect(
        screen.getByText(/Hinglish \(mixed Hindi-English\) is not supported for offline translation/i)
      ).toBeInTheDocument()

      const translateBtn = screen.getByRole('button', { name: /start offline translation/i })
      expect(translateBtn).toBeDisabled()
    })

    it('detects Hinglish ("Main kal office jaunga because I have a meeting") and blocks translation', async () => {
      render(
        <TranslationActionView
          sourceText="Main kal office jaunga because I have a meeting"
          onTranslate={vi.fn()}
          onCancel={vi.fn()}
        />
      )

      expect(screen.getByText('Hinglish')).toBeInTheDocument()
      expect(screen.getByText(/Hinglish \(mixed Hindi-English\) is not supported/i)).toBeInTheDocument()
    })
  })

  describe('2. Language Swap Control', () => {
    it('swaps source and target language when valid', async () => {
      vi.spyOn(modelAssetManager, 'isModelCached').mockResolvedValue(true)

      render(
        <TranslationActionView
          sourceText="This is an important project"
          onTranslate={vi.fn()}
          onCancel={vi.fn()}
        />
      )

      expect(screen.getByText('English')).toBeInTheDocument()
      const select = screen.getByLabelText('Select target language') as HTMLSelectElement
      expect(select.value).toBe('hi')

      const swapBtn = screen.getByRole('button', { name: /swap source and target/i })
      expect(swapBtn).not.toBeDisabled()

      fireEvent.click(swapBtn)

      // Now From: Hindi, To: English
      expect(screen.getByText('Hindi (हिंदी)')).toBeInTheDocument()
      expect(select.value).toBe('en')
    })
  })

  describe('3. Model Download Flow & Feedback', () => {
    it('prompts user with exact ~14.9 MB download prompt when model is not cached', async () => {
      vi.spyOn(modelAssetManager, 'isModelCached').mockResolvedValue(false)

      render(
        <TranslationActionView
          sourceText="Hello, how are you?"
          onTranslate={vi.fn()}
          onCancel={vi.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Offline Translation Model Required')).toBeInTheDocument()
        expect(screen.getByText('~14.9 MB')).toBeInTheDocument()
      })

      expect(screen.getByRole('button', { name: /download translation model and translate/i })).toBeInTheDocument()
    })

    it('displays active download progress bar and percentage during download', () => {
      render(
        <TranslationActionView
          sourceText="Hello, how are you?"
          onTranslate={vi.fn()}
          onCancel={vi.fn()}
          downloadProgress={{
            state: 'downloading',
            progress: 42,
            message: 'Downloading model.enhi.intgemm.alphas.bin.gz (42%)…',
            currentFile: 'model.enhi.intgemm.alphas.bin.gz',
          }}
        />
      )

      expect(screen.getByText('Downloading Translation Model…')).toBeInTheDocument()
      expect(screen.getByText('42%')).toBeInTheDocument()
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42')
      expect(screen.getByRole('button', { name: /cancel model download/i })).toBeInTheDocument()
    })

    it('cancels active download when cancel button is clicked', () => {
      const onCancel = vi.fn()

      render(
        <TranslationActionView
          sourceText="Hello, how are you?"
          onTranslate={vi.fn()}
          onCancel={onCancel}
          downloadProgress={{
            state: 'downloading',
            progress: 75,
            message: 'Downloading lex.50.50.enhi.s2t.bin.gz…',
          }}
        />
      )

      const cancelBtn = screen.getByRole('button', { name: /cancel model download/i })
      fireEvent.click(cancelBtn)
      expect(onCancel).toHaveBeenCalledTimes(1)
    })

    it('displays local translating spinner when inference is running in worker', () => {
      const onCancel = vi.fn()

      render(
        <TranslationActionView
          sourceText="Hello, how are you?"
          onTranslate={vi.fn()}
          onCancel={onCancel}
          isTranslating={true}
        />
      )

      expect(screen.getByText('Translating text offline…')).toBeInTheDocument()
      expect(screen.getByText(/Inference runs locally using Bergamot Marian WASM/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel active translation/i })).toBeInTheDocument()
    })
  })
})
