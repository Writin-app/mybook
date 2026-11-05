import type { TranslationDirection, ModelBuffers, ModelDownloadProgress } from './bergamotTypes'

export interface ModelFilePaths {
  model: string
  lex: string
  vocab: string
  modelSha256?: string
  lexSha256?: string
  vocabSha256?: string
  decompressedModelSha256?: string
  decompressedLexSha256?: string
  decompressedVocabSha256?: string
}

/**
 * Resolves the same-origin URL for Bergamot model assets using Vite's configured base URL.
 */
export function getBergamotModelUrl(direction: TranslationDirection, filename: string): string {
  const baseUrl =
    typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
      ? import.meta.env.BASE_URL
      : '/'
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const cleanDir = direction.replace(/^\/+|\/+$/g, '')
  const cleanFile = filename.replace(/^\/+/, '')
  return `${normalizedBase}bergamot/models/${cleanDir}/${cleanFile}`
}

/**
 * Official remote upstream Mozilla Google Cloud Storage model URLs.
 * Retained for provenance, verification, and cache key backward compatibility.
 */
export const MOZILLA_REMOTE_MODEL_REGISTRY: Record<TranslationDirection, ModelFilePaths> = {
  'en-hi': {
    model:
      'https://storage.googleapis.com/moz-fx-translations-data--303e-prod-translations-data/models/en-hi/h1-2025_KoJuCNf_Q42R2Bz6j2jlOQ/exported/model.enhi.intgemm.alphas.bin.gz',
    lex:
      'https://storage.googleapis.com/moz-fx-translations-data--303e-prod-translations-data/models/en-hi/h1-2025_KoJuCNf_Q42R2Bz6j2jlOQ/exported/lex.50.50.enhi.s2t.bin.gz',
    vocab:
      'https://storage.googleapis.com/moz-fx-translations-data--303e-prod-translations-data/models/en-hi/h1-2025_KoJuCNf_Q42R2Bz6j2jlOQ/exported/vocab.enhi.spm.gz',
    modelSha256: '751032330fe04b9dd4e1245c4dcf8f58dd6836daa7ed3f3b93be52eb1fca9ba4',
    lexSha256: 'ce5f1dd9d4fb343cb6e0da91e4603e50b673b91ea22b50b959a0dc199d4e9dd9',
    vocabSha256: 'bb3bf8252b14fa57100beb371824cf51a7281e833a3becec135721fe679ce076',
    decompressedModelSha256: '18682fa6aa1c1b2f78a6fcbcb354755094d623e65436ef7821720c5213e11a49',
    decompressedLexSha256: 'b473f6fe41cdb7c1dbeeb714fc50314feab77b0af2b2da6f7830ee14492dd847',
    decompressedVocabSha256: '8017cbf812bae400794c424699b89de90db06ac7a4ca67a420013a9f68b270c1',
  },
  'hi-en': {
    model:
      'https://storage.googleapis.com/moz-fx-translations-data--303e-prod-translations-data/models/hi-en/h1-2025_IcUQD-GbSJWB6WV08oDoEw/exported/model.hien.intgemm.alphas.bin.gz',
    lex:
      'https://storage.googleapis.com/moz-fx-translations-data--303e-prod-translations-data/models/hi-en/h1-2025_IcUQD-GbSJWB6WV08oDoEw/exported/lex.50.50.hien.s2t.bin.gz',
    vocab:
      'https://storage.googleapis.com/moz-fx-translations-data--303e-prod-translations-data/models/hi-en/h1-2025_IcUQD-GbSJWB6WV08oDoEw/exported/vocab.hien.spm.gz',
    modelSha256: 'd30d257188bec64fceeb37483a6be8c54f1246583ad4e4f99dda174b630afeb3',
    lexSha256: '9647fd7a38db4bafa549f73bf34cabd5a415cd34f3acd7212fced93f163dbd49',
    vocabSha256: '7554161ff543abf09200b4feec83328259b0acb0e58003d834ad43bac47f6124',
    decompressedModelSha256: 'c82fd6ed3794b79fb9dde0718a22324502a408a9eca73497b5d0a4b8024ec6de',
    decompressedLexSha256: 'e789be33dfdb639e98f5cf9eb01aa945ec3c882f68f3c8860389cf846f0112d8',
    decompressedVocabSha256: '9cbc02094ac2ebd75211b3bb6789a9d6fa112ce3c08e897f1645f18b21fbab00',
  },
}

/**
 * Same-origin model registry hosted locally under /bergamot/models/.
 * Eliminates upstream CORS failures on first-time download.
 */
export const SAME_ORIGIN_MODEL_REGISTRY: Record<TranslationDirection, ModelFilePaths> = {
  'en-hi': {
    model: getBergamotModelUrl('en-hi', 'model.enhi.intgemm.alphas.bin.gz'),
    lex: getBergamotModelUrl('en-hi', 'lex.50.50.enhi.s2t.bin.gz'),
    vocab: getBergamotModelUrl('en-hi', 'vocab.enhi.spm.gz'),
    modelSha256: '751032330fe04b9dd4e1245c4dcf8f58dd6836daa7ed3f3b93be52eb1fca9ba4',
    lexSha256: 'ce5f1dd9d4fb343cb6e0da91e4603e50b673b91ea22b50b959a0dc199d4e9dd9',
    vocabSha256: 'bb3bf8252b14fa57100beb371824cf51a7281e833a3becec135721fe679ce076',
    decompressedModelSha256: '18682fa6aa1c1b2f78a6fcbcb354755094d623e65436ef7821720c5213e11a49',
    decompressedLexSha256: 'b473f6fe41cdb7c1dbeeb714fc50314feab77b0af2b2da6f7830ee14492dd847',
    decompressedVocabSha256: '8017cbf812bae400794c424699b89de90db06ac7a4ca67a420013a9f68b270c1',
  },
  'hi-en': {
    model: getBergamotModelUrl('hi-en', 'model.hien.intgemm.alphas.bin.gz'),
    lex: getBergamotModelUrl('hi-en', 'lex.50.50.hien.s2t.bin.gz'),
    vocab: getBergamotModelUrl('hi-en', 'vocab.hien.spm.gz'),
    modelSha256: 'd30d257188bec64fceeb37483a6be8c54f1246583ad4e4f99dda174b630afeb3',
    lexSha256: '9647fd7a38db4bafa549f73bf34cabd5a415cd34f3acd7212fced93f163dbd49',
    vocabSha256: '7554161ff543abf09200b4feec83328259b0acb0e58003d834ad43bac47f6124',
    decompressedModelSha256: 'c82fd6ed3794b79fb9dde0718a22324502a408a9eca73497b5d0a4b8024ec6de',
    decompressedLexSha256: 'e789be33dfdb639e98f5cf9eb01aa945ec3c882f68f3c8860389cf846f0112d8',
    decompressedVocabSha256: '9cbc02094ac2ebd75211b3bb6789a9d6fa112ce3c08e897f1645f18b21fbab00',
  },
}

/**
 * Default model registry used by BergamotEngine and ModelAssetManager.
 * Points to same-origin model hosting by default.
 */
export const MOZILLA_MODEL_REGISTRY: Record<TranslationDirection, ModelFilePaths> =
  SAME_ORIGIN_MODEL_REGISTRY

/**
 * Computes hexadecimal SHA-256 digest of an ArrayBuffer.
 */
export async function computeBufferSha256(buffer: ArrayBuffer): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
    try {
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
    } catch {
      return ''
    }
  }
  return ''
}

/**
 * Detects whether an ArrayBuffer contains raw gzip magic bytes (0x1F, 0x8B).
 */
export function isGzipBuffer(buffer: ArrayBuffer): boolean {
  if (!buffer || buffer.byteLength < 2) return false
  const view = new Uint8Array(buffer, 0, 2)
  return view[0] === 0x1f && view[1] === 0x8b
}

/**
 * Safely decompresses a gzip ArrayBuffer using browser-native DecompressionStream.
 * If the buffer is not gzip (already uncompressed), it returns the buffer untouched.
 */
export async function decompressGzipBuffer(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  if (!isGzipBuffer(buffer)) {
    return buffer
  }

  if (typeof DecompressionStream !== 'undefined') {
    try {
      const stream = new Response(buffer).body!.pipeThrough(new DecompressionStream('gzip'))
      return await new Response(stream).arrayBuffer()
    } catch (err) {
      throw new Error(`Failed to decompress gzip model asset: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Node.js test environment fallback
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      const zlib = await import('node:zlib')
      const decompressed = zlib.gunzipSync(Buffer.from(buffer))
      return decompressed.buffer.slice(
        decompressed.byteOffset,
        decompressed.byteOffset + decompressed.byteLength
      ) as ArrayBuffer
    } catch (err) {
      throw new Error(`Failed to decompress gzip buffer via node:zlib: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  throw new Error('DecompressionStream is not supported in the current environment.')
}

/**
 * Resolves the URL for Bergamot worker assets using Vite's configured base URL.
 */
export function getBergamotWorkerUrl(path = 'translator-worker.js'): string {
  const baseUrl =
    typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
      ? import.meta.env.BASE_URL
      : '/'
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const cleanPath = path.startsWith('/') ? path.slice(1) : path
  return `${normalizedBase}bergamot/${cleanPath}`
}

export const BERGAMOT_CACHE_NAME = 'writin-bergamot-models-v2'
export const LEGACY_BERGAMOT_CACHE_NAME = 'writin-translation-cache-v1'

export interface ModelAssetManagerOptions {
  cacheName?: string
  registry?: Record<TranslationDirection, ModelFilePaths>
  fetchFn?: typeof fetch
  cacheStorage?: CacheStorage
}

export interface StorageEstimateResult {
  supported: boolean
  quotaBytes?: number
  usageBytes?: number
  availableBytes?: number
  isSufficient?: boolean
}

export const MIN_MODEL_SIZE = 100_000 // 100 KB
export const MIN_LEX_SIZE = 10_000 // 10 KB
export const MIN_VOCAB_SIZE = 1_000 // 1 KB

export class ModelAssetManager {
  private readonly cacheName: string
  private readonly registry: Record<TranslationDirection, ModelFilePaths>
  private readonly fetchFn: typeof fetch
  private readonly cacheStorage?: CacheStorage
  private readonly inFlightDownloads = new Map<TranslationDirection, Promise<ModelBuffers>>()

  constructor(options: ModelAssetManagerOptions = {}) {
    this.cacheName = options.cacheName || BERGAMOT_CACHE_NAME
    this.registry = options.registry || MOZILLA_MODEL_REGISTRY
    this.fetchFn = options.fetchFn || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : (undefined as never))
    this.cacheStorage = options.cacheStorage || (typeof caches !== 'undefined' ? caches : undefined)
  }

  public getCacheName(): string {
    return this.cacheName
  }

  public async hasLegacyCache(): Promise<boolean> {
    if (!this.cacheStorage) return false
    try {
      return await this.cacheStorage.has(LEGACY_BERGAMOT_CACHE_NAME)
    } catch {
      return false
    }
  }

  /**
   * Matches a cached entry, falling back to legacy remote URL if present in cache.
   */
  private async matchCachedEntry(
    cache: Cache,
    direction: TranslationDirection,
    fileKey: 'model' | 'lex' | 'vocab'
  ): Promise<Response | undefined> {
    const currentUrl = this.registry[direction]?.[fileKey]
    if (currentUrl) {
      const res = await cache.match(currentUrl)
      if (res) return res
    }
    const legacyUrl = MOZILLA_REMOTE_MODEL_REGISTRY[direction]?.[fileKey]
    if (legacyUrl && legacyUrl !== currentUrl) {
      const res = await cache.match(legacyUrl)
      if (res) return res
    }
    return undefined
  }

  /**
   * Inspect available device storage quota and usage.
   * Degrades gracefully if navigator.storage.estimate is not available.
   */
  public async estimateStorage(): Promise<StorageEstimateResult> {
    if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.estimate === 'function') {
      try {
        const est = await navigator.storage.estimate()
        const quota = est.quota
        const usage = est.usage
        const available = quota && usage !== undefined ? quota - usage : undefined
        // Require at least 50MB for downloading & uncompressing translation models
        const isSufficient = available !== undefined ? available > 50 * 1024 * 1024 : true

        return {
          supported: true,
          quotaBytes: quota,
          usageBytes: usage,
          availableBytes: available,
          isSufficient,
        }
      } catch {
        // Fall back gracefully
      }
    }
    return { supported: false, isSufficient: true }
  }

  /**
   * Check whether all 3 required model files are cached, uncompressed, and meet minimum size requirements.
   */
  public async isModelCached(direction: TranslationDirection): Promise<boolean> {
    if (!this.cacheStorage) return false
    try {
      const cache = await this.cacheStorage.open(this.cacheName)
      const files = this.registry[direction]
      if (!files) return false

      const [mRes, lRes, vRes] = await Promise.all([
        this.matchCachedEntry(cache, direction, 'model'),
        this.matchCachedEntry(cache, direction, 'lex'),
        this.matchCachedEntry(cache, direction, 'vocab'),
      ])

      if (!mRes || !lRes || !vRes) return false

      const [mBuf, lBuf, vBuf] = await Promise.all([
        mRes.arrayBuffer(),
        lRes.arrayBuffer(),
        vRes.arrayBuffer(),
      ])

      // 1. Minimum sanity size check
      if (
        mBuf.byteLength < MIN_MODEL_SIZE ||
        lBuf.byteLength < MIN_LEX_SIZE ||
        vBuf.byteLength < MIN_VOCAB_SIZE
      ) {
        return false
      }

      // 2. Reject raw gzip files stored in cache
      if (isGzipBuffer(mBuf) || isGzipBuffer(lBuf) || isGzipBuffer(vBuf)) {
        await this.evictModel(direction)
        return false
      }

      // 3. Decompressed SHA-256 integrity check if configured
      if (files.decompressedModelSha256) {
        const hash = await computeBufferSha256(mBuf)
        if (hash && hash !== files.decompressedModelSha256) return false
      }
      if (files.decompressedLexSha256) {
        const hash = await computeBufferSha256(lBuf)
        if (hash && hash !== files.decompressedLexSha256) return false
      }
      if (files.decompressedVocabSha256) {
        const hash = await computeBufferSha256(vBuf)
        if (hash && hash !== files.decompressedVocabSha256) return false
      }

      return true
    } catch {
      return false
    }
  }

  /**
   * Retrieve cached model buffers directly if available.
   * Returns null if any file is missing, corrupted, or compressed gzip.
   */
  public async getCachedModelBuffers(direction: TranslationDirection): Promise<ModelBuffers | null> {
    if (!this.cacheStorage) return null
    try {
      const cache = await this.cacheStorage.open(this.cacheName)
      const files = this.registry[direction]
      if (!files) return null

      const [mRes, lRes, vRes] = await Promise.all([
        this.matchCachedEntry(cache, direction, 'model'),
        this.matchCachedEntry(cache, direction, 'lex'),
        this.matchCachedEntry(cache, direction, 'vocab'),
      ])

      if (!mRes || !lRes || !vRes) return null

      const [model, lex, vocab] = await Promise.all([
        mRes.arrayBuffer(),
        lRes.arrayBuffer(),
        vRes.arrayBuffer(),
      ])

      // 1. Size verification
      if (
        model.byteLength < MIN_MODEL_SIZE ||
        lex.byteLength < MIN_LEX_SIZE ||
        vocab.byteLength < MIN_VOCAB_SIZE
      ) {
        await this.evictModel(direction)
        return null
      }

      // 2. Format verification: must not be raw compressed gzip
      if (isGzipBuffer(model) || isGzipBuffer(lex) || isGzipBuffer(vocab)) {
        await this.evictModel(direction)
        return null
      }

      // 3. Decompressed SHA-256 verification
      if (files.decompressedModelSha256) {
        const hash = await computeBufferSha256(model)
        if (hash && hash !== files.decompressedModelSha256) {
          await this.evictModel(direction)
          return null
        }
      }
      if (files.decompressedLexSha256) {
        const hash = await computeBufferSha256(lex)
        if (hash && hash !== files.decompressedLexSha256) {
          await this.evictModel(direction)
          return null
        }
      }
      if (files.decompressedVocabSha256) {
        const hash = await computeBufferSha256(vocab)
        if (hash && hash !== files.decompressedVocabSha256) {
          await this.evictModel(direction)
          return null
        }
      }

      return { model, lex, vocab }
    } catch {
      return null
    }
  }

  /**
   * Download and cache model files with on-demand streaming, progress reporting,
   * safe cancellation, native decompression, and deduplication of concurrent requests.
   */
  public async downloadModel(
    direction: TranslationDirection,
    onProgress?: (progress: ModelDownloadProgress) => void,
    signal?: AbortSignal
  ): Promise<ModelBuffers> {
    if (signal?.aborted) {
      throw new DOMException('Download aborted by user', 'AbortError')
    }

    // 1. Check if an identical download is already in progress
    const active = this.inFlightDownloads.get(direction)
    if (active) {
      return active
    }

    const downloadTask = (async () => {
      // Check if already cached
      const cached = await this.getCachedModelBuffers(direction)
      if (cached) {
        onProgress?.({
          direction,
          loadedBytes: 100,
          totalBytes: 100,
          percentage: 100,
          currentFile: 'All model files cached',
        })
        return cached
      }

      return this.executeDownload(direction, onProgress, signal)
    })()

    this.inFlightDownloads.set(direction, downloadTask)

    try {
      return await downloadTask
    } catch (err) {
      if (signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
        throw new DOMException('Download aborted by user', 'AbortError')
      }
      throw err
    } finally {
      this.inFlightDownloads.delete(direction)
    }
  }

  private async executeDownload(
    direction: TranslationDirection,
    onProgress?: (progress: ModelDownloadProgress) => void,
    signal?: AbortSignal
  ): Promise<ModelBuffers> {
    const files = this.registry[direction]
    if (!files) {
      throw new Error(`Unsupported translation direction "${direction}"`)
    }

    const cache = this.cacheStorage ? await this.cacheStorage.open(this.cacheName) : null

    const fileEntries = [
      {
        name: 'model',
        url: files.model,
        minSize: MIN_MODEL_SIZE,
        estBytes: 12_500_000,
        expectedSha256: files.modelSha256,
        expectedDecompressedSha256: files.decompressedModelSha256,
      },
      {
        name: 'lex',
        url: files.lex,
        minSize: MIN_LEX_SIZE,
        estBytes: 2_000_000,
        expectedSha256: files.lexSha256,
        expectedDecompressedSha256: files.decompressedLexSha256,
      },
      {
        name: 'vocab',
        url: files.vocab,
        minSize: MIN_VOCAB_SIZE,
        estBytes: 450_000,
        expectedSha256: files.vocabSha256,
        expectedDecompressedSha256: files.decompressedVocabSha256,
      },
    ]

    const totalEstimatedBytes = fileEntries.reduce((sum, f) => sum + f.estBytes, 0)
    let aggregateLoaded = 0

    const fetchOne = async (
      entry: (typeof fileEntries)[number]
    ): Promise<{ name: string; buffer: ArrayBuffer; url: string }> => {
      if (signal?.aborted) {
        throw new DOMException('Download aborted by user', 'AbortError')
      }

      // 1. Check cache first for this specific file
      if (cache) {
        const cachedRes = await this.matchCachedEntry(
          cache,
          direction,
          entry.name as 'model' | 'lex' | 'vocab'
        )
        if (cachedRes) {
          const buf = await cachedRes.arrayBuffer()
          let valid = buf.byteLength >= entry.minSize && !isGzipBuffer(buf)
          if (valid && entry.expectedDecompressedSha256) {
            const hash = await computeBufferSha256(buf)
            if (hash && hash !== entry.expectedDecompressedSha256) {
              valid = false
            }
          }
          if (valid) {
            aggregateLoaded += entry.estBytes
            onProgress?.({
              direction,
              loadedBytes: aggregateLoaded,
              totalBytes: totalEstimatedBytes,
              percentage: Math.min(100, Math.round((aggregateLoaded / totalEstimatedBytes) * 100)),
              currentFile: `${entry.name} (cached)`,
            })
            return { name: entry.name, buffer: buf, url: entry.url }
          }
        }
      }

      // 2. Fetch from network
      const res = await this.fetchFn(entry.url, { signal })
      if (!res.ok) {
        throw new Error(`Failed to download ${entry.name}: HTTP ${res.status} ${res.statusText}`)
      }

      const reader = res.body?.getReader()
      let rawDownloadedBuffer: ArrayBuffer

      if (!reader) {
        rawDownloadedBuffer = await res.arrayBuffer()
        aggregateLoaded += entry.estBytes
      } else {
        const chunks: Uint8Array[] = []
        let fileLoaded = 0

        while (true) {
          if (signal?.aborted) {
            reader.cancel().catch(() => {})
            throw new DOMException('Download aborted by user', 'AbortError')
          }

          const { done, value } = await reader.read()
          if (done) break
          if (value) {
            chunks.push(value)
            fileLoaded += value.byteLength
            aggregateLoaded += value.byteLength
            onProgress?.({
              direction,
              loadedBytes: aggregateLoaded,
              totalBytes: totalEstimatedBytes,
              percentage: Math.min(100, Math.round((aggregateLoaded / totalEstimatedBytes) * 100)),
              currentFile: entry.name,
            })
          }
        }

        const combined = new Uint8Array(fileLoaded)
        let offset = 0
        for (const chunk of chunks) {
          combined.set(chunk, offset)
          offset += chunk.byteLength
        }
        rawDownloadedBuffer = combined.buffer
      }

      if (rawDownloadedBuffer.byteLength < 20) {
        throw new Error(`Downloaded ${entry.name} file is corrupted or empty (${rawDownloadedBuffer.byteLength} bytes)`)
      }

      // 3. Verify checksum on downloaded bytes
      // Note: If the HTTP server sent 'Content-Encoding: gzip', the browser's fetch transport transparently
      // decompressed the stream, so rawDownloadedBuffer is already uncompressed.
      const isStillGzip = isGzipBuffer(rawDownloadedBuffer)
      if (isStillGzip && entry.expectedSha256) {
        const actualSha = await computeBufferSha256(rawDownloadedBuffer)
        if (actualSha && actualSha !== entry.expectedSha256) {
          throw new Error(`Checksum mismatch for ${entry.name}: expected ${entry.expectedSha256}, got ${actualSha}`)
        }
      } else if (!isStillGzip) {
        if (entry.url.endsWith('.gz') && entry.expectedDecompressedSha256) {
          const actualSha = await computeBufferSha256(rawDownloadedBuffer)
          if (actualSha && actualSha !== entry.expectedDecompressedSha256) {
            throw new Error(
              `Decompressed checksum mismatch for ${entry.name}: expected ${entry.expectedDecompressedSha256}, got ${actualSha}`
            )
          }
        } else if (entry.expectedSha256) {
          const actualSha = await computeBufferSha256(rawDownloadedBuffer)
          if (actualSha && actualSha !== entry.expectedSha256) {
            throw new Error(`Checksum mismatch for ${entry.name}: expected ${entry.expectedSha256}, got ${actualSha}`)
          }
        }
      }

      // 4. Decompress if gzip
      let uncompressedBuffer: ArrayBuffer
      if (isStillGzip) {
        uncompressedBuffer = await decompressGzipBuffer(rawDownloadedBuffer)
      } else {
        uncompressedBuffer = rawDownloadedBuffer
      }

      // 5. Verify uncompressed constraints
      if (uncompressedBuffer.byteLength < entry.minSize) {
        throw new Error(
          `Decompressed ${entry.name} is smaller than minimum required size (${uncompressedBuffer.byteLength} < ${entry.minSize})`
        )
      }

      if (isGzipBuffer(uncompressedBuffer)) {
        throw new Error(`Decompressed ${entry.name} still contains gzip headers after decompression.`)
      }

      if (entry.expectedDecompressedSha256) {
        const actualDecompressedSha = await computeBufferSha256(uncompressedBuffer)
        if (actualDecompressedSha && actualDecompressedSha !== entry.expectedDecompressedSha256) {
          throw new Error(
            `Decompressed checksum mismatch for ${entry.name}: expected ${entry.expectedDecompressedSha256}, got ${actualDecompressedSha}`
          )
        }
      }

      return { name: entry.name, buffer: uncompressedBuffer, url: entry.url }
    }

    try {
      // Download all 3 files
      const results = await Promise.all(fileEntries.map((entry) => fetchOne(entry)))

      if (signal?.aborted) {
        throw new DOMException('Download aborted by user', 'AbortError')
      }

      const modelBuf = results.find((r) => r.name === 'model')!.buffer
      const lexBuf = results.find((r) => r.name === 'lex')!.buffer
      const vocabBuf = results.find((r) => r.name === 'vocab')!.buffer

      // Atomic commit to CacheStorage: Only commit when ALL 3 files pass validation
      if (cache) {
        await Promise.all(
          results.map((r) =>
            cache.put(
              r.url,
              new Response(r.buffer.slice(0), {
                headers: {
                  'Content-Type': 'application/octet-stream',
                  'Content-Length': r.buffer.byteLength.toString(),
                  'X-Writin-Decompressed': 'true',
                  'X-Writin-Direction': direction,
                },
              })
            )
          )
        )
      }

      onProgress?.({
        direction,
        loadedBytes: totalEstimatedBytes,
        totalBytes: totalEstimatedBytes,
        percentage: 100,
        currentFile: 'Complete',
      })

      return {
        model: modelBuf,
        lex: lexBuf,
        vocab: vocabBuf,
      }
    } catch (err) {
      // Incomplete download cleanup: evict any partial cache entries
      if (cache) {
        await this.evictModel(direction)
      }
      throw err
    }
  }

  /**
   * Safely evict cached model files for a given direction.
   * Evicts both primary same-origin keys and legacy remote URLs.
   */
  public async evictModel(direction: TranslationDirection): Promise<void> {
    if (!this.cacheStorage) return
    try {
      const cache = await this.cacheStorage.open(this.cacheName)
      const files = this.registry[direction]
      const legacyFiles = MOZILLA_REMOTE_MODEL_REGISTRY[direction]
      const urlsToDelete = new Set<string>()
      if (files) {
        urlsToDelete.add(files.model)
        urlsToDelete.add(files.lex)
        urlsToDelete.add(files.vocab)
      }
      if (legacyFiles) {
        urlsToDelete.add(legacyFiles.model)
        urlsToDelete.add(legacyFiles.lex)
        urlsToDelete.add(legacyFiles.vocab)
      }
      await Promise.all(Array.from(urlsToDelete).map((url) => cache.delete(url)))
    } catch {
      // Best-effort cache eviction
    }
  }
}

export const modelAssetManager = new ModelAssetManager()
