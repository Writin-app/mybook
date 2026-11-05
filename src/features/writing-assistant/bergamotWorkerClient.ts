import type {
  TranslationDirection,
  TranslationModelStatus,
  TranslationErrorCode,
  WorkerRequest,
  WorkerResponse,
  ModelBuffers,
} from '../../prototype/translation/types'
import { getBergamotWorkerUrl } from './modelAssetManager'

export interface BergamotWorkerClientOptions {
  workerFactory?: () => Worker
  workerScriptUrl?: string
  defaultTimeoutMs?: number
}

export class BergamotWorkerError extends Error {
  public code: TranslationErrorCode
  public requestId: string
  public details?: unknown

  constructor(code: TranslationErrorCode, message: string, requestId: string, details?: unknown) {
    super(`[${code}] ${message}`)
    this.name = 'BergamotWorkerError'
    this.code = code
    this.requestId = requestId
    this.details = details
  }
}

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer?: ReturnType<typeof setTimeout>
}

/**
 * Main-thread bridge to Mozilla Bergamot Translator Web Worker.
 * Communicates via the official Bergamot worker message protocol:
 *   { id, name, args } -> { id, result } | { id, error }
 * with backward-compatible support for legacy/mock worker messages:
 *   WorkerRequest -> WorkerResponse
 */
export class BergamotWorkerClient {
  private worker: Worker | null = null
  private status: TranslationModelStatus = 'unloaded'
  private wasmServiceInitialized = false
  private readonly loadedDirections = new Set<TranslationDirection>()
  private readonly pendingRequests = new Map<string, PendingRequest>()
  private serial = 0
  private readonly defaultTimeoutMs: number
  private readonly workerFactory?: () => Worker
  private readonly workerScriptUrl?: string

  constructor(options: BergamotWorkerClientOptions = {}) {
    this.defaultTimeoutMs = options.defaultTimeoutMs || 25_000
    this.workerFactory = options.workerFactory
    this.workerScriptUrl = options.workerScriptUrl
  }

  public getStatus(): TranslationModelStatus {
    return this.status
  }

  public isReady(direction: TranslationDirection): boolean {
    return this.status === 'ready' && this.loadedDirections.has(direction)
  }

  public getLoadedDirections(): TranslationDirection[] {
    return Array.from(this.loadedDirections)
  }

  private generateRequestId(prefix: string): string {
    return `${prefix}_${Date.now()}_${++this.serial}`
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker

    if (this.workerFactory) {
      this.worker = this.workerFactory()
    } else if (typeof Worker !== 'undefined') {
      const scriptUrl = this.workerScriptUrl || getBergamotWorkerUrl('translator-worker.js')
      this.worker = new Worker(scriptUrl)
    } else {
      throw new Error('Web Worker is not supported in the current environment.')
    }

    this.worker.onmessage = (event: MessageEvent<unknown>) => {
      this.handleWorkerResponse(event.data)
    }

    this.worker.onerror = (err: unknown) => {
      this.status = 'error'
      this.wasmServiceInitialized = false
      const errorMsg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Bergamot Web Worker encountered an unhandled error or crash'

      const crashError = new BergamotWorkerError('WORKER_CRASHED', errorMsg, 'system', err)

      // Reject all pending requests
      for (const [id, pending] of this.pendingRequests.entries()) {
        if (pending.timer) clearTimeout(pending.timer)
        pending.reject(crashError)
        this.pendingRequests.delete(id)
      }

      // Reset worker for crash recovery on subsequent attempt
      try {
        this.worker?.terminate()
      } catch {
        // Best effort
      }
      this.worker = null
      this.loadedDirections.clear()
    }

    return this.worker
  }

  private handleWorkerResponse(data: unknown): void {
    if (!data || typeof data !== 'object') return

    const officialMsg = data as {
      id?: string | number
      result?: unknown
      error?: { name?: string; message?: string; stack?: string }
    }
    const legacyMsg = data as WorkerResponse

    const requestId = String(officialMsg.id ?? legacyMsg.requestId ?? '')
    const pending = this.pendingRequests.get(requestId)
    if (!pending) return

    if (pending.timer) {
      clearTimeout(pending.timer)
    }
    this.pendingRequests.delete(requestId)

    // 1. Error responses
    if (officialMsg.error !== undefined) {
      const err = officialMsg.error
      const message = err.message || 'Bergamot worker error'
      let code: TranslationErrorCode = 'TRANSLATION_FAILED'

      if (message.includes('not found') || message.includes('No model') || message.includes('is not loaded')) {
        code = 'MISSING_MODEL'
      } else if (message.includes('corrupt') || message.includes('Corrupted')) {
        code = 'CORRUPTED_MODEL'
      } else if (message.includes('unavailable') || message.includes('not available')) {
        code = 'TRANSLATION_ENGINE_UNAVAILABLE'
      } else if (message.includes('memory') || message.includes('out of memory')) {
        code = 'WORKER_CRASHED'
      }

      this.status = 'error'
      pending.reject(new BergamotWorkerError(code, message, requestId, err))
      return
    }

    if (legacyMsg.type === 'ERROR') {
      this.status = 'error'
      pending.reject(
        new BergamotWorkerError(legacyMsg.code, legacyMsg.message, requestId, legacyMsg.details)
      )
      return
    }

    // 2. Official worker protocol responses
    if (officialMsg.id !== undefined && !legacyMsg.type) {
      this.status = 'ready'
      pending.resolve(officialMsg.result)
      return
    }

    // 3. Legacy worker responses
    if (legacyMsg.type === 'INIT_SUCCESS') {
      this.status = 'ready'
      this.wasmServiceInitialized = true
      for (const dir of legacyMsg.directions) {
        this.loadedDirections.add(dir)
      }
      pending.resolve(legacyMsg)
    } else if (legacyMsg.type === 'TRANSLATE_SUCCESS') {
      this.status = 'ready'
      pending.resolve(legacyMsg)
    } else if (legacyMsg.type === 'CANCEL_SUCCESS') {
      pending.resolve(legacyMsg)
    } else if (legacyMsg.type === 'TERMINATE_SUCCESS') {
      this.status = 'terminated'
      this.wasmServiceInitialized = false
      this.loadedDirections.clear()
      pending.resolve(legacyMsg)
    }
  }

  /**
   * Send a call to the worker using the official Bergamot protocol { id, name, args },
   * while attaching legacy fields to ensure compatibility with mock/test workers.
   */
  private async callWorker<T>(
    name: string,
    args: unknown[],
    timeoutMs: number,
    legacyPayload?: Partial<WorkerRequest>
  ): Promise<T> {
    const worker = this.ensureWorker()
    const requestId = this.generateRequestId(name)

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        const errorCode: TranslationErrorCode =
          name === 'translate' ? 'TRANSLATION_FAILED' : 'MODEL_LOAD_FAILED'
        reject(
          new BergamotWorkerError(
            errorCode,
            `Worker call '${name}' timed out after ${timeoutMs}ms`,
            requestId
          )
        )
      }, timeoutMs)

      this.pendingRequests.set(requestId, {
        resolve: resolve as (val: unknown) => void,
        reject,
        timer,
      })

      const message = {
        id: requestId,
        requestId,
        name,
        args,
        ...legacyPayload,
      }

      worker.postMessage(message)
    })
  }

  /**
   * Initialize worker WASM runtime and load translation models for specified directions.
   */
  public async initialize(params: {
    directions: TranslationDirection[]
    buffers?: Partial<Record<TranslationDirection, ModelBuffers>>
    fromCache?: boolean
    timeoutMs?: number
  }): Promise<{ directions: TranslationDirection[]; latencyMs: number }> {
    this.status = 'loading'
    const timeoutMs = params.timeoutMs || this.defaultTimeoutMs
    const t0 = performance.now()

    // 1. Initialize WASM module and BlockingService in the official worker
    if (!this.wasmServiceInitialized) {
      await this.callWorker(
        'initialize',
        [{ useNativeIntGemm: false, cacheSize: 0 }],
        timeoutMs,
        {
          type: 'INIT',
          directions: params.directions,
          buffers: params.buffers,
          fromCache: params.fromCache,
        }
      )
      this.wasmServiceInitialized = true
    }

    // 2. Load model assets for each direction
    for (const dir of params.directions) {
      const bufferSet = params.buffers?.[dir]
      if (bufferSet && !this.loadedDirections.has(dir)) {
        const [from, to] = dir.split('-') as [string, string]
        await this.callWorker(
          'loadTranslationModel',
          [
            { from, to },
            {
              model: bufferSet.model,
              shortlist: bufferSet.lex,
              vocabs: [bufferSet.vocab],
              qualityModel: null,
              config: { 'gemm-precision': 'int8shiftAlphaAll' },
            },
          ],
          timeoutMs,
          {
            type: 'INIT',
            directions: [dir],
            buffers: { [dir]: bufferSet },
          }
        )
        this.loadedDirections.add(dir)
      }
    }

    this.status = 'ready'
    const latencyMs = Math.round(performance.now() - t0)
    return {
      directions: Array.from(this.loadedDirections),
      latencyMs,
    }
  }

  /**
   * Translate text using loaded Marian NMT WASM model.
   */
  public async translate(params: {
    direction: string
    text: string
    timeoutMs?: number
  }): Promise<{ targetText: string; latencyMs: number; charCount: number }> {
    this.status = 'translating'
    const timeoutMs = params.timeoutMs || this.defaultTimeoutMs
    const t0 = performance.now()
    const [from, to] = params.direction.split('-') as [string, string]

    const response = await this.callWorker<unknown>(
      'translate',
      [
        {
          models: [{ from, to }],
          texts: [{ text: params.text, html: false }],
        },
      ],
      timeoutMs,
      {
        type: 'TRANSLATE',
        direction: params.direction,
        text: params.text,
      }
    )

    this.status = 'ready'
    const latencyMs = Math.round(performance.now() - t0)

    let targetText = ''
    if (Array.isArray(response) && response[0]?.target?.text !== undefined) {
      targetText = String(response[0].target.text)
    } else if (response && typeof response === 'object' && 'targetText' in response) {
      targetText = String((response as { targetText: unknown }).targetText)
    } else if (typeof response === 'string') {
      targetText = response
    }

    return {
      targetText,
      latencyMs,
      charCount: params.text.length,
    }
  }

  /**
   * Check if a translation model direction is loaded in the worker.
   */
  public async hasTranslationModel(direction: TranslationDirection): Promise<boolean> {
    if (this.loadedDirections.has(direction)) return true
    if (!this.worker || !this.wasmServiceInitialized) return false
    const [from, to] = direction.split('-') as [string, string]
    try {
      const res = await this.callWorker<boolean>('hasTranslationModel', [{ from, to }], 3000)
      if (res) this.loadedDirections.add(direction)
      return Boolean(res)
    } catch {
      return false
    }
  }

  /**
   * Free model memory inside the worker.
   */
  public async freeTranslationModel(direction: TranslationDirection): Promise<void> {
    if (!this.worker) return
    const [from, to] = direction.split('-') as [string, string]
    try {
      await this.callWorker('freeTranslationModel', [{ from, to }], 3000)
    } finally {
      this.loadedDirections.delete(direction)
    }
  }

  /**
   * Cancel an in-flight request by ID.
   */
  public async cancel(requestId: string): Promise<void> {
    const pending = this.pendingRequests.get(requestId)
    if (pending) {
      if (pending.timer) clearTimeout(pending.timer)
      this.pendingRequests.delete(requestId)
      pending.reject(
        new BergamotWorkerError('REQUEST_CANCELLED', 'Request was cancelled by user', requestId)
      )
    }

    if (this.worker) {
      try {
        this.worker.postMessage({
          id: requestId,
          name: 'cancel',
          type: 'CANCEL',
          requestId,
        })
      } catch {
        // Best effort
      }
    }
  }

  /**
   * Terminate the worker and release all memory.
   */
  public async terminate(): Promise<void> {
    if (!this.worker) {
      this.status = 'terminated'
      this.wasmServiceInitialized = false
      return
    }

    const workerToTerminate = this.worker
    this.worker = null
    this.status = 'terminated'
    this.wasmServiceInitialized = false
    this.loadedDirections.clear()

    // Cancel all pending timers and reject with WORKER_TERMINATED
    for (const [id, pending] of this.pendingRequests.entries()) {
      if (pending.timer) clearTimeout(pending.timer)
      pending.reject(
        new BergamotWorkerError('WORKER_TERMINATED', 'Worker was terminated by caller', id)
      )
    }
    this.pendingRequests.clear()

    try {
      workerToTerminate.terminate()
    } catch {
      // Best effort
    }
  }
}
