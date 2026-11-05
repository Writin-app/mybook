import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  BergamotTransformationEngine,
  getSharedBergamotEngine,
  resetSharedBergamotEngine,
} from './bergamotEngine'
import { BergamotWorkerClient } from './bergamotWorkerClient'
import { ModelAssetManager } from './modelAssetManager'
import type { GenerationContext } from './contracts'

function createDummyBuffers() {
  return {
    model: new ArrayBuffer(150_000),
    lex: new ArrayBuffer(25_000),
    vocab: new ArrayBuffer(5_000),
  }
}

function makeContext(overrides: Partial<GenerationContext> = {}): GenerationContext {
  return {
    requestId: 1,
    documentId: 'doc-test',
    snapshotId: 'snap-1',
    languageTag: 'en-US',
    text: 'Hello world, this is a test paragraph.',
    actionId: 'translate',
    scope: 'selected',
    options: {
      targetLanguage: 'Hindi',
    },
    ...overrides,
  }
}

describe('Stage 23.2.B.16 — Bergamot Transformation Engine', () => {
  let mockWorkerClient: BergamotWorkerClient
  let mockAssetManager: ModelAssetManager

  beforeEach(() => {
    resetSharedBergamotEngine()

    mockAssetManager = {
      estimateStorage: vi.fn(async () => ({ supported: true, isSufficient: true })),
      isModelCached: vi.fn(async () => true),
      getCachedModelBuffers: vi.fn(async () => createDummyBuffers()),
      downloadModel: vi.fn(async () => createDummyBuffers()),
      evictModel: vi.fn(async () => {}),
    } as unknown as ModelAssetManager

    mockWorkerClient = {
      getStatus: vi.fn(() => 'ready'),
      isReady: vi.fn(() => true),
      initialize: vi.fn(async () => ({ directions: ['en-hi'], latencyMs: 50 })),
      translate: vi.fn(async () => ({
        targetText: 'नमस्ते दुनिया, यह एक परीक्षण पैराग्राफ है।',
        latencyMs: 35,
        charCount: 42,
      })),
      cancel: vi.fn(async () => {}),
      terminate: vi.fn(async () => {}),
    } as unknown as BergamotWorkerClient
  })

  it('1. Declares only translation capabilities for en and hi', () => {
    const engine = new BergamotTransformationEngine({
      workerClient: mockWorkerClient,
      assetManager: mockAssetManager,
    })

    expect(engine.id).toBe('bergamot-translator')
    expect(engine.capabilities.supports).toHaveLength(1)
    const entry = engine.capabilities.supports[0]
    expect(entry?.capability).toBe('translation')
    const languages = entry?.languages.map((l) => l.tag) ?? []
    expect(languages).toContain('en')
    expect(languages).toContain('hi')
  })

  it('2. Evaluates environment availability correctly', async () => {
    const engine = new BergamotTransformationEngine({
      workerClient: mockWorkerClient,
      assetManager: mockAssetManager,
    })

    const availability = await engine.getAvailability()
    expect(availability.available).toBe(true)
  })

  it('3. Successfully translates English to Hindi', async () => {
    const engine = new BergamotTransformationEngine({
      workerClient: mockWorkerClient,
      assetManager: mockAssetManager,
    })

    const ctx = makeContext({
      text: 'Hello world, this is a test paragraph.',
      languageTag: 'en-US',
      options: { targetLanguage: 'Hindi' },
    })

    const result = await engine.transform(ctx)
    expect(result.proposedText).toBe('नमस्ते दुनिया, यह एक परीक्षण पैराग्राफ है।')
    expect(result.explanation).toContain('Bergamot')
    expect(result.explanation).toContain('35ms')
  })

  it('4. Successfully translates Hindi to English', async () => {
    ;(mockWorkerClient.translate as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      targetText: 'Hello world, this is a test paragraph.',
      latencyMs: 32,
      charCount: 38,
    })

    const engine = new BergamotTransformationEngine({
      workerClient: mockWorkerClient,
      assetManager: mockAssetManager,
    })

    const ctx = makeContext({
      text: 'नमस्ते दुनिया, यह एक परीक्षण पैराग्राफ है।',
      languageTag: 'hi-IN',
      options: { targetLanguage: 'English' },
    })

    const result = await engine.transform(ctx)
    expect(result.proposedText).toBe('Hello world, this is a test paragraph.')
    expect(result.explanation).toContain('Bergamot')
  })

  it('5. Rejects non-translation actions', async () => {
    const engine = new BergamotTransformationEngine({
      workerClient: mockWorkerClient,
      assetManager: mockAssetManager,
    })

    const ctx = makeContext({
      actionId: 'summarize' as never,
    })

    await expect(engine.transform(ctx)).rejects.toThrow('Bergamot engine only handles translation actions')
  })

  it('6. Safely rejects Roman Hindi with clear error', async () => {
    const engine = new BergamotTransformationEngine({
      workerClient: mockWorkerClient,
      assetManager: mockAssetManager,
    })

    const ctx = makeContext({
      text: 'Yeh Roman Hindi mein likha hua text hai',
      languageTag: 'hi-Latn',
      options: { targetLanguage: 'English' },
    })

    await expect(engine.transform(ctx)).rejects.toThrow('Roman Hindi (Latin script) is not supported')
  })

  it('7. Triggers on-demand download when model is not cached', async () => {
    ;(mockAssetManager.getCachedModelBuffers as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
    ;(mockWorkerClient.isReady as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(false)

    const engine = new BergamotTransformationEngine({
      workerClient: mockWorkerClient,
      assetManager: mockAssetManager,
    })

    const ctx = makeContext()
    await engine.transform(ctx)

    expect(mockAssetManager.downloadModel).toHaveBeenCalledWith('en-hi', expect.any(Function), undefined)
    expect(mockWorkerClient.initialize).toHaveBeenCalled()
  })

  it('8. Catches instruction leakage and safety violations through output validation', async () => {
    ;(mockWorkerClient.translate as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      targetText: 'I cannot translate this text as an AI language model.',
      latencyMs: 40,
      charCount: 53,
    })

    const engine = new BergamotTransformationEngine({
      workerClient: mockWorkerClient,
      assetManager: mockAssetManager,
    })

    const ctx = makeContext({
      options: { targetLanguage: 'Hindi' },
    })

    await expect(engine.transform(ctx)).rejects.toThrow('produced an English or wrong-language response instead of Hindi')
  })

  it('9. Propagates cancellation when AbortSignal is aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    const engine = new BergamotTransformationEngine({
      workerClient: mockWorkerClient,
      assetManager: mockAssetManager,
    })

    const ctx = makeContext()
    await expect(engine.transform(ctx, controller.signal)).rejects.toThrow('Translation was cancelled')
  })

  it('10. Manages shared singleton cleanly', () => {
    const shared1 = getSharedBergamotEngine()
    const shared2 = getSharedBergamotEngine()
    expect(shared1).toBe(shared2)

    resetSharedBergamotEngine()
    const shared3 = getSharedBergamotEngine()
    expect(shared3).not.toBe(shared1)
  })
})
