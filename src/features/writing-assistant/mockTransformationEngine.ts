import type { GenerationContext, TransformationEngine } from './contracts'

export interface MockTransformationEngineOptions {
  id?: string
  supportedLanguages?: readonly string[]
  supportedCapabilities?: readonly ('rewrite' | 'translation')[]
  transformFn?: (context: GenerationContext, signal?: AbortSignal) => Promise<string> | string
  delayMs?: number
  throwError?: Error | string
  available?: boolean
  unavailableReason?: string
  explanation?: string
}

export class MockTransformationEngine implements TransformationEngine {
  readonly id: string
  readonly capabilities: TransformationEngine['capabilities']
  private readonly transformFn?: (context: GenerationContext, signal?: AbortSignal) => Promise<string> | string
  private readonly delayMs: number
  private readonly throwError?: Error | string
  private readonly available: boolean
  private readonly unavailableReason?: string
  private readonly explanation?: string
  readonly receivedRequests: GenerationContext[] = []

  constructor(options: MockTransformationEngineOptions = {}) {
    this.id = options.id ?? 'mock.transformation-engine'
    const supportedLanguages = options.supportedLanguages ?? [
      'en',
      'en-IN',
      'en-GB',
      'en-US',
      'hi-IN',
      'hi-Latn',
      'mixed-hi-en',
    ]
    const supportedCapabilities = options.supportedCapabilities ?? ['rewrite']

    this.capabilities = {
      supports: supportedCapabilities.map((capability) => ({
        capability,
        languages: supportedLanguages.map((tag) => ({ tag, includeSubtags: true })),
      })),
    }

    this.transformFn = options.transformFn
    this.delayMs = options.delayMs ?? 0
    this.throwError = options.throwError
    this.available = options.available ?? true
    this.unavailableReason = options.unavailableReason
    this.explanation = options.explanation
  }

  async getAvailability() {
    return {
      available: this.available,
      reason: this.unavailableReason,
    }
  }

  async transform(context: GenerationContext, signal?: AbortSignal): Promise<{ proposedText: string; explanation?: string }> {
    this.receivedRequests.push(context)

    if (signal?.aborted) {
      throw new DOMException('The operation was aborted', 'AbortError')
    }

    if (this.delayMs > 0) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          signal?.removeEventListener('abort', onAbort)
          resolve()
        }, this.delayMs)

        const onAbort = () => {
          clearTimeout(timer)
          signal?.removeEventListener('abort', onAbort)
          reject(new DOMException('The operation was aborted', 'AbortError'))
        }

        if (signal) {
          signal.addEventListener('abort', onAbort)
        }
      })
    }

    if (this.throwError) {
      if (typeof this.throwError === 'string') {
        throw new Error(this.throwError)
      }
      throw this.throwError
    }

    if (this.transformFn) {
      const proposedText = await this.transformFn(context, signal)
      return { proposedText, explanation: this.explanation }
    }

    const prefix = context.instruction ? `[Instruction: ${context.instruction}] ` : '[Improved] '
    return {
      proposedText: `${prefix}${context.text.trim()}`,
      explanation: this.explanation,
    }
  }
}

export function createMockTransformationEngine(options?: MockTransformationEngineOptions): MockTransformationEngine {
  return new MockTransformationEngine(options)
}
