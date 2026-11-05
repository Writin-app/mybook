import { useState } from 'react'

import { Button } from '../../components/ui/button'
import {
  GENERATION_PROVIDER_PROFILES,
  getEffectiveEndpoint,
  getGenerationProviderProfile,
} from './providerProfiles'
import { maskApiKey, type SessionCredentialStore } from './sessionCredentialStore'

interface ProviderConfigCardProps {
  providerId: string
  credentialStore: SessionCredentialStore
  onProviderChange: (providerId: string) => void
  onClose?: () => void
}

export function ProviderConfigCard({
  providerId,
  credentialStore,
  onProviderChange,
  onClose,
}: ProviderConfigCardProps) {
  const profile = getGenerationProviderProfile(providerId) ?? GENERATION_PROVIDER_PROFILES[0]!
  const cred = credentialStore.getCredential(providerId)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [endpointInput, setEndpointInput] = useState(cred?.endpointUrl ?? '')
  const [modelInput, setModelInput] = useState(cred?.modelId ?? '')
  const [showKey, setShowKey] = useState(false)
  const [ackChecked, setAckChecked] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  const effectiveEndpoint = getEffectiveEndpoint(providerId, endpointInput)
  const isAcknowledged = credentialStore.isDisclosureAcknowledged(providerId, effectiveEndpoint)
  const hasConfiguredKey = Boolean(cred?.apiKey)
  const requiresKey = profile.privacy.requiresApiKey

  const handleSave = () => {
    setSaveMessage(null)
    const trimmedKey = apiKeyInput.trim()
    const finalKey = trimmedKey || cred?.apiKey || ''

    if (requiresKey && !finalKey) {
      setSaveMessage('An API key is required for this provider.')
      return
    }

    credentialStore.setCredential(providerId, {
      apiKey: finalKey,
      endpointUrl: endpointInput.trim() || undefined,
      modelId: modelInput.trim() || undefined,
    })

    if (ackChecked) {
      credentialStore.setDisclosureAcknowledged(providerId, true, effectiveEndpoint)
    }

    setApiKeyInput('')
    setSaveMessage('Settings saved for this browser session.')
  }

  const handleAcknowledgeOnly = () => {
    credentialStore.setDisclosureAcknowledged(providerId, true, effectiveEndpoint)
    setSaveMessage('Privacy disclosure acknowledged.')
  }

  const handleClear = () => {
    credentialStore.clearCredential(providerId)
    setApiKeyInput('')
    setEndpointInput('')
    setModelInput('')
    setAckChecked(false)
    setSaveMessage('Credentials cleared from session memory.')
  }

  return (
    <div
      role="region"
      aria-label="AI Provider Configuration"
      className="space-y-4 rounded-lg border border-[var(--app-border)] bg-[var(--app-subtle)] p-4 text-sm"
    >
      <div className="flex items-center justify-between gap-2 border-b border-[var(--app-border)] pb-3">
        <h3 className="font-semibold text-foreground">AI Provider Configuration</h3>
        {onClose ? (
          <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Close configuration">
            Done
          </Button>
        ) : null}
      </div>

      <div className="space-y-2">
        <label htmlFor="ai-provider-select" className="block text-xs font-medium text-foreground">
          Provider
        </label>
        <select
          id="ai-provider-select"
          aria-label="Select AI Provider"
          value={providerId}
          onChange={(e) => {
            const nextId = e.target.value
            onProviderChange(nextId)
            const nextCred = credentialStore.getCredential(nextId)
            setEndpointInput(nextCred?.endpointUrl ?? '')
            setModelInput(nextCred?.modelId ?? '')
            setApiKeyInput('')
            setAckChecked(false)
            setSaveMessage(null)
          }}
          className="min-h-9 w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-sm text-foreground"
        >
          {GENERATION_PROVIDER_PROFILES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.displayName}{' '}
              {p.id === 'local'
                ? '(In-Browser • Zero Setup)'
                : p.id === 'ollama'
                  ? '(External Daemon at localhost:11434)'
                  : '(Remote API)'}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span
          className={`rounded-full px-2 py-0.5 font-medium ${
            profile.id === 'local'
              ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
              : profile.id === 'ollama'
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
          }`}
        >
          {profile.id === 'local'
            ? 'Local Processing'
            : profile.id === 'ollama'
              ? 'Local Daemon Server'
              : 'Remote Cloud Service'}
        </span>
        <span className="rounded-full bg-[var(--app-surface)] px-2 py-0.5 text-muted-foreground border border-[var(--app-border)]">
          {requiresKey ? 'API Key Required' : 'No Key Required'}
        </span>
      </div>

      <p className="text-xs text-muted-foreground">{profile.description}</p>

      <div className="space-y-1 rounded bg-[var(--app-surface)] p-2.5 text-xs border border-[var(--app-border)]">
        <p className="font-medium text-foreground">Destination Endpoint:</p>
        <code className="block break-all text-[11px] text-muted-foreground">
          {profile.id === 'local' ? 'On-device browser runtime (private, offline-capable)' : effectiveEndpoint || '(none)'}
        </code>
        {profile.privacy.directBrowserSupport === 'blocked-by-cors' ? (
          <p className="text-amber-600 dark:text-amber-400 mt-1">
            Notice: Direct in-browser calls to this cloud endpoint are blocked by browser CORS restrictions. A private CORS gateway or relay is required. Never use public untrusted CORS proxies.
          </p>
        ) : profile.privacy.directBrowserSupport === 'requires-cors-configuration' && profile.id === 'ollama' ? (
          <p className="text-muted-foreground mt-1">
            Notice: Ensure Ollama is running and started with <code className="text-xs font-mono">OLLAMA_ORIGINS=&quot;*&quot;</code> to permit in-browser requests.
          </p>
        ) : null}
      </div>

      {profile.id === 'ollama' ? (
        <div
          role="region"
          aria-label="Ollama Daemon notice"
          className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200 space-y-2"
        >
          <p className="font-semibold">Ollama Daemon (External Local Service)</p>
          <p>
            You have selected an external Ollama daemon running on your computer (<code className="font-mono">http://localhost:11434</code>).
            If you intended to use Writin&apos;s built-in on-device assistant that runs entirely in your browser without installing or running Ollama, switch back to Writin On-Device Assistant.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onProviderChange('local')}
          >
            Switch to Writin On-Device Assistant
          </Button>
        </div>
      ) : null}

      {requiresKey ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="ai-api-key-input" className="block text-xs font-medium text-foreground">
              Personal API Key
            </label>
            {hasConfiguredKey ? (
              <span className="text-[11px] text-green-600 dark:text-green-400 font-mono">
                Active: {maskApiKey(cred?.apiKey ?? '')}
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground">Not configured</span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              id="ai-api-key-input"
              type={showKey ? 'text' : 'password'}
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder={hasConfiguredKey ? '•••••••• (Enter new key to replace)' : 'Enter session API key'}
              className="min-h-9 flex-1 rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-sm text-foreground placeholder:text-muted-foreground"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowKey(!showKey)}
              aria-label={showKey ? 'Hide key' : 'Show key'}
            >
              {showKey ? 'Hide' : 'Show'}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Session-only: kept in browser memory and discarded on tab close. Never written to disk, database, or Google Drive.
          </p>
        </div>
      ) : null}

      {profile.id !== 'local' ? (
        <>
          <div className="space-y-2">
            <label htmlFor="ai-endpoint-input" className="block text-xs font-medium text-foreground">
              Custom Endpoint URL (Optional)
            </label>
            <input
              id="ai-endpoint-input"
              type="url"
              value={endpointInput}
              onChange={(e) => setEndpointInput(e.target.value)}
              placeholder={profile.defaultEndpoint || 'https://.../v1/chat/completions'}
              className="min-h-9 w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-sm text-foreground placeholder:text-muted-foreground font-mono text-xs"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="ai-model-input" className="block text-xs font-medium text-foreground">
              Model ID (Optional)
            </label>
            <input
              id="ai-model-input"
              type="text"
              value={modelInput}
              onChange={(e) => setModelInput(e.target.value)}
              placeholder={profile.defaultModel || 'e.g., llama3.2:1b'}
              className="min-h-9 w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-sm text-foreground placeholder:text-muted-foreground font-mono text-xs"
            />
          </div>
        </>
      ) : null}

      <div
        role="region"
        aria-label="Privacy Disclosure"
        className="space-y-2 rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] p-3 text-xs"
      >
        <h4 className="font-semibold text-foreground">Privacy & Data Handling Notice</h4>
        <p className="text-muted-foreground">{profile.privacy.dataTransmittedNotice}</p>
        <p className="text-muted-foreground">{profile.privacy.dataRetentionPolicy}</p>
        {profile.privacy.humanReviewNotice ? (
          <p className="text-amber-600 dark:text-amber-400">{profile.privacy.humanReviewNotice}</p>
        ) : null}
        <p className="text-[11px] text-muted-foreground italic">{profile.privacy.freeTierLimitations}</p>

        <div className="pt-2">
          {isAcknowledged ? (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-medium">
              <span>✓ Privacy disclosure acknowledged for {effectiveEndpoint}</span>
            </div>
          ) : (
            <label className="flex items-start gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={ackChecked}
                onChange={(e) => setAckChecked(e.target.checked)}
                className="mt-0.5 rounded border-[var(--app-border)]"
              />
              <span className="text-foreground">
                I understand and acknowledge that selected text or document content will be sent to{' '}
                <code className="font-mono text-[11px]">{effectiveEndpoint}</code>.
              </span>
            </label>
          )}
        </div>
      </div>

      {saveMessage ? (
        <p role="status" className="text-xs text-muted-foreground">
          {saveMessage}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button type="button" size="sm" onClick={handleSave}>
          Save for Session
        </Button>
        {!isAcknowledged && ackChecked ? (
          <Button type="button" variant="outline" size="sm" onClick={handleAcknowledgeOnly}>
            Acknowledge Privacy
          </Button>
        ) : null}
        {hasConfiguredKey || cred?.endpointUrl || isAcknowledged ? (
          <Button type="button" variant="ghost" size="sm" onClick={handleClear}>
            Disconnect / Clear
          </Button>
        ) : null}
      </div>
    </div>
  )
}