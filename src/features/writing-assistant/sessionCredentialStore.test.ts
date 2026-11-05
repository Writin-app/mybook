import { beforeEach, describe, expect, it, vi } from 'vitest'

import { maskApiKey, SessionCredentialStore } from './sessionCredentialStore'

describe('SessionCredentialStore', () => {
  let store: SessionCredentialStore

  beforeEach(() => {
    store = new SessionCredentialStore()
  })

  it('masks API keys securely without revealing middle characters', () => {
    expect(maskApiKey('')).toBe('')
    expect(maskApiKey('12345')).toBe('••••••••')
    expect(maskApiKey('12345678')).toBe('••••••••')
    expect(maskApiKey('gsk_1234567890abcdef')).toBe('gsk_••••cdef')
  })

  it('stores and retrieves session credentials in memory', () => {
    store.setCredential('groq', {
      apiKey: 'gsk_secret_12345678',
      modelId: 'llama-3.1-8b-instant',
    })

    expect(store.hasCredential('groq')).toBe(true)
    const cred = store.getCredential('groq')
    expect(cred).toEqual({
      providerId: 'groq',
      apiKey: 'gsk_secret_12345678',
      endpointUrl: undefined,
      modelId: 'llama-3.1-8b-instant',
    })
  })

  it('provides safe masked credentials for UI display', () => {
    store.setCredential('groq', {
      apiKey: 'gsk_super_secret_9999',
      endpointUrl: 'https://api.groq.com/openai/v1/chat/completions',
    })

    const masked = store.getMaskedCredential('groq')
    expect(masked.hasKey).toBe(true)
    expect(masked.maskedKey).toBe('gsk_••••9999')
    expect(masked.maskedKey).not.toContain('super_secret')
  })

  it('clears credential when setting empty key or via clearCredential', () => {
    store.setCredential('groq', { apiKey: 'key-1' })
    expect(store.hasCredential('groq')).toBe(true)

    store.setCredential('groq', { apiKey: '   ' })
    expect(store.hasCredential('groq')).toBe(false)
    expect(store.getCredential('groq')).toBeNull()

    store.setCredential('gemini', { apiKey: 'key-2' })
    expect(store.hasCredential('gemini')).toBe(true)
    store.clearCredential('gemini')
    expect(store.hasCredential('gemini')).toBe(false)
  })

  it('manages privacy disclosure acknowledgement lifecycle', () => {
    expect(store.isDisclosureAcknowledged('groq')).toBe(false)
    store.setDisclosureAcknowledged('groq', true)
    expect(store.isDisclosureAcknowledged('groq')).toBe(true)

    store.setDisclosureAcknowledged('groq', false)
    expect(store.isDisclosureAcknowledged('groq')).toBe(false)

    // Clearing credential also resets disclosure
    store.setDisclosureAcknowledged('groq', true)
    store.clearCredential('groq')
    expect(store.isDisclosureAcknowledged('groq')).toBe(false)
  })

  it('prevents bypassing disclosure by changing endpoint or provider', () => {
    // 1. Acknowledge default groq endpoint
    store.setDisclosureAcknowledged('groq', true)
    expect(store.isDisclosureAcknowledged('groq')).toBe(true)

    // Gemini is not acknowledged
    expect(store.isDisclosureAcknowledged('gemini')).toBe(false)

    // Changing endpoint to custom URL invalidates disclosure
    store.setCredential('groq', {
      apiKey: 'gsk_valid',
      endpointUrl: 'https://custom-proxy.internal/v1/chat/completions',
    })
    expect(store.isDisclosureAcknowledged('groq')).toBe(false)

    // Must explicitly acknowledge the new endpoint
    store.setDisclosureAcknowledged('groq', true, 'https://custom-proxy.internal/v1/chat/completions')
    expect(store.isDisclosureAcknowledged('groq')).toBe(true)

    // Switching back to default endpoint requires acknowledgement of default
    store.setCredential('groq', {
      apiKey: 'gsk_valid',
      endpointUrl: undefined,
    })
    expect(store.isDisclosureAcknowledged('groq')).toBe(false)
  })

  it('supports keyless providers like Ollama without requiring API keys', () => {
    store.setCredential('ollama', {
      endpointUrl: 'http://localhost:11434/v1/chat/completions',
      modelId: 'llama3.2:1b',
    })

    expect(store.hasCredential('ollama')).toBe(true)
    const cred = store.getCredential('ollama')
    expect(cred?.apiKey).toBe('')
    expect(cred?.modelId).toBe('llama3.2:1b')

    const masked = store.getMaskedCredential('ollama')
    expect(masked.hasKey).toBe(false)
    expect(masked.maskedKey).toBe('')
    expect(masked.endpointUrl).toBe('http://localhost:11434/v1/chat/completions')
  })

  it('returns all non-empty API keys across providers for error redaction', () => {
    store.setCredential('groq', { apiKey: 'key-alpha-123' })
    store.setCredential('gemini', { apiKey: 'key-beta-456' })
    store.setCredential('ollama', { apiKey: '' })

    const allKeys = store.getAllApiKeys()
    expect(allKeys).toHaveLength(2)
    expect(allKeys).toContain('key-alpha-123')
    expect(allKeys).toContain('key-beta-456')
    expect(allKeys).not.toContain('')
  })

  it('clears all credentials and disclosures on clearAll()', () => {
    store.setCredential('groq', { apiKey: 'key-1' })
    store.setDisclosureAcknowledged('groq', true)
    store.setCredential('gemini', { apiKey: 'key-2' })
    store.setDisclosureAcknowledged('gemini', true)

    store.clearAll()

    expect(store.hasCredential('groq')).toBe(false)
    expect(store.hasCredential('gemini')).toBe(false)
    expect(store.isDisclosureAcknowledged('groq')).toBe(false)
    expect(store.isDisclosureAcknowledged('gemini')).toBe(false)
  })

  it('notifies subscribers on credential and disclosure changes', () => {
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)

    store.setCredential('groq', { apiKey: 'key-1' })
    expect(listener).toHaveBeenCalledTimes(1)

    store.setDisclosureAcknowledged('groq', true)
    expect(listener).toHaveBeenCalledTimes(2)

    store.clearCredential('groq')
    expect(listener).toHaveBeenCalledTimes(3)

    unsubscribe()
    store.setCredential('groq', { apiKey: 'key-2' })
    expect(listener).toHaveBeenCalledTimes(3)
  })
})
