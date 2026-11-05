import { getEffectiveEndpoint, getGenerationProviderProfile } from './providerProfiles'

export interface SessionCredential {
  providerId: string
  apiKey: string
  endpointUrl?: string
  modelId?: string
}

export interface MaskedSessionCredential {
  providerId: string
  maskedKey: string
  endpointUrl?: string
  modelId?: string
  hasKey: boolean
}

export function maskApiKey(apiKey: string): string {
  if (!apiKey) return ''
  const trimmed = apiKey.trim()
  if (trimmed.length <= 8) return '••••••••'
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`
}

export class SessionCredentialStore {
  private readonly credentials = new Map<string, SessionCredential>()
  private readonly acknowledgedDisclosures = new Map<string, string>() // providerId -> acknowledged endpoint
  private readonly listeners = new Set<() => void>()

  setCredential(
    providerId: string,
    credential: { apiKey?: string; endpointUrl?: string; modelId?: string },
  ): void {
    const trimmedKey = credential.apiKey?.trim() ?? ''
    const profile = getGenerationProviderProfile(providerId)
    const requiresKey = profile?.privacy?.requiresApiKey ?? true

    if (requiresKey && !trimmedKey) {
      this.clearCredential(providerId)
      return
    }

    const existingCred = this.credentials.get(providerId)
    const newEndpoint = credential.endpointUrl?.trim() || undefined

    // Invalidate disclosure acknowledgement if endpoint has changed
    if (existingCred && existingCred.endpointUrl !== newEndpoint) {
      this.acknowledgedDisclosures.delete(providerId)
    }

    this.credentials.set(providerId, {
      providerId,
      apiKey: trimmedKey,
      endpointUrl: newEndpoint,
      modelId: credential.modelId?.trim() || undefined,
    })
    this.notify()
  }

  getCredential(providerId: string): SessionCredential | null {
    const cred = this.credentials.get(providerId)
    if (!cred) return null
    return { ...cred }
  }

  getMaskedCredential(providerId: string): MaskedSessionCredential {
    const cred = this.credentials.get(providerId)
    if (!cred) {
      return {
        providerId,
        maskedKey: '',
        hasKey: false,
      }
    }

    return {
      providerId,
      maskedKey: maskApiKey(cred.apiKey),
      endpointUrl: cred.endpointUrl,
      modelId: cred.modelId,
      hasKey: cred.apiKey.length > 0,
    }
  }

  hasCredential(providerId: string): boolean {
    const cred = this.credentials.get(providerId)
    if (!cred) return false
    const profile = getGenerationProviderProfile(providerId)
    const requiresKey = profile?.privacy?.requiresApiKey ?? true
    return requiresKey ? cred.apiKey.length > 0 : true
  }

  clearCredential(providerId: string): void {
    this.credentials.delete(providerId)
    this.acknowledgedDisclosures.delete(providerId)
    this.notify()
  }

  clearAll(): void {
    this.credentials.clear()
    this.acknowledgedDisclosures.clear()
    this.notify()
  }

  setDisclosureAcknowledged(providerId: string, acknowledged: boolean, endpointUrl?: string): void {
    if (acknowledged) {
      const targetEndpoint = endpointUrl?.trim() || this.getEffectiveEndpoint(providerId)
      if (targetEndpoint) {
        this.acknowledgedDisclosures.set(providerId, targetEndpoint)
      }
    } else {
      this.acknowledgedDisclosures.delete(providerId)
    }
    this.notify()
  }

  isDisclosureAcknowledged(providerId: string, endpointUrl?: string): boolean {
    const acknowledgedEndpoint = this.acknowledgedDisclosures.get(providerId)
    if (!acknowledgedEndpoint) return false
    const currentEndpoint = endpointUrl?.trim() || this.getEffectiveEndpoint(providerId)
    return acknowledgedEndpoint === currentEndpoint
  }

  /** Returns all active in-memory API keys across providers for error message redaction. */
  getAllApiKeys(): string[] {
    const keys: string[] = []
    for (const cred of this.credentials.values()) {
      if (cred.apiKey) {
        keys.push(cred.apiKey)
      }
    }
    return keys
  }

  getEffectiveEndpoint(providerId: string): string {
    const cred = this.credentials.get(providerId)
    return getEffectiveEndpoint(providerId, cred?.endpointUrl)
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener()
      } catch {
        // Observers must not crash credential management
      }
    }
  }
}

/** Global singleton session credential store. Kept strictly in memory. */
export const sessionCredentialStore = new SessionCredentialStore()
