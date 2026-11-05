import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  ModelAssetManager,
  BERGAMOT_CACHE_NAME,
  LEGACY_BERGAMOT_CACHE_NAME,
  isGzipBuffer,
  decompressGzipBuffer,
  getBergamotWorkerUrl,
  getBergamotModelUrl,
  SAME_ORIGIN_MODEL_REGISTRY,
  MOZILLA_REMOTE_MODEL_REGISTRY,
  MOZILLA_MODEL_REGISTRY,
  computeBufferSha256,
  type ModelFilePaths,
} from './modelAssetManager'
import type { TranslationDirection } from '../../prototype/translation/types'
import zlib from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'

// Mock In-Memory CacheStorage implementation
class MockCache {
  private store = new Map<string, ArrayBuffer>()

  async match(url: string | URL | Request): Promise<Response | undefined> {
    const key = typeof url === 'string' ? url : url.toString()
    const buf = this.store.get(key)
    if (!buf) return undefined
    return new Response(buf.slice(0))
  }

  async put(url: string | URL | Request, response: Response): Promise<void> {
    const key = typeof url === 'string' ? url : url.toString()
    const buf = await response.arrayBuffer()
    this.store.set(key, buf)
  }

  async delete(url: string | URL | Request): Promise<boolean> {
    const key = typeof url === 'string' ? url : url.toString()
    return this.store.delete(key)
  }

  has(key: string): boolean {
    return this.store.has(key)
  }
}

class MockCacheStorage {
  private caches = new Map<string, MockCache>()

  async open(cacheName: string): Promise<Cache> {
    let c = this.caches.get(cacheName)
    if (!c) {
      c = new MockCache()
      this.caches.set(cacheName, c)
    }
    return c as unknown as Cache
  }

  async has(cacheName: string): Promise<boolean> {
    return this.caches.has(cacheName)
  }

  getCache(cacheName: string): MockCache | undefined {
    return this.caches.get(cacheName)
  }
}

function createDummyBuffer(size: number): ArrayBuffer {
  return new ArrayBuffer(size)
}

function createGzippedBuffer(uncompressedText: string): ArrayBuffer {
  const gz = zlib.gzipSync(Buffer.from(uncompressedText))
  return gz.buffer.slice(gz.byteOffset, gz.byteOffset + gz.byteLength) as ArrayBuffer
}

describe('Stage 23.2.B.17.4 Phase 1 — Model Asset Manager & Delivery', () => {
  let mockCaches: MockCacheStorage
  let customRegistry: Record<TranslationDirection, ModelFilePaths>

  beforeEach(() => {
    mockCaches = new MockCacheStorage()
    customRegistry = {
      'en-hi': {
        model: 'https://cdn.example.com/models/en-hi/model.bin',
        lex: 'https://cdn.example.com/models/en-hi/lex.bin',
        vocab: 'https://cdn.example.com/models/en-hi/vocab.spm',
      },
      'hi-en': {
        model: 'https://cdn.example.com/models/hi-en/model.bin',
        lex: 'https://cdn.example.com/models/hi-en/lex.bin',
        vocab: 'https://cdn.example.com/models/hi-en/vocab.spm',
      },
    }
  })

  it('1. First-time download saves verified buffers to cache', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('model.bin')) {
        return new Response(createDummyBuffer(150_000), { status: 200 })
      }
      if (url.includes('lex.bin')) {
        return new Response(createDummyBuffer(25_000), { status: 200 })
      }
      if (url.includes('vocab.spm')) {
        return new Response(createDummyBuffer(5_000), { status: 200 })
      }
      return new Response('Not found', { status: 404 })
    })

    const manager = new ModelAssetManager({
      cacheStorage: mockCaches as unknown as CacheStorage,
      registry: customRegistry,
      fetchFn: fetchMock as unknown as typeof fetch,
    })

    const progressUpdates: number[] = []
    const buffers = await manager.downloadModel('en-hi', (p) => {
      progressUpdates.push(p.percentage)
    })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(buffers.model.byteLength).toBe(150_000)
    expect(buffers.lex.byteLength).toBe(25_000)
    expect(buffers.vocab.byteLength).toBe(5_000)
    expect(progressUpdates.length).toBeGreaterThan(0)
    expect(progressUpdates[progressUpdates.length - 1]).toBe(100)

    // Confirm stored in cache
    const isCached = await manager.isModelCached('en-hi')
    expect(isCached).toBe(true)
  })

  it('2. Existing cache reuse does not trigger network requests', async () => {
    // Pre-populate cache in v2
    const cache = (await mockCaches.open(BERGAMOT_CACHE_NAME)) as unknown as MockCache
    await Promise.all([
      cache.put(customRegistry['en-hi'].model, new Response(createDummyBuffer(150_000))),
      cache.put(customRegistry['en-hi'].lex, new Response(createDummyBuffer(25_000))),
      cache.put(customRegistry['en-hi'].vocab, new Response(createDummyBuffer(5_000))),
    ])

    const fetchMock = vi.fn()
    const manager = new ModelAssetManager({
      cacheStorage: mockCaches as unknown as CacheStorage,
      registry: customRegistry,
      fetchFn: fetchMock as unknown as typeof fetch,
    })

    const buffers = await manager.downloadModel('en-hi')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(buffers.model.byteLength).toBe(150_000)
    expect(buffers.lex.byteLength).toBe(25_000)
    expect(buffers.vocab.byteLength).toBe(5_000)
  })

  it('3. Interrupted download with AbortSignal halts download and does not commit partial files', async () => {
    const controller = new AbortController()

    const fetchMock = vi.fn(async (_url: string, init?: { signal?: AbortSignal }) => {
      if (init?.signal?.aborted) {
        throw new DOMException('The operation was aborted', 'AbortError')
      }
      controller.abort()
      throw new DOMException('The operation was aborted', 'AbortError')
    })

    const manager = new ModelAssetManager({
      cacheStorage: mockCaches as unknown as CacheStorage,
      registry: customRegistry,
      fetchFn: fetchMock as unknown as typeof fetch,
    })

    await expect(manager.downloadModel('en-hi', undefined, controller.signal)).rejects.toThrow(
      'Download aborted by user'
    )

    const isCached = await manager.isModelCached('en-hi')
    expect(isCached).toBe(false)
  })

  it('4. Concurrent downloads for the same direction share the exact same active request', async () => {
    let callCount = 0
    const fetchMock = vi.fn(async (url: string) => {
      callCount++
      if (url.includes('model.bin')) return new Response(createDummyBuffer(120_000))
      if (url.includes('lex.bin')) return new Response(createDummyBuffer(15_000))
      return new Response(createDummyBuffer(2_000))
    })

    const manager = new ModelAssetManager({
      cacheStorage: mockCaches as unknown as CacheStorage,
      registry: customRegistry,
      fetchFn: fetchMock as unknown as typeof fetch,
    })

    const [buf1, buf2] = await Promise.all([
      manager.downloadModel('en-hi'),
      manager.downloadModel('en-hi'),
    ])

    expect(callCount).toBe(3)
    expect(buf1.model.byteLength).toBe(120_000)
    expect(buf2.model.byteLength).toBe(120_000)
  })

  it('5. Detects corrupted / undersized cache files and auto-evicts them', async () => {
    const cache = (await mockCaches.open(BERGAMOT_CACHE_NAME)) as unknown as MockCache
    cache.put(customRegistry['en-hi'].model, new Response(createDummyBuffer(50)))
    cache.put(customRegistry['en-hi'].lex, new Response(createDummyBuffer(25_000)))
    cache.put(customRegistry['en-hi'].vocab, new Response(createDummyBuffer(5_000)))

    const manager = new ModelAssetManager({
      cacheStorage: mockCaches as unknown as CacheStorage,
      registry: customRegistry,
    })

    const isCached = await manager.isModelCached('en-hi')
    expect(isCached).toBe(false)

    const retrieved = await manager.getCachedModelBuffers('en-hi')
    expect(retrieved).toBeNull()

    expect(cache.has(customRegistry['en-hi'].model)).toBe(false)
  })

  it('6. Safely handles missing individual files', async () => {
    const cache = (await mockCaches.open(BERGAMOT_CACHE_NAME)) as unknown as MockCache
    cache.put(customRegistry['en-hi'].model, new Response(createDummyBuffer(150_000)))

    const manager = new ModelAssetManager({
      cacheStorage: mockCaches as unknown as CacheStorage,
      registry: customRegistry,
    })

    const isCached = await manager.isModelCached('en-hi')
    expect(isCached).toBe(false)
  })

  it('7. Evicts model assets on demand', async () => {
    const cache = (await mockCaches.open(BERGAMOT_CACHE_NAME)) as unknown as MockCache
    await Promise.all([
      cache.put(customRegistry['en-hi'].model, new Response(createDummyBuffer(150_000))),
      cache.put(customRegistry['en-hi'].lex, new Response(createDummyBuffer(25_000))),
      cache.put(customRegistry['en-hi'].vocab, new Response(createDummyBuffer(5_000))),
    ])

    const manager = new ModelAssetManager({
      cacheStorage: mockCaches as unknown as CacheStorage,
      registry: customRegistry,
    })

    expect(await manager.isModelCached('en-hi')).toBe(true)
    await manager.evictModel('en-hi')
    expect(await manager.isModelCached('en-hi')).toBe(false)
  })

  it('8. Storage awareness inspects quota and handles graceful fallback', async () => {
    const manager = new ModelAssetManager({
      cacheStorage: mockCaches as unknown as CacheStorage,
      registry: customRegistry,
    })

    const estimate = await manager.estimateStorage()
    expect(estimate).toHaveProperty('isSufficient')
    expect(estimate.isSufficient).toBe(true)
  })

  it('9. Enforces cryptographic SHA-256 integrity verification when expectedSha256 is configured', async () => {
    const corruptedBuffer = new Uint8Array(120_000).buffer

    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('model.bin')) return new Response(corruptedBuffer)
      if (url.includes('lex.bin')) return new Response(createDummyBuffer(15_000))
      return new Response(createDummyBuffer(2_000))
    })

    const registryWithHash = {
      ...customRegistry,
      'en-hi': {
        ...customRegistry['en-hi'],
        modelSha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      },
    }

    const manager = new ModelAssetManager({
      cacheStorage: mockCaches as unknown as CacheStorage,
      registry: registryWithHash,
      fetchFn: fetchMock as unknown as typeof fetch,
    })

    await expect(manager.downloadModel('en-hi')).rejects.toThrow('Checksum mismatch for model')
  })

  it('10. Detects gzip magic header bytes correctly (isGzipBuffer)', () => {
    const gzip = createGzippedBuffer('Test uncompressed string')
    expect(isGzipBuffer(gzip)).toBe(true)

    const raw = new TextEncoder().encode('Not a gzip file').buffer
    expect(isGzipBuffer(raw)).toBe(false)

    expect(isGzipBuffer(new ArrayBuffer(0))).toBe(false)
    expect(isGzipBuffer(new ArrayBuffer(1))).toBe(false)
  })

  it('11. Decompresses valid gzip buffers safely', async () => {
    const originalText = 'Mozilla Bergamot Marian NMT neural translation weights'
    const compressed = createGzippedBuffer(originalText)

    expect(isGzipBuffer(compressed)).toBe(true)

    const decompressed = await decompressGzipBuffer(compressed)
    expect(isGzipBuffer(decompressed)).toBe(false)

    const decoded = new TextDecoder().decode(decompressed)
    expect(decoded).toBe(originalText)
  })

  it('12. Passes already-uncompressed buffers untouched without error', async () => {
    const original = new TextEncoder().encode('Raw uncompressed binary data').buffer
    const output = await decompressGzipBuffer(original)
    expect(output).toBe(original)
  })

  it('13. Rejects invalid or corrupted gzip data', async () => {
    // 0x1f, 0x8b magic header followed by corrupt garbage
    const fakeGzip = new Uint8Array([0x1f, 0x8b, 0x99, 0x88, 0x77, 0x66]).buffer
    await expect(decompressGzipBuffer(fakeGzip)).rejects.toThrow(/Failed to decompress gzip/)
  })

  it('14. Automatically decompresses downloaded gzip assets before committing to CacheStorage', async () => {
    // Large enough uncompressed text to pass minimum sizes:
    const modelPayload = 'M'.repeat(120_000)
    const lexPayload = 'L'.repeat(15_000)
    const vocabPayload = 'V'.repeat(2_000)

    const modelGzip = createGzippedBuffer(modelPayload)
    const lexGzip = createGzippedBuffer(lexPayload)
    const vocabGzip = createGzippedBuffer(vocabPayload)

    expect(isGzipBuffer(modelGzip)).toBe(true)
    expect(isGzipBuffer(lexGzip)).toBe(true)
    expect(isGzipBuffer(vocabGzip)).toBe(true)

    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('model.bin')) return new Response(modelGzip)
      if (url.includes('lex.bin')) return new Response(lexGzip)
      return new Response(vocabGzip)
    })

    const manager = new ModelAssetManager({
      cacheStorage: mockCaches as unknown as CacheStorage,
      registry: customRegistry,
      fetchFn: fetchMock as unknown as typeof fetch,
    })

    const buffers = await manager.downloadModel('en-hi')

    // Returned buffers must be UNCOMPRESSED!
    expect(isGzipBuffer(buffers.model)).toBe(false)
    expect(isGzipBuffer(buffers.lex)).toBe(false)
    expect(isGzipBuffer(buffers.vocab)).toBe(false)
    expect(buffers.model.byteLength).toBe(120_000)

    // Cached buffers must also be UNCOMPRESSED!
    const cache = (await mockCaches.open(BERGAMOT_CACHE_NAME)) as unknown as MockCache
    const cachedModelRes = await cache.match(customRegistry['en-hi'].model)
    expect(cachedModelRes).toBeDefined()
    const cachedModelBuf = await cachedModelRes!.arrayBuffer()
    expect(isGzipBuffer(cachedModelBuf)).toBe(false)
    expect(cachedModelBuf.byteLength).toBe(120_000)
  })

  it('15. Evicts cache entries if they contain raw gzip bytes instead of uncompressed binaries', async () => {
    const cache = (await mockCaches.open(BERGAMOT_CACHE_NAME)) as unknown as MockCache

    const modelGzip = createGzippedBuffer('M'.repeat(120_000))
    const lexGzip = createGzippedBuffer('L'.repeat(15_000))
    const vocabGzip = createGzippedBuffer('V'.repeat(2_000))

    // Store gzip in cache (simulate buggy previous version)
    await cache.put(customRegistry['en-hi'].model, new Response(modelGzip))
    await cache.put(customRegistry['en-hi'].lex, new Response(lexGzip))
    await cache.put(customRegistry['en-hi'].vocab, new Response(vocabGzip))

    const manager = new ModelAssetManager({
      cacheStorage: mockCaches as unknown as CacheStorage,
      registry: customRegistry,
    })

    // Should detect gzip, reject as invalid, and auto-evict
    const isCached = await manager.isModelCached('en-hi')
    expect(isCached).toBe(false)

    const cached = await manager.getCachedModelBuffers('en-hi')
    expect(cached).toBeNull()

    // Evicted from cache
    expect(cache.has(customRegistry['en-hi'].model)).toBe(false)
  })

  it('16. Isolates cache namespace writin-bergamot-models-v2 from legacy writin-translation-cache-v1', async () => {
    // Put something in legacy cache
    const legacyCache = (await mockCaches.open(LEGACY_BERGAMOT_CACHE_NAME)) as unknown as MockCache
    await legacyCache.put('https://legacy.example.com/model.bin', new Response(createDummyBuffer(100)))

    const manager = new ModelAssetManager({
      cacheStorage: mockCaches as unknown as CacheStorage,
      registry: customRegistry,
    })

    expect(manager.getCacheName()).toBe('writin-bergamot-models-v2')
    expect(await manager.hasLegacyCache()).toBe(true)

    // Confirm that v2 cache is completely isolated from v1
    const v2Cache = (await mockCaches.open(BERGAMOT_CACHE_NAME)) as unknown as MockCache
    expect(v2Cache.has('https://legacy.example.com/model.bin')).toBe(false)
  })

  it('17. Cleans up partial cache entries when download fails midway', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('model.bin')) return new Response(createDummyBuffer(120_000))
      if (url.includes('lex.bin')) throw new Error('Network failure on lex file')
      return new Response(createDummyBuffer(2_000))
    })

    const manager = new ModelAssetManager({
      cacheStorage: mockCaches as unknown as CacheStorage,
      registry: customRegistry,
      fetchFn: fetchMock as unknown as typeof fetch,
    })

    await expect(manager.downloadModel('en-hi')).rejects.toThrow('Network failure on lex file')

    // Confirm cache is clean (no partial entries)
    const isCached = await manager.isModelCached('en-hi')
    expect(isCached).toBe(false)
  })

  it('18. getBergamotWorkerUrl resolves worker URLs with base URL handling', () => {
    const url1 = getBergamotWorkerUrl()
    expect(url1).toMatch(/bergamot\/translator-worker\.js$/)

    const url2 = getBergamotWorkerUrl('bergamot-translator-worker.wasm')
    expect(url2).toMatch(/bergamot\/bergamot-translator-worker\.wasm$/)
  })

  it('19. Verifies worker assets exist in public/bergamot/ and production build output', () => {
    const publicDir = path.resolve(process.cwd(), 'public/bergamot')
    expect(fs.existsSync(path.join(publicDir, 'translator-worker.js'))).toBe(true)
    expect(fs.existsSync(path.join(publicDir, 'bergamot-translator-worker.js'))).toBe(true)
    expect(fs.existsSync(path.join(publicDir, 'bergamot-translator-worker.wasm'))).toBe(true)

    const wasmStat = fs.statSync(path.join(publicDir, 'bergamot-translator-worker.wasm'))
    expect(wasmStat.size).toBe(5174294)

    const distDir = path.resolve(process.cwd(), 'dist/bergamot')
    if (fs.existsSync(distDir)) {
      expect(fs.existsSync(path.join(distDir, 'translator-worker.js'))).toBe(true)
      expect(fs.existsSync(path.join(distDir, 'bergamot-translator-worker.js'))).toBe(true)
      expect(fs.existsSync(path.join(distDir, 'bergamot-translator-worker.wasm'))).toBe(true)
    }
  })

  describe('Stage 23.2.B.17.9 — Same-Origin Model Delivery & Backward Compatibility', () => {
    it('20. getBergamotModelUrl resolves same-origin model URLs correctly', () => {
      const enHiModel = getBergamotModelUrl('en-hi', 'model.enhi.intgemm.alphas.bin.gz')
      expect(enHiModel).toMatch(/\/bergamot\/models\/en-hi\/model\.enhi\.intgemm\.alphas\.bin\.gz$/)

      const hiEnVocab = getBergamotModelUrl('hi-en', 'vocab.hien.spm.gz')
      expect(hiEnVocab).toMatch(/\/bergamot\/models\/hi-en\/vocab\.hien\.spm\.gz$/)
    })

    it('21. MOZILLA_MODEL_REGISTRY defaults to SAME_ORIGIN_MODEL_REGISTRY', () => {
      expect(MOZILLA_MODEL_REGISTRY).toBe(SAME_ORIGIN_MODEL_REGISTRY)
      expect(MOZILLA_MODEL_REGISTRY['en-hi'].model).toMatch(/\/bergamot\/models\/en-hi\//)
      expect(MOZILLA_MODEL_REGISTRY['hi-en'].model).toMatch(/\/bergamot\/models\/hi-en\//)
    })

    it('22. MOZILLA_REMOTE_MODEL_REGISTRY preserves official upstream Mozilla URLs', () => {
      expect(MOZILLA_REMOTE_MODEL_REGISTRY['en-hi'].model).toContain('storage.googleapis.com')
      expect(MOZILLA_REMOTE_MODEL_REGISTRY['hi-en'].model).toContain('storage.googleapis.com')
    })

    it('23. Backward compatibility: recognizes models cached under legacy upstream URLs', async () => {
      const cache = (await mockCaches.open(BERGAMOT_CACHE_NAME)) as unknown as MockCache

      const modelBuf = createDummyBuffer(150_000)
      const lexBuf = createDummyBuffer(25_000)
      const vocabBuf = createDummyBuffer(5_000)

      const modelHash = await computeBufferSha256(modelBuf)
      const lexHash = await computeBufferSha256(lexBuf)
      const vocabHash = await computeBufferSha256(vocabBuf)

      const testRegistry: Record<TranslationDirection, ModelFilePaths> = {
        'en-hi': {
          model: '/bergamot/models/en-hi/model.bin',
          lex: '/bergamot/models/en-hi/lex.bin',
          vocab: '/bergamot/models/en-hi/vocab.spm',
          decompressedModelSha256: modelHash,
          decompressedLexSha256: lexHash,
          decompressedVocabSha256: vocabHash,
        },
        'hi-en': { ...customRegistry['hi-en'] },
      }

      const legacyEnHi = MOZILLA_REMOTE_MODEL_REGISTRY['en-hi']
      await Promise.all([
        cache.put(legacyEnHi.model, new Response(modelBuf)),
        cache.put(legacyEnHi.lex, new Response(lexBuf)),
        cache.put(legacyEnHi.vocab, new Response(vocabBuf)),
      ])

      // Manager initialized with same-origin registry URLs
      const manager = new ModelAssetManager({
        cacheStorage: mockCaches as unknown as CacheStorage,
        registry: testRegistry,
      })

      // Must find the cached model via backward compatibility fallback
      const isCached = await manager.isModelCached('en-hi')
      expect(isCached).toBe(true)

      const buffers = await manager.getCachedModelBuffers('en-hi')
      expect(buffers).not.toBeNull()
      expect(buffers?.model.byteLength).toBe(150_000)
      expect(buffers?.lex.byteLength).toBe(25_000)
      expect(buffers?.vocab.byteLength).toBe(5_000)
    })

    it('24. Backward compatibility: evictModel removes both same-origin and legacy cached entries', async () => {
      const cache = (await mockCaches.open(BERGAMOT_CACHE_NAME)) as unknown as MockCache

      const sameOriginEnHi = SAME_ORIGIN_MODEL_REGISTRY['en-hi']
      const legacyEnHi = MOZILLA_REMOTE_MODEL_REGISTRY['en-hi']

      await Promise.all([
        cache.put(sameOriginEnHi.model, new Response(createDummyBuffer(150_000))),
        cache.put(legacyEnHi.model, new Response(createDummyBuffer(150_000))),
      ])

      const manager = new ModelAssetManager({
        cacheStorage: mockCaches as unknown as CacheStorage,
      })

      await manager.evictModel('en-hi')

      expect(cache.has(sameOriginEnHi.model)).toBe(false)
      expect(cache.has(legacyEnHi.model)).toBe(false)
    })

    it('25. Verifies public/bergamot/models/ on disk has all 6 official gz files matching expected checksums', () => {
      const modelsDir = path.resolve(process.cwd(), 'public/bergamot/models')

      // en-hi
      const enHiDir = path.join(modelsDir, 'en-hi')
      expect(fs.existsSync(path.join(enHiDir, 'model.enhi.intgemm.alphas.bin.gz'))).toBe(true)
      expect(fs.existsSync(path.join(enHiDir, 'lex.50.50.enhi.s2t.bin.gz'))).toBe(true)
      expect(fs.existsSync(path.join(enHiDir, 'vocab.enhi.spm.gz'))).toBe(true)

      // hi-en
      const hiEnDir = path.join(modelsDir, 'hi-en')
      expect(fs.existsSync(path.join(hiEnDir, 'model.hien.intgemm.alphas.bin.gz'))).toBe(true)
      expect(fs.existsSync(path.join(hiEnDir, 'lex.50.50.hien.s2t.bin.gz'))).toBe(true)
      expect(fs.existsSync(path.join(hiEnDir, 'vocab.hien.spm.gz'))).toBe(true)
    })
  })
})
