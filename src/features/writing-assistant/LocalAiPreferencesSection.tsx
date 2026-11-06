import { useEffect, useState } from 'react'

import { AppButton } from '../../components/common/AppButton'
import {
  getSharedLocalLlamaEngine,
  LOCAL_AI_MODEL_DISPLAY_NAME,
  persistLocalConsent,
  type LocalEngineStatusReport,
} from './localLlamaEngine'

export function LocalAiPreferencesSection() {
  const [engine] = useState(() => getSharedLocalLlamaEngine())
  const [status, setStatus] = useState<LocalEngineStatusReport>(() => engine.getStatus())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => engine.subscribeStatus(setStatus), [engine])

  const prepareModel = async () => {
    setError(null)
    persistLocalConsent(true)
    engine.grantUserConsent()
    try {
      await engine.init()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not prepare local AI. Please try again.')
    }
  }

  const isBusy = status.state === 'downloading' || status.state === 'initializing'
  const isReady = status.state === 'ready' || status.state === 'generating'

  return (
    <section aria-labelledby="local-ai-heading" className="rounded-2xl bg-muted/70 p-4">
      <h2 id="local-ai-heading" className="text-base font-semibold leading-6">Local AI Model - {LOCAL_AI_MODEL_DISPLAY_NAME}</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        Set up AI writing tools on this device. The model downloads once and stays available for later use.
      </p>
      {!isReady && !isBusy ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {status.isCached
            ? 'The model is downloaded. Prepare it here or let Writin load it when you use an AI action.'
            : 'The first download is about 680 MB. You can also choose Download when you first use an AI action.'}
        </p>
      ) : null}
      {isReady ? <p role="status" className="mt-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">Local AI is ready on this device.</p> : null}
      {isBusy ? (
        <div className="mt-3 space-y-2" role="status" aria-live="polite">
          <div className="flex justify-between gap-3 text-sm">
            <span>{status.state === 'downloading' ? 'Downloading local AI…' : 'Preparing local AI…'}</span>
            <span>{status.progress}%</span>
          </div>
          <progress aria-label="Local AI setup progress" value={status.progress} max={100} className="w-full" />
        </div>
      ) : null}
      {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
      {!isReady ? (
        <AppButton className="mt-4" variant="secondary" isDisabled={isBusy} isLoading={isBusy} loadingLabel={status.state === 'downloading' ? 'Downloading…' : 'Preparing…'} onPress={() => void prepareModel()}>
          {status.isCached ? 'Prepare local AI' : 'Download local AI'}
        </AppButton>
      ) : null}
    </section>
  )
}
