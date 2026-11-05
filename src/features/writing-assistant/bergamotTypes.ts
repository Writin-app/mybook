export type TranslationDirection = 'en-hi' | 'hi-en'

export type TranslationModelStatus =
  | 'unloaded'
  | 'downloading'
  | 'cached'
  | 'loading'
  | 'ready'
  | 'translating'
  | 'error'
  | 'terminated'

export type TranslationErrorCode =
  | 'NOT_INITIALIZED'
  | 'ALREADY_INITIALIZING'
  | 'UNSUPPORTED_LANGUAGE_PAIR'
  | 'TRANSLATION_ENGINE_UNAVAILABLE'
  | 'EMPTY_INPUT'
  | 'REQUEST_CANCELLED'
  | 'WORKER_TERMINATED'
  | 'MODEL_LOAD_FAILED'
  | 'TRANSLATION_FAILED'
  | 'MISSING_MODEL'
  | 'CORRUPTED_MODEL'
  | 'WORKER_CRASHED'

export interface ModelBuffers {
  model: ArrayBuffer
  lex: ArrayBuffer
  vocab: ArrayBuffer
}

export type WorkerRequest =
  | {
      type: 'INIT'
      requestId: string
      directions: TranslationDirection[]
      buffers?: Partial<Record<TranslationDirection, ModelBuffers>>
      fromCache?: boolean
    }
  | {
      type: 'TRANSLATE'
      requestId: string
      direction: string
      text: string
    }
  | {
      type: 'CANCEL'
      requestId: string
    }
  | {
      type: 'TERMINATE'
      requestId: string
    }

export type WorkerResponse =
  | {
      type: 'INIT_SUCCESS'
      requestId: string
      directions: TranslationDirection[]
      latencyMs: number
    }
  | {
      type: 'TRANSLATE_SUCCESS'
      requestId: string
      direction: TranslationDirection
      targetText: string
      latencyMs: number
      charCount: number
    }
  | {
      type: 'CANCEL_SUCCESS'
      requestId: string
    }
  | {
      type: 'TERMINATE_SUCCESS'
      requestId: string
    }
  | {
      type: 'ERROR'
      requestId: string
      code: TranslationErrorCode
      message: string
      details?: unknown
    }

export interface ModelDownloadProgress {
  direction: TranslationDirection
  loadedBytes: number
  totalBytes: number
  percentage: number
  currentFile: string
}

export interface TranslationMetrics {
  loadTimeMs: number
  translationLatencyMs: number
  inputCharCount: number
  outputCharCount: number
}
