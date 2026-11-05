import { describe, expect, it } from 'vitest'

import type { GenerationContext } from './contracts'
import { createMockTransformationEngine, MockTransformationEngine } from './mockTransformationEngine'

const sampleContext: GenerationContext = {
  requestId: 101,
  documentId: 'doc-alpha',
  snapshotId: 'doc-alpha:101',
  languageTag: 'en',
  text: 'This is draft text.',
  actionId: 'improve-writing',
  scope: 'selected',
}

describe('MockTransformationEngine', () => {
  it('instantiates with sensible default ID, capabilities and availability', async () => {
    const engine = new MockTransformationEngine()
    expect(engine.id).toBe('mock.transformation-engine')
    expect(engine.capabilities.supports).toEqual([
      {
        capability: 'rewrite',
        languages: expect.arrayContaining([
          { tag: 'en', includeSubtags: true },
          { tag: 'hi-IN', includeSubtags: true },
          { tag: 'hi-Latn', includeSubtags: true },
          { tag: 'mixed-hi-en', includeSubtags: true },
        ]),
      },
    ])
    const availability = await engine.getAvailability()
    expect(availability.available).toBe(true)
    expect(availability.reason).toBeUndefined()
  })

  it('respects custom availability settings', async () => {
    const engine = createMockTransformationEngine({
      available: false,
      unavailableReason: 'Service under maintenance',
    })
    const availability = await engine.getAvailability()
    expect(availability.available).toBe(false)
    expect(availability.reason).toBe('Service under maintenance')
  })

  it('performs default text transformation and records request', async () => {
    const engine = createMockTransformationEngine()
    const outcome = await engine.transform(sampleContext)

    expect(outcome.proposedText).toBe('[Improved] This is draft text.')
    expect(engine.receivedRequests).toHaveLength(1)
    expect(engine.receivedRequests[0]).toBe(sampleContext)
  })

  it('includes custom instruction in default transformation output', async () => {
    const engine = createMockTransformationEngine()
    const outcome = await engine.transform({
      ...sampleContext,
      instruction: 'Make it punchy',
    })

    expect(outcome.proposedText).toBe('[Instruction: Make it punchy] This is draft text.')
  })

  it('supports custom transformFn and explanation', async () => {
    const engine = createMockTransformationEngine({
      explanation: 'Polished for conciseness',
      transformFn: (ctx) => ctx.text.toUpperCase(),
    })
    const outcome = await engine.transform(sampleContext)

    expect(outcome.proposedText).toBe('THIS IS DRAFT TEXT.')
    expect(outcome.explanation).toBe('Polished for conciseness')
  })

  it('simulates error throwing when configured', async () => {
    const engine = createMockTransformationEngine({
      throwError: new Error('Rate limit exceeded in mock'),
    })

    await expect(engine.transform(sampleContext)).rejects.toThrow('Rate limit exceeded in mock')
  })

  it('simulates string error when configured', async () => {
    const engine = createMockTransformationEngine({
      throwError: 'String error message',
    })

    await expect(engine.transform(sampleContext)).rejects.toThrow('String error message')
  })

  it('aborts immediately when signal is already aborted', async () => {
    const engine = createMockTransformationEngine({ delayMs: 100 })
    const controller = new AbortController()
    controller.abort()

    await expect(engine.transform(sampleContext, controller.signal)).rejects.toThrow('The operation was aborted')
  })

  it('aborts during simulated delay when signal is triggered', async () => {
    const engine = createMockTransformationEngine({ delayMs: 200 })
    const controller = new AbortController()

    const promise = engine.transform(sampleContext, controller.signal)
    setTimeout(() => controller.abort(), 20)

    await expect(promise).rejects.toThrow('The operation was aborted')
  })
})
