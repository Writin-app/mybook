import type {
  TranslationDirection,
  TranslationErrorCode,
  WorkerRequest,
  WorkerResponse,
  ModelBuffers,
} from './bergamotTypes'

// State tracking within the dedicated translation worker
let status: 'uninitialized' | 'initializing' | 'ready' | 'terminated' = 'uninitialized'
const loadedDirections = new Set<TranslationDirection>()
const cancelledRequestIds = new Set<string>()

/**
 * Resets worker internal state. Used for lifecycle teardown and test isolation.
 */
export function resetWorkerStateForTests(): void {
  status = 'uninitialized'
  loadedDirections.clear()
  cancelledRequestIds.clear()
  activeBackend = null
}

// Translation backend adapter interface
interface TranslationBackend {
  loadModel: (
    direction: TranslationDirection,
    buffers: ModelBuffers
  ) => Promise<void>
  translate: (
    direction: TranslationDirection,
    text: string
  ) => Promise<{ text: string }>
  cleanup: () => Promise<void>
}

let activeBackend: TranslationBackend | null = null

interface CustomError extends Error {
  code?: TranslationErrorCode
}

interface TranslatorGlobal {
  TranslatorBacking?: new () => {
    loadWorker: () => Promise<{
      worker?: { terminate: () => void }
      exports: {
        loadTranslationModel: (pair: { from: string; to: string }, config: unknown) => Promise<void>
        translate: (req: unknown) => Promise<Array<{ target?: { text?: string } }>>
      }
    }>
  }
  postMessage?: (msg: unknown) => void
  close?: () => void
}

function getGlobal(): TranslatorGlobal {
  return globalThis as unknown as TranslatorGlobal
}

/**
 * Validates model buffer integrity.
 * Ensures model binary, shortlist, and vocabulary meet minimum expected sizes.
 */
function validateBuffers(buffers: ModelBuffers): void {
  if (!buffers.model || !buffers.lex || !buffers.vocab) {
    const error: CustomError = new Error('Missing one or more required model buffers (model, lex, vocab)')
    error.code = 'MISSING_MODEL'
    throw error
  }

  // Minimum sanity size: model > 100 KB, lex > 10 KB, vocab > 1 KB
  if (
    buffers.model.byteLength < 100_000 ||
    buffers.lex.byteLength < 10_000 ||
    buffers.vocab.byteLength < 1_000
  ) {
    const error: CustomError = new Error(
      `Corrupted model buffer detected: model=${buffers.model.byteLength}B, lex=${buffers.lex.byteLength}B, vocab=${buffers.vocab.byteLength}B`
    )
    error.code = 'CORRUPTED_MODEL'
    throw error
  }
}

/**
 * Creates the translation backend using Marian NMT WASM or fallback mock in non-WASM environments.
 */
async function createBackend(): Promise<TranslationBackend> {
  const isBrowserWithWasm =
    typeof WebAssembly !== 'undefined' && typeof fetch !== 'undefined'

  const g = getGlobal()
  if (isBrowserWithWasm && typeof g.TranslatorBacking !== 'undefined') {
    const backing = new g.TranslatorBacking()
    const workerHandle = await backing.loadWorker()

    return {
      async loadModel(direction: TranslationDirection, buffers: ModelBuffers) {
        const parts = direction.split('-')
        const from = parts[0] || 'en'
        const to = parts[1] || 'hi'
        await workerHandle.exports.loadTranslationModel(
          { from, to },
          {
            model: buffers.model,
            shortlist: buffers.lex,
            vocabs: [buffers.vocab],
            qualityModel: null,
            config: { 'gemm-precision': 'int8shiftAlphaAll' },
          }
        )
      },
      async translate(direction: TranslationDirection, text: string) {
        const parts = direction.split('-')
        const from = parts[0] || 'en'
        const to = parts[1] || 'hi'
        const trRes = await workerHandle.exports.translate({
          models: [{ from, to }],
          texts: [{ text, html: false }],
        })
        return { text: trRes[0]?.target?.text || '' }
      },
      async cleanup() {
        if (workerHandle?.worker?.terminate) {
          workerHandle.worker.terminate()
        }
      },
    }
  }

  // Engine state when genuine WASM runtime is unavailable
  const loadedMemoryModels = new Map<TranslationDirection, ModelBuffers>()
  return {
    async loadModel(direction: TranslationDirection, buffers: ModelBuffers) {
      validateBuffers(buffers)
      loadedMemoryModels.set(direction, buffers)
    },
    async translate(direction: TranslationDirection) {
      if (!loadedMemoryModels.has(direction)) {
        const err: CustomError = new Error(`Model for direction ${direction} is not loaded`)
        err.code = 'MODEL_LOAD_FAILED'
        throw err
      }
      // Never fabricate a successful translation with synthetic dictionary or canned responses
      const err: CustomError = new Error(
        'On-device Bergamot Marian NMT WASM is not available in this environment. Real model inference cannot run.'
      )
      err.code = 'TRANSLATION_ENGINE_UNAVAILABLE'
      throw err
    },
    async cleanup() {
      loadedMemoryModels.clear()
    },
  }
}

/**
 * Main message handler processing typed WorkerRequest messages.
 */
export async function handleWorkerMessage(
  request: WorkerRequest,
  postMessageFn: (response: WorkerResponse) => void = (resp) => {
    const g = getGlobal()
    if (typeof g.postMessage === 'function') {
      g.postMessage(resp)
    }
  }
): Promise<void> {
  const { type, requestId } = request

  try {
    switch (type) {
      case 'INIT': {
        if (status === 'initializing') {
          postMessageFn({
            type: 'ERROR',
            requestId,
            code: 'ALREADY_INITIALIZING',
            message: 'Worker initialization is already in progress',
          })
          return
        }

        const validDirections = request.directions.filter(
          (d) => d === 'en-hi' || d === 'hi-en'
        )

        // Check if all requested directions are already loaded
        if (status === 'ready' && validDirections.every((d) => loadedDirections.has(d))) {
          postMessageFn({
            type: 'INIT_SUCCESS',
            requestId,
            directions: Array.from(loadedDirections),
            latencyMs: 0,
          })
          return
        }

        status = 'initializing'
        const t0 = performance.now()

        if (!activeBackend) {
          activeBackend = await createBackend()
        }

        for (const dir of validDirections) {
          if (loadedDirections.has(dir)) continue

          let buffers = request.buffers?.[dir]

          // Check CacheStorage if requested and buffers not supplied
          if (!buffers && request.fromCache && typeof caches !== 'undefined') {
            try {
              const cache = await caches.open('writin-translation-cache-v1')
              const files = {
                model: `https://storage.googleapis.com/moz-fx-translations-data--303e-prod-translations-data/models/${dir}/model.${dir.replace('-', '')}.intgemm.alphas.bin`,
                lex: `https://storage.googleapis.com/moz-fx-translations-data--303e-prod-translations-data/models/${dir}/lex.50.50.${dir.replace('-', '')}.s2t.bin`,
                vocab: `https://storage.googleapis.com/moz-fx-translations-data--303e-prod-translations-data/models/${dir}/vocab.${dir.replace('-', '')}.spm`,
              }
              const [mRes, lRes, vRes] = await Promise.all([
                cache.match(files.model),
                cache.match(files.lex),
                cache.match(files.vocab),
              ])
              if (mRes && lRes && vRes) {
                buffers = {
                  model: await mRes.arrayBuffer(),
                  lex: await lRes.arrayBuffer(),
                  vocab: await vRes.arrayBuffer(),
                }
              }
            } catch {
              // Cache read failed
            }
          }

          if (!buffers) {
            status = 'uninitialized'
            postMessageFn({
              type: 'ERROR',
              requestId,
              code: 'MISSING_MODEL',
              message: `Model buffers for direction "${dir}" were not found or not provided`,
            })
            return
          }

          try {
            validateBuffers(buffers)
          } catch (err: unknown) {
            status = 'uninitialized'
            const customErr = err as CustomError
            postMessageFn({
              type: 'ERROR',
              requestId,
              code: customErr.code || 'CORRUPTED_MODEL',
              message: customErr.message,
            })
            return
          }

          await activeBackend.loadModel(dir, buffers)
          loadedDirections.add(dir)
        }

        status = 'ready'
        const elapsed = Math.round(performance.now() - t0)

        postMessageFn({
          type: 'INIT_SUCCESS',
          requestId,
          directions: Array.from(loadedDirections),
          latencyMs: elapsed,
        })
        break
      }

      case 'TRANSLATE': {
        if (status !== 'ready') {
          postMessageFn({
            type: 'ERROR',
            requestId,
            code: 'NOT_INITIALIZED',
            message: 'Translation worker is not initialized. Call INIT before translating.',
          })
          return
        }

        // Validate direction
        if (request.direction !== 'en-hi' && request.direction !== 'hi-en') {
          postMessageFn({
            type: 'ERROR',
            requestId,
            code: 'UNSUPPORTED_LANGUAGE_PAIR',
            message: `Language direction "${request.direction}" is unsupported. Only English <-> Devanagari Hindi is supported.`,
          })
          return
        }

        const direction = request.direction as TranslationDirection
        if (!loadedDirections.has(direction)) {
          postMessageFn({
            type: 'ERROR',
            requestId,
            code: 'MODEL_LOAD_FAILED',
            message: `Translation model for "${direction}" is not loaded in worker.`,
          })
          return
        }

        // Validate text input
        if (!request.text || !request.text.trim()) {
          postMessageFn({
            type: 'ERROR',
            requestId,
            code: 'EMPTY_INPUT',
            message: 'Source text cannot be empty or whitespace only.',
          })
          return
        }

        // Check if pre-cancelled
        if (cancelledRequestIds.has(requestId)) {
          cancelledRequestIds.delete(requestId)
          postMessageFn({
            type: 'ERROR',
            requestId,
            code: 'REQUEST_CANCELLED',
            message: 'Translation request was cancelled by caller before execution.',
          })
          return
        }

        const t0 = performance.now()
        const trRes = await activeBackend!.translate(direction, request.text)
        const elapsed = Math.round(performance.now() - t0)

        // Check if cancelled during translation
        if (cancelledRequestIds.has(requestId)) {
          cancelledRequestIds.delete(requestId)
          postMessageFn({
            type: 'ERROR',
            requestId,
            code: 'REQUEST_CANCELLED',
            message: 'Translation request was cancelled during execution. Discarding output.',
          })
          return
        }

        postMessageFn({
          type: 'TRANSLATE_SUCCESS',
          requestId,
          direction,
          targetText: trRes.text,
          latencyMs: elapsed,
          charCount: trRes.text.length,
        })
        break
      }

      case 'CANCEL': {
        cancelledRequestIds.add(requestId)
        postMessageFn({
          type: 'CANCEL_SUCCESS',
          requestId,
        })
        break
      }

      case 'TERMINATE': {
        if (activeBackend) {
          await activeBackend.cleanup()
          activeBackend = null
        }
        loadedDirections.clear()
        cancelledRequestIds.clear()
        status = 'terminated'

        postMessageFn({
          type: 'TERMINATE_SUCCESS',
          requestId,
        })

        const g = getGlobal()
        if (typeof g.close === 'function') {
          g.close()
        }
        break
      }

      default: {
        const unknownReq = request as { type: string; requestId?: string }
        postMessageFn({
          type: 'ERROR',
          requestId: unknownReq.requestId || 'unknown',
          code: 'TRANSLATION_FAILED',
          message: `Unknown worker operation type: ${unknownReq.type}`,
        })
      }
    }
  } catch (err: unknown) {
    const customErr = err as CustomError
    const code: TranslationErrorCode = customErr.code || 'TRANSLATION_FAILED'
    postMessageFn({
      type: 'ERROR',
      requestId,
      code,
      message: customErr.message || String(err),
      details: customErr.stack,
    })
  }
}

// Bind to worker global scope if running inside a Web Worker
const g = getGlobal()
if (typeof g.postMessage === 'function') {
  ;(globalThis as unknown as { onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null }).onmessage = (
    event: MessageEvent<WorkerRequest>
  ) => {
    handleWorkerMessage(event.data)
  }
}
