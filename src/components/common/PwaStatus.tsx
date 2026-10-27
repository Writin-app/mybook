import { ArrowDownTrayIcon, ArrowPathIcon, SignalIcon } from '@heroicons/react/24/outline'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { useAuthStore } from '../../stores/useAuthStore'
import { usePwaStore } from '../../stores/usePwaStore'
import { Progress } from '../ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { AppButton } from './AppButton'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const INSTALL_HELP_STORAGE_PREFIX = 'mybook-install-help-seen:'

export function PwaStatus() {
  const [online, setOnline] = useState(() => navigator.onLine)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallHelp, setShowInstallHelp] = useState(false)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const { email, isAuthenticated } = useAuthStore()

  const storeNeedRefresh = usePwaStore((state) => state.needRefresh)
  const isUpdating = usePwaStore((state) => state.isUpdating)
  const updateProgress = usePwaStore((state) => state.updateProgress)
  const updateStatusMessage = usePwaStore((state) => state.updateStatusMessage)
  const startUpdate = usePwaStore((state) => state.startUpdate)

  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW: (_swUrl, swRegistration) => {
      setRegistration(swRegistration ?? null)
      usePwaStore.getState().setRegistration(swRegistration ?? null)
    },
  })

  useEffect(() => {
    if (needRefresh) {
      usePwaStore.getState().setNeedRefresh(true)
    }
  }, [needRefresh])

  useEffect(() => {
    usePwaStore.getState().setUpdateServiceWorkerFn(updateServiceWorker)
  }, [updateServiceWorker])

  const effectiveNeedRefresh = needRefresh || storeNeedRefresh

  const dismissUpdateDialog = useCallback(() => {
    if (!isUpdating) {
      setNeedRefresh(false)
      usePwaStore.getState().setNeedRefresh(false)
    }
  }, [isUpdating, setNeedRefresh])
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const isSafari = isIos && /safari/i.test(navigator.userAgent) && !/crios|fxios|edgios/i.test(navigator.userAgent)
  const isStandalone =
    (typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(display-mode: standalone)').matches
      : false) || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  const installHelpStorageKey = useMemo(
    () => email ? `${INSTALL_HELP_STORAGE_PREFIX}${email.trim().toLowerCase()}` : null,
    [email],
  )
  const canOfferInstall = Boolean(installPrompt) || (isSafari && !isStandalone)

  useEffect(() => {
    const onlineHandler = () => setOnline(true)
    const offlineHandler = () => setOnline(false)
    const installHandler = (event: Event) => { event.preventDefault(); setInstallPrompt(event as BeforeInstallPromptEvent) }
    window.addEventListener('online', onlineHandler)
    window.addEventListener('offline', offlineHandler)
    window.addEventListener('beforeinstallprompt', installHandler)
    return () => { window.removeEventListener('online', onlineHandler); window.removeEventListener('offline', offlineHandler); window.removeEventListener('beforeinstallprompt', installHandler) }
  }, [])

  useEffect(() => {
    if (!isAuthenticated || !installHelpStorageKey || isStandalone || !canOfferInstall) {
      setShowInstallHelp(false)
      return
    }

    setShowInstallHelp(localStorage.getItem(installHelpStorageKey) !== 'true')
  }, [canOfferInstall, installHelpStorageKey, isAuthenticated, isStandalone])

  const dismissInstallHelp = () => {
    if (installHelpStorageKey) localStorage.setItem(installHelpStorageKey, 'true')
    setShowInstallHelp(false)
  }

  const install = async () => {
    if (!installPrompt) return
    dismissInstallHelp()
    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  const checkForUpdates = useCallback(() => {
    if (registration) {
      void registration.update().catch(() => undefined)
    } else if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      void navigator.serviceWorker.ready.then((reg) => {
        setRegistration(reg)
        return reg.update()
      }).catch(() => undefined)
    }
  }, [registration])

  useEffect(() => {
    checkForUpdates()
    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') checkForUpdates()
    }
    const pageShowHandler = () => checkForUpdates()
    const focusHandler = () => checkForUpdates()
    const interval = window.setInterval(checkForUpdates, isIos ? 15 * 60 * 1000 : 30 * 60 * 1000)

    document.addEventListener('visibilitychange', visibilityHandler)
    window.addEventListener('pageshow', pageShowHandler)
    window.addEventListener('focus', focusHandler)
    return () => {
      document.removeEventListener('visibilitychange', visibilityHandler)
      window.removeEventListener('pageshow', pageShowHandler)
      window.removeEventListener('focus', focusHandler)
      window.clearInterval(interval)
    }
  }, [checkForUpdates, isIos])

  return <>
    {!online ? <div role="status" className="shrink-0 border-b border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-center text-sm text-yellow-800"><SignalIcon className="mr-1 inline size-4" />Offline mode: saved local files remain available. Drive sync will resume when you reconnect.</div> : null}
    {effectiveNeedRefresh ? (
      <div role="status" className="shrink-0 border-b border-accent/30 bg-primary/10 px-4 py-2 text-center text-sm">
        <ArrowPathIcon aria-hidden="true" className={`mr-1 inline size-4 ${isUpdating ? 'animate-spin' : ''}`} />
        Update available.{' '}
        <button
          type="button"
          disabled={isUpdating}
          className="min-h-11 rounded-lg px-2 font-semibold underline disabled:opacity-50"
          onClick={() => void startUpdate()}
        >
          {isUpdating ? 'Updating…' : 'Update Writin'}
        </button>
      </div>
    ) : null}

    <Dialog
      open={showInstallHelp}
      onOpenChange={(isOpen) => {
        if (!isOpen) dismissInstallHelp()
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mb-2 flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ArrowDownTrayIcon aria-hidden="true" className="size-6" />
          </div>
          <DialogTitle>Install Writin</DialogTitle>
          <div className="text-sm leading-6 text-muted-foreground">
            {isSafari ? (
              <ol className="list-decimal space-y-2 pl-5">
                <li>Tap Safari&apos;s Share button.</li>
                <li>Choose <span className="font-medium text-foreground">Add to Home Screen</span>.</li>
                <li>Tap <span className="font-medium text-foreground">Add</span>.</li>
              </ol>
            ) : (
                <p>Install Writin for faster access and reliable offline use.</p>
              )}
          </div>
        </DialogHeader>
        <DialogFooter>
          <AppButton variant="secondary" onPress={dismissInstallHelp}>
            {installPrompt ? 'Not now' : 'Got it'}
          </AppButton>
          {installPrompt ? <AppButton variant="primary" onPress={() => void install()}>Install</AppButton> : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog
      open={effectiveNeedRefresh}
      onOpenChange={(isOpen) => {
        if (!isOpen) dismissUpdateDialog()
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mb-2 flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ArrowPathIcon aria-hidden="true" className={`size-6 ${isUpdating ? 'animate-spin' : ''}`} />
          </div>
          <DialogTitle>Update available</DialogTitle>
          <DialogDescription>
            {isUpdating
              ? (updateStatusMessage ?? 'Updating Writin to the latest version…')
              : 'A newer version of Writin is ready. Update now to use the latest fixes.'}
          </DialogDescription>
        </DialogHeader>

        {isUpdating ? (
          <div className="my-2 space-y-1.5">
            <Progress value={updateProgress} className="w-full" />
            <p className="text-xs text-muted-foreground text-center font-medium">{updateProgress}% completed</p>
          </div>
        ) : null}

        <DialogFooter>
          <AppButton
            variant="secondary"
            isDisabled={isUpdating}
            onPress={dismissUpdateDialog}
          >
            Not now
          </AppButton>
          <AppButton
            variant="primary"
            isLoading={isUpdating}
            loadingLabel="Updating…"
            onPress={() => void startUpdate()}
          >
            Update Writin
          </AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}
