import type {
  EngineAvailability,
  GenerationContext,
  TransformationEngine,
} from './contracts'
import {
  type TranslationValidationResult,
  validateTranslationRequest,
} from './translationCapabilityRegistry'
import {
  type ModelAssetManager,
  modelAssetManager as defaultModelAssetManager,
} from './modelAssetManager'
import {
  type BergamotWorkerClientOptions,
  BergamotWorkerClient,
} from './bergamotWorkerClient'
import type {
  ModelDownloadProgress,
  TranslationDirection,
  TranslationModelStatus,
} from '../../prototype/translation/types'
import { validateAndCleanGenerativeOutput } from './outputValidation'

export type BergamotLifecycleState = TranslationModelStatus

export class BergamotEngineError extends Error {
  readonly code: string
  readonly engineName = 'bergamot-translator'
  readonly direction?: TranslationDirection
  readonly workerState?: string
  readonly details?: unknown

  constructor(
    message: string,
    options: {
      code: string
      direction?: TranslationDirection
      workerState?: string
      details?: unknown
    }
  ) {
    super(message)
    this.name = 'BergamotEngineError'
    this.code = options.code
    this.direction = options.direction
    this.workerState = options.workerState
    this.details = options.details
  }
}

export interface BergamotEngineStatusReport {
  state: BergamotLifecycleState
  progress: number
  message: string
  currentFile?: string
  error?: string
}

export type BergamotEngineStatusListener = (report: BergamotEngineStatusReport) => void

export interface BergamotEngineOptions {
  workerClient?: BergamotWorkerClient
  workerClientOptions?: BergamotWorkerClientOptions
  assetManager?: ModelAssetManager
}

export class BergamotTransformationEngine implements TransformationEngine {
  readonly id = 'bergamot-translator'
  readonly capabilities: TransformationEngine['capabilities']

  private readonly workerClient: BergamotWorkerClient
  private readonly assetManager: ModelAssetManager
  private statusReport: BergamotEngineStatusReport
  private readonly listeners = new Set<BergamotEngineStatusListener>()

  constructor(options: BergamotEngineOptions = {}) {
    this.workerClient =
      options.workerClient || new BergamotWorkerClient(options.workerClientOptions)
    this.assetManager = options.assetManager || defaultModelAssetManager

    this.capabilities = {
      supports: [
        {
          capability: 'translation',
          languages: [
            { tag: 'en', includeSubtags: true },
            { tag: 'hi', includeSubtags: true },
          ],
        },
      ],
    }

    this.statusReport = {
      state: 'unloaded',
      progress: 0,
      message: 'Bergamot translation engine is ready for on-demand initialization.',
    }
  }

  public getStatus(): BergamotEngineStatusReport {
    return { ...this.statusReport }
  }

  public subscribeStatus(listener: BergamotEngineStatusListener): () => void {
    this.listeners.add(listener)
    listener(this.getStatus())
    return () => {
      this.listeners.delete(listener)
    }
  }

  private updateStatus(patch: Partial<BergamotEngineStatusReport>): void {
    this.statusReport = { ...this.statusReport, ...patch }
    for (const listener of this.listeners) {
      try {
        listener(this.getStatus())
      } catch {
        // Suppress listener errors
      }
    }
  }

  /**
   * Checks browser environment readiness (WASM, Worker, and storage availability).
   */
  public async getAvailability(): Promise<EngineAvailability> {
    const hasWasm = typeof WebAssembly !== 'undefined'
    const hasWorker =
      Boolean(this.workerClient) ||
      typeof Worker !== 'undefined' ||
      typeof (globalThis as unknown as { Worker?: unknown }).Worker !== 'undefined'

    if (!hasWasm) {
      return {
        available: false,
        reason: 'WebAssembly (WASM) is not supported in this browser.',
      }
    }

    if (!hasWorker) {
      return {
        available: false,
        reason: 'Web Workers are not supported in this browser.',
      }
    }

    const storage = await this.assetManager.estimateStorage()
    if (storage.supported && storage.isSufficient === false) {
      return {
        available: false,
        reason: 'Insufficient device storage available to download translation models (at least 40MB required).',
      }
    }

    return { available: true }
  }

  /**
   * Execute translation transformation with input validation, on-demand model download,
   * worker initialization, and output safety validation.
   */
  public async transform(
    context: GenerationContext,
    signal?: AbortSignal
  ): Promise<{ proposedText: string; explanation?: string }> {
    if (signal?.aborted) {
      throw new DOMException('Translation was cancelled', 'AbortError')
    }

    if (context.actionId !== 'translate') {
      throw new BergamotEngineError(`Bergamot engine only handles translation actions (received "${context.actionId}").`, {
        code: 'INVALID_ACTION',
      })
    }

    // 1. Validate translation request, script requirements, and language pairing
    const targetLangOption = context.options?.targetLanguage as string | undefined
    const validation: TranslationValidationResult = validateTranslationRequest(
      context.text,
      context.languageTag,
      targetLangOption
    )

    if (!validation.isValid) {
      throw new BergamotEngineError(validation.reason, {
        code: 'UNSUPPORTED_LANGUAGE',
      })
    }

    const direction: TranslationDirection = validation.direction

    // 2. Download model assets on demand if not already cached
    let buffers = await this.assetManager.getCachedModelBuffers(direction)
    if (!buffers) {
      this.updateStatus({
        state: 'downloading',
        progress: 0,
        message: `Downloading offline translation model for ${validation.sourceLanguage} ↔ ${validation.targetLanguage}...`,
      })

      try {
        buffers = await this.assetManager.downloadModel(
          direction,
          (progress: ModelDownloadProgress) => {
            this.updateStatus({
              state: 'downloading',
              progress: progress.percentage,
              currentFile: progress.currentFile,
              message: `Downloading ${progress.currentFile} (${progress.percentage}%)...`,
            })
          },
          signal
        )
      } catch (err) {
        if (signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
          this.updateStatus({ state: 'unloaded', progress: 0, message: 'Download cancelled.' })
          throw new DOMException('Translation was cancelled', 'AbortError')
        }
        this.updateStatus({
          state: 'error',
          error: err instanceof Error ? err.message : String(err),
          message: 'Failed to download translation model.',
        })
        throw new BergamotEngineError(
          err instanceof Error ? err.message : 'Failed to download translation model.',
          { code: 'DOWNLOAD_FAILED', direction, details: err }
        )
      }
    }

    if (signal?.aborted) {
      throw new DOMException('Translation was cancelled', 'AbortError')
    }

    // 3. Ensure worker is initialized for the requested direction
    if (!this.workerClient.isReady(direction)) {
      this.updateStatus({
        state: 'loading',
        progress: 95,
        message: 'Initializing translation engine in worker...',
      })

      try {
        await this.workerClient.initialize({
          directions: [direction],
          buffers: { [direction]: buffers },
        })
      } catch (err) {
        this.updateStatus({
          state: 'error',
          error: err instanceof Error ? err.message : String(err),
          message: 'Failed to initialize translation worker.',
        })
        throw new BergamotEngineError(
          err instanceof Error ? err.message : 'Failed to initialize translation worker.',
          { code: 'WORKER_INIT_FAILED', direction, workerState: this.workerClient.getStatus(), details: err }
        )
      }
    }

    if (signal?.aborted) {
      throw new DOMException('Translation was cancelled', 'AbortError')
    }

    // 4. Translate via worker
    this.updateStatus({
      state: 'translating',
      progress: 100,
      message: 'Translating text...',
    })

    let translationOutcome: { targetText: string; latencyMs: number }
    try {
      translationOutcome = await this.workerClient.translate({
        direction,
        text: context.text,
      })
    } catch (err) {
      this.updateStatus({
        state: 'ready',
        error: err instanceof Error ? err.message : String(err),
        message: 'Translation failed in worker.',
      })
      throw new BergamotEngineError(
        err instanceof Error ? err.message : 'Translation failed in worker.',
        {
          code: 'code' in (err as { code?: string }) ? String((err as { code: string }).code) : 'TRANSLATION_FAILED',
          direction,
          workerState: this.workerClient.getStatus(),
          details: err,
        }
      )
    }

    // 5. Output quality & safety validation
    const outputValidation = validateAndCleanGenerativeOutput({
      rawText: translationOutcome.targetText,
      actionId: 'translate',
      sourceText: context.text,
      targetLanguage: validation.targetLanguage,
      languageTag: context.languageTag,
    })

    if (!outputValidation.isValid) {
      this.updateStatus({
        state: 'ready',
        error: outputValidation.errorMessage,
        message: 'Translation output rejected by safety/quality checks.',
      })
      throw new BergamotEngineError(
        outputValidation.errorMessage || 'Translation output did not meet safety and quality criteria.',
        {
          code: outputValidation.errorCode || 'VALIDATION_FAILED',
          direction,
          workerState: this.workerClient.getStatus(),
        }
      )
    }

    this.updateStatus({
      state: 'ready',
      message: `Translation complete in ${translationOutcome.latencyMs}ms.`,
    })

    return {
      proposedText: outputValidation.cleanedText,
      explanation: `Translated with on-device Bergamot Marian NMT (${translationOutcome.latencyMs}ms).`,
    }
  }

  /**
   * Terminate worker resources and reset state.
   */
  public async terminate(): Promise<void> {
    await this.workerClient.terminate()
    this.updateStatus({
      state: 'terminated',
      progress: 0,
      message: 'Bergamot translation engine terminated.',
    })
  }
}

let sharedBergamotEngine: BergamotTransformationEngine | null = null

export function getSharedBergamotEngine(): BergamotTransformationEngine {
  if (!sharedBergamotEngine) {
    sharedBergamotEngine = new BergamotTransformationEngine()
  }
  return sharedBergamotEngine
}

export function resetSharedBergamotEngine(): void {
  if (sharedBergamotEngine) {
    sharedBergamotEngine.terminate().catch(() => {})
    sharedBergamotEngine = null
  }
}
