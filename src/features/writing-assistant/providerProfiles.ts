export type ProviderProcessingType = 'local' | 'remote'
export type BrowserDirectSupport = 'supported' | 'blocked-by-cors' | 'requires-cors-configuration'

export interface ProviderPrivacyInfo {
  readonly processingType: ProviderProcessingType
  readonly directBrowserSupport: BrowserDirectSupport
  readonly requiresApiKey: boolean
  readonly dataTransmittedNotice: string
  readonly dataRetentionPolicy: string
  readonly humanReviewNotice?: string
  readonly corsNotice: string
  readonly officialDocsUrl?: string
  readonly freeTierLimitations: string
}

export interface GenerationProviderProfile {
  readonly id: string
  readonly displayName: string
  readonly defaultEndpoint: string
  readonly defaultModel: string
  readonly description: string
  readonly supportedLanguages: readonly string[]
  readonly privacy: ProviderPrivacyInfo
}

export const GENERATION_PROVIDER_PROFILES: readonly GenerationProviderProfile[] = [
  {
    id: 'local',
    displayName: 'Writin On-Device Assistant (Private)',
    defaultEndpoint: 'on-device',
    defaultModel: 'on-device-llama',
    description:
      'Runs directly in your browser using on-device WebGPU (Llama 3.2 1B) for English transformations and WebAssembly (Bergamot Marian NMT) for English ↔ Devanagari Hindi translation. Document text never leaves your device and requires no external software or servers.',
    supportedLanguages: ['en', 'en-IN', 'en-GB', 'en-US', 'hi-IN', 'hi-Latn', 'mixed-hi-en'],
    privacy: {
      processingType: 'local',
      directBrowserSupport: 'supported',
      requiresApiKey: false,
      dataTransmittedNotice:
        'Document content is processed entirely on your device inside browser memory. Zero text is sent to an external service or daemon.',
      dataRetentionPolicy: 'No document data is retained or logged. Processing occurs in temporary device memory.',
      corsNotice: 'Inference runs inside your browser. No network connectivity is required after model download.',
      freeTierLimitations:
        'Free, private, and unlimited on supported devices. Download requires ~680 MB for English writing model and ~20 MB for translation model.',
    },
  },
  {
    id: 'groq',
    displayName: 'Groq Cloud',
    defaultEndpoint: 'https://api.groq.com/openai/v1/chat/completions',
    defaultModel: 'llama-3.1-8b-instant',
    description: 'Fast cloud inference for open models (Llama 3.1 8B). Free tier with personal API key.',
    supportedLanguages: ['en', 'en-IN', 'en-GB', 'en-US', 'hi-IN', 'hi-Latn', 'mixed-hi-en'],
    privacy: {
      processingType: 'remote',
      directBrowserSupport: 'blocked-by-cors',
      requiresApiKey: true,
      dataTransmittedNotice:
        'Selected text or document content is transmitted over HTTPS directly to Groq Cloud servers.',
      dataRetentionPolicy:
        'Customer content is not used to train models. Groq retains logs for up to 30 days for system reliability and abuse monitoring per official terms.',
      corsNotice:
        'Direct browser fetch to api.groq.com is blocked by browser CORS restrictions. Client-side browser requests require routing through a CORS proxy or Cloudflare AI Gateway.',
      officialDocsUrl: 'https://console.groq.com/docs/rate-limits',
      freeTierLimitations:
        'Rate limits and quotas (RPM, RPD, TPM) are determined by Groq and subject to change per official documentation. Bounded by personal API key tier.',
    },
  },
  {
    id: 'gemini',
    displayName: 'Google AI Studio (Gemini)',
    defaultEndpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    defaultModel: 'gemini-1.5-flash',
    description: 'Multilingual generation using Gemini Flash with Hindi support.',
    supportedLanguages: ['en', 'en-IN', 'en-GB', 'en-US', 'hi-IN', 'hi-Latn', 'mixed-hi-en'],
    privacy: {
      processingType: 'remote',
      directBrowserSupport: 'blocked-by-cors',
      requiresApiKey: true,
      dataTransmittedNotice:
        'Selected text or document content is transmitted over HTTPS to Google AI Studio.',
      dataRetentionPolicy:
        'On Google AI Studio free tier, inputs and outputs may be used for model training and reviewed by human annotators per Google terms. Do not submit sensitive personal content.',
      humanReviewNotice:
        'Human reviewers may read de-identified inputs and outputs on the free tier per Google terms of service.',
      corsNotice:
        'Direct browser fetch to Google AI Studio OpenAI-compatible endpoints is blocked by browser CORS restrictions. Requires a CORS proxy or server gateway.',
      officialDocsUrl: 'https://ai.google.dev/pricing',
      freeTierLimitations:
        'Free tier rate limits (15 RPM, 1,500 RPD, 1M TPM on Flash) are determined by Google and subject to change. Regional terms apply.',
    },
  },
  {
    id: 'ollama',
    displayName: 'Ollama Daemon (External Local Service)',
    defaultEndpoint: 'http://localhost:11434/v1/chat/completions',
    defaultModel: '',
    description:
      'Connects to an independently installed Ollama daemon running on your computer at http://localhost:11434. Requires Ollama installed, running, and started with OLLAMA_ORIGINS="*" to permit browser requests.',
    supportedLanguages: ['en', 'en-IN', 'en-GB', 'en-US', 'hi-IN', 'hi-Latn', 'mixed-hi-en'],
    privacy: {
      processingType: 'local',
      directBrowserSupport: 'requires-cors-configuration',
      requiresApiKey: false,
      dataTransmittedNotice:
        'Text is sent locally to http://localhost:11434. Zero document data leaves your computer.',
      dataRetentionPolicy: 'Local daemon processing only. Governed by your local Ollama setup.',
      corsNotice:
        'Ollama must be started with OLLAMA_ORIGINS="*" (or with the app origin permitted) to allow browser fetch requests.',
      officialDocsUrl: 'https://ollama.com',
      freeTierLimitations:
        'Runs locally on user hardware. Execution speed and capacity depend on local RAM, CPU, and GPU resources. Requires Ollama daemon running.',
    },
  },
  {
    id: 'custom',
    displayName: 'Custom OpenAI-Compatible Endpoint',
    defaultEndpoint: '',
    defaultModel: '',
    description: 'Connect to your own private proxy, Cloudflare AI Gateway, or compatible API.',
    supportedLanguages: ['en', 'en-IN', 'en-GB', 'en-US', 'hi-IN', 'hi-Latn', 'mixed-hi-en'],
    privacy: {
      processingType: 'remote',
      directBrowserSupport: 'requires-cors-configuration',
      requiresApiKey: false,
      dataTransmittedNotice: 'Text will be sent to the custom endpoint URL you specify.',
      dataRetentionPolicy: 'Data retention is governed by your custom endpoint provider or self-hosted deployment.',
      corsNotice: 'Ensure your custom endpoint returns standard CORS headers (Access-Control-Allow-Origin).',
      freeTierLimitations: 'Depends entirely on the custom endpoint provider or self-hosted server.',
    },
  },
] as const

const profilesById = new Map<string, GenerationProviderProfile>(
  GENERATION_PROVIDER_PROFILES.map((profile) => [profile.id, profile]),
)

export function getGenerationProviderProfile(providerId: string): GenerationProviderProfile | undefined {
  return profilesById.get(providerId)
}

export function getEffectiveEndpoint(providerId: string, customEndpoint?: string): string {
  const customTrimmed = customEndpoint?.trim()
  if (customTrimmed) return customTrimmed
  return getGenerationProviderProfile(providerId)?.defaultEndpoint ?? ''
}

export const PREFERRED_AI_PROVIDER_STORAGE_KEY = 'writin_preferred_ai_provider_v1'
export const DEFAULT_AI_PROVIDER_ID = 'local'
const PROVIDER_CHANGE_EVENT = 'writin-preferred-ai-provider-change'

export function getPreferredAiProvider(): string {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_AI_PROVIDER_ID
  }
  try {
    const stored = window.localStorage.getItem(PREFERRED_AI_PROVIDER_STORAGE_KEY)
    if (stored && (stored === 'local' || profilesById.has(stored))) {
      return stored
    }
  } catch {
    // Suppress storage access errors (e.g. private browsing restrictions)
  }
  return DEFAULT_AI_PROVIDER_ID
}

export function setPreferredAiProvider(providerId: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    window.localStorage.setItem(PREFERRED_AI_PROVIDER_STORAGE_KEY, providerId)
  } catch {
    // Suppress storage access errors
  }
  try {
    window.dispatchEvent(new CustomEvent(PROVIDER_CHANGE_EVENT, { detail: { providerId } }))
  } catch {
    // Ignore dispatch error in non-browser environments
  }
}

export function subscribePreferredAiProvider(listener: (providerId: string) => void): () => void {
  if (typeof window === 'undefined') return () => {}

  const handleCustomEvent = (event: Event) => {
    const custom = event as CustomEvent<{ providerId?: string }>
    if (custom.detail?.providerId) {
      listener(custom.detail.providerId)
    } else {
      listener(getPreferredAiProvider())
    }
  }

  const handleStorageEvent = (event: StorageEvent) => {
    if (event.key === PREFERRED_AI_PROVIDER_STORAGE_KEY) {
      listener(getPreferredAiProvider())
    }
  }

  window.addEventListener(PROVIDER_CHANGE_EVENT, handleCustomEvent)
  window.addEventListener('storage', handleStorageEvent)

  return () => {
    window.removeEventListener(PROVIDER_CHANGE_EVENT, handleCustomEvent)
    window.removeEventListener('storage', handleStorageEvent)
  }
}

export type DestinationCategory = 'browser-local' | 'ollama-local' | 'remote-api'

export interface AiRoutingDiagnosticInfo {
  readonly entryPoint: string
  readonly savedProviderId: string
  readonly resolvedProviderId: string
  readonly selectedEngine: string
  readonly actionId: string
  readonly destinationCategory: DestinationCategory
  readonly timestamp: number
}

/**
 * Returns safe diagnostic metadata about provider routing and execution target.
 * Never includes API keys, authorization headers, or document content.
 */
export function getAiRoutingDiagnostics(
  entryPoint: string,
  actionId: string,
  preferredProvider?: string,
  engineId?: string,
): AiRoutingDiagnosticInfo {
  const savedProviderId = getPreferredAiProvider()
  const resolvedProviderId = preferredProvider || savedProviderId
  let destinationCategory: DestinationCategory
  if (resolvedProviderId === 'local') {
    destinationCategory = 'browser-local'
  } else if (resolvedProviderId === 'ollama') {
    destinationCategory = 'ollama-local'
  } else {
    destinationCategory = 'remote-api'
  }

  const selectedEngine =
    engineId ??
    (resolvedProviderId === 'local'
      ? actionId === 'translate'
        ? 'writin.bergamot-translator'
        : 'writin.local-llama'
      : `writin.http-engine.${resolvedProviderId}`)

  return {
    entryPoint,
    savedProviderId,
    resolvedProviderId,
    selectedEngine,
    actionId,
    destinationCategory,
    timestamp: Date.now(),
  }
}

/**
 * Safe development log for AI routing diagnostics.
 * Never outputs sensitive credentials or user document text.
 */
export function logAiRoutingDiagnostic(diag: AiRoutingDiagnosticInfo): void {
  if (
    (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') ||
    (typeof window !== 'undefined' &&
      Boolean(
        (window as unknown as { __WRITIN_DEV_DIAGNOSTICS__?: boolean }).__WRITIN_DEV_DIAGNOSTICS__,
      ))
  ) {
    console.debug(
      `[AI Routing] ${diag.entryPoint} -> action=${diag.actionId} provider=${diag.resolvedProviderId} engine=${diag.selectedEngine} dest=${diag.destinationCategory}`,
    )
  }
}

/**
 * Development assertion that verifies strict provider isolation at runtime.
 * Fails immediately if the on-device provider ('local') attempts to dispatch to any network endpoint or localhost:11434.
 */
export function assertProviderIsolation(providerId: string, targetUrl?: string): void {
  if (providerId === 'local') {
    if (
      targetUrl &&
      (targetUrl.includes('11434') ||
        targetUrl.includes('localhost') ||
        targetUrl.includes('127.0.0.1') ||
        targetUrl.startsWith('http://') ||
        targetUrl.startsWith('https://'))
    ) {
      throw new Error(
        `AssertionError: Writin On-Device Assistant ('local') must never dispatch to network URL: ${targetUrl}`,
      )
    }
  }
}

