import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { decodeJwtPayload, loadGoogleIdentity } from '../utils/googleIdentity'
import { clearAccountDriveCache } from '../database/repositories'
import { useWorkspaceStore } from './useWorkspaceStore'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? ''
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive'
export const isBackendAuthEnabled = import.meta.env.VITE_GOOGLE_AUTH_MODE === 'server'
const AUTH_API_BASE = (import.meta.env.VITE_AUTH_API_BASE?.trim() || '/api/auth').replace(/\/$/u, '')
const AUTH_API_EXTENSION = import.meta.env.VITE_AUTH_API_EXTENSION ?? ''

export function authApiUrl(path: string) {
  return `${AUTH_API_BASE}${path}${AUTH_API_EXTENSION}`
}

interface AuthState {
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  email: string | null
  displayName: string | null
  accessToken: string | null
  accessTokenExpiresAt: number | null
  initializeSession: () => Promise<void>
  login: () => Promise<boolean>
  completeLogin: (credential: string, prompt: '' | 'consent' | 'select_account') => Promise<boolean>
  reconnect: () => Promise<boolean>
  logout: () => Promise<void>
  clearError: () => void
  getAccessToken: () => Promise<string | null>
}

interface TokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

export function isTokenFresh(expiresAt: number | null) {
  return typeof expiresAt === 'number' && expiresAt - Date.now() > 60_000
}

function configuredErrors() {
  if (isBackendAuthEnabled) return null
  if (!GOOGLE_CLIENT_ID) return 'Set VITE_GOOGLE_CLIENT_ID to enable Google sign-in.'
  return null
}

export function getAuthConfigError() {
  return configuredErrors()
}

export function getFriendlyGoogleAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('access_denied')) {
    return 'Google blocked access. Make sure your account is added as a test user in Google Cloud Console.'
  }
  if (message.includes('invalid_client')) {
    return 'Google rejected the client setup. Check the OAuth client ID and authorized JavaScript origins.'
  }
  if (message.includes('dismissed')) {
    return 'Google sign-in was closed before completion.'
  }
  return error instanceof Error ? error.message : 'We could not sign you in.'
}

function safeStoredState(state: Pick<AuthState, 'email' | 'displayName' | 'accessToken' | 'accessTokenExpiresAt'>) {
  return {
    email: state.email,
    displayName: state.displayName,
    accessToken: isBackendAuthEnabled ? null : state.accessToken,
    accessTokenExpiresAt: isBackendAuthEnabled ? null : state.accessTokenExpiresAt,
  }
}

let expiryTimer: number | null = null
let tokenRefreshPromise: Promise<{ accessToken: string; accessTokenExpiresAt: number; email?: string }> | null = null

function clearExpiryTimer() {
  if (expiryTimer !== null) {
    window.clearTimeout(expiryTimer)
    expiryTimer = null
  }
}

function scheduleExpiry(set: (partial: Partial<AuthState>) => void, expiresAt: number | null) {
  clearExpiryTimer()
  if (expiresAt === null || !isTokenFresh(expiresAt)) return
  const timeout = Math.max(1000, expiresAt - Date.now())
  expiryTimer = window.setTimeout(() => {
    set({
      accessToken: null,
      accessTokenExpiresAt: null,
    })
  }, timeout)
}

async function requestDriveAccessToken(prompt: '' | 'consent' | 'select_account', hint?: string) {
  const configuredError = configuredErrors()
  if (configuredError) throw new Error(configuredError)

  await loadGoogleIdentity()
  const google = window.google
  if (!google?.accounts?.oauth2) throw new Error('Google Identity Services is unavailable.')

  const tokenResponse = await new Promise<TokenResponse>((resolve, reject) => {
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      hint: hint || undefined,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description ?? 'Google denied access to Drive.'))
          return
        }
        resolve(response)
      },
    })
    tokenClient.requestAccessToken({ prompt, hint: hint || undefined })
  })

  const accessToken = tokenResponse.access_token
  const expiresIn = tokenResponse.expires_in
  if (!accessToken || typeof expiresIn !== 'number') throw new Error('Google did not return an access token.')

  return {
    accessToken,
    accessTokenExpiresAt: Date.now() + expiresIn * 1000,
  }
}

async function readBackendSession() {
  const response = await fetch(authApiUrl('/session'), { credentials: 'include' })
  if (!response.ok) throw new Error('Could not check your sign-in session.')
  return await response.json() as { authenticated: boolean; email: string | null }
}

async function requestBackendDriveAccessToken() {
  const response = await fetch(authApiUrl('/token'), {
    method: 'POST',
    credentials: 'include',
  })
  const body = await response.json().catch(() => null) as { accessToken?: string; expiresIn?: number; email?: string; error?: string } | null
  if (!response.ok || !body?.accessToken || typeof body.expiresIn !== 'number') {
    throw new Error(body?.error ?? 'Google Drive needs to reconnect.')
  }
  return {
    email: body.email,
    accessToken: body.accessToken,
    accessTokenExpiresAt: Date.now() + body.expiresIn * 1000,
  }
}

async function completeLoginWithCredential(credential: string, prompt: '' | 'consent' | 'select_account') {
  const configuredError = configuredErrors()
  if (configuredError) throw new Error(configuredError)

  await loadGoogleIdentity()
  const payload = decodeJwtPayload(credential)
  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : ''
  const emailVerified = payload.email_verified === true || payload.email_verified === 'true'
  if (!email || !emailVerified) throw new Error('Google account email could not be verified.')

  const google = window.google
  if (!google?.accounts?.oauth2) throw new Error('Google Identity Services is unavailable.')

  const tokenResponse = await new Promise<TokenResponse>((resolve, reject) => {
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      hint: email,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description ?? 'Google denied access to Drive.'))
          return
        }
        resolve(response)
      },
    })
    tokenClient.requestAccessToken({ prompt, hint: email })
  })

  const accessToken = tokenResponse.access_token
  const expiresIn = tokenResponse.expires_in
  if (!accessToken || typeof expiresIn !== 'number') throw new Error('Google did not return an access token.')

  return {
    email,
    displayName: typeof payload.name === 'string' ? payload.name.trim() || null : null,
    accessToken,
    accessTokenExpiresAt: Date.now() + expiresIn * 1000,
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      isLoading: isBackendAuthEnabled,
      error: null,
      email: null,
      displayName: null,
      accessToken: null,
      accessTokenExpiresAt: null,
      clearError: () => set({ error: null }),
      initializeSession: async () => {
        if (!isBackendAuthEnabled) return
        set({ isLoading: true })
        try {
          const prevEmail = get().email
          const session = await readBackendSession()
          if (session.email && prevEmail && prevEmail.toLowerCase() !== session.email.toLowerCase()) {
            await clearAccountDriveCache().catch(() => undefined)
          }
          set({
            isAuthenticated: session.authenticated || Boolean(get().email),
            isLoading: false,
            error: null,
            email: session.email ?? get().email,
            displayName: get().displayName,
          })
        } catch (error) {
          set({
            isAuthenticated: Boolean(get().email),
            isLoading: false,
            error: error instanceof Error ? error.message : 'Could not check your sign-in session.',
          })
        }
      },
      completeLogin: async (credential, prompt) => {
        if (isBackendAuthEnabled) {
          window.location.assign(`${authApiUrl('/google/start')}?returnTo=/home`)
          return false
        }
        try {
          const prevEmail = get().email
          const session = await completeLoginWithCredential(credential, prompt)
          if (prevEmail && prevEmail.toLowerCase() !== session.email.toLowerCase()) {
            await clearAccountDriveCache().catch(() => undefined)
          }
          set({
            isAuthenticated: true,
            isLoading: false,
            error: null,
            email: session.email,
            displayName: session.displayName,
            accessToken: session.accessToken,
            accessTokenExpiresAt: session.accessTokenExpiresAt,
          })
          scheduleExpiry(set, session.accessTokenExpiresAt)
          return true
        } catch (error) {
          set({
            isAuthenticated: false,
            isLoading: false,
            error: getFriendlyGoogleAuthError(error),
          })
          return false
        }
      },
      getAccessToken: () => {
        const { accessToken, accessTokenExpiresAt } = get()
        if (accessToken && isTokenFresh(accessTokenExpiresAt)) return Promise.resolve(accessToken)
        if (isBackendAuthEnabled) {
          tokenRefreshPromise ??= requestBackendDriveAccessToken()
          return tokenRefreshPromise
            .then((session) => {
              set({
                isAuthenticated: true,
                error: null,
                email: session.email ?? get().email,
                accessToken: session.accessToken,
                accessTokenExpiresAt: session.accessTokenExpiresAt,
              })
              scheduleExpiry(set, session.accessTokenExpiresAt)
              return session.accessToken
            })
            .catch((error) => {
              set({
                isAuthenticated: Boolean(get().email),
                accessToken: null,
                accessTokenExpiresAt: null,
                error: getFriendlyGoogleAuthError(error) || 'Google Drive needs to reconnect.',
              })
              return null
            })
            .finally(() => {
              tokenRefreshPromise = null
            })
        }
        const { email } = get()
        if (!email) {
          set({
            isAuthenticated: false,
            accessToken: null,
            accessTokenExpiresAt: null,
            error: 'Please sign in to connect Google Drive.',
          })
          return Promise.resolve(null)
        }
        tokenRefreshPromise ??= requestDriveAccessToken('', email)
        return tokenRefreshPromise
          .then((session) => {
            set({
              isAuthenticated: true,
              error: null,
              accessToken: session.accessToken,
              accessTokenExpiresAt: session.accessTokenExpiresAt,
            })
            scheduleExpiry(set, session.accessTokenExpiresAt)
            return session.accessToken
          })
          .catch((error) => {
            set({
              isAuthenticated: Boolean(get().email),
              accessToken: null,
              accessTokenExpiresAt: null,
              error: getFriendlyGoogleAuthError(error) || 'Google Drive needs to reconnect.',
            })
            return null
          })
          .finally(() => {
            tokenRefreshPromise = null
          })
      },
      login: async () => {
        if (isBackendAuthEnabled) {
          set({ isLoading: true, error: null })
          window.location.assign(`${authApiUrl('/google/start')}?returnTo=/home`)
          return false
        }
        set({ isLoading: true, error: null })
        try {
          const email = get().email
          const token = await requestDriveAccessToken('consent', email || undefined)
          if (!email) throw new Error('Please use the Google sign-in button first.')
          set({
            isAuthenticated: true,
            isLoading: false,
            error: null,
            accessToken: token.accessToken,
            accessTokenExpiresAt: token.accessTokenExpiresAt,
          })
          scheduleExpiry(set, token.accessTokenExpiresAt)
          return true
        } catch (error) {
          set({
            isAuthenticated: false,
            isLoading: false,
            error: getFriendlyGoogleAuthError(error),
          })
          return false
        }
      },
      reconnect: async () => {
        if (isBackendAuthEnabled) {
          set({ isLoading: true, error: null })
          window.location.assign(`${authApiUrl('/google/start')}?returnTo=/home`)
          return false
        }
        set({ isLoading: true, error: null })
        try {
          const email = get().email
          const token = await requestDriveAccessToken('select_account', email || undefined)
          if (!email) throw new Error('Please sign in again.')
          set({
            isAuthenticated: true,
            isLoading: false,
            error: null,
            email,
            accessToken: token.accessToken,
            accessTokenExpiresAt: token.accessTokenExpiresAt,
          })
          scheduleExpiry(set, token.accessTokenExpiresAt)
          return true
        } catch (error) {
          set({
            isAuthenticated: Boolean(get().email),
            isLoading: false,
            error: getFriendlyGoogleAuthError(error) || 'We could not reconnect your Google session.',
          })
          return false
        }
      },
      logout: async () => {
        const accessToken = get().accessToken
        if (isBackendAuthEnabled) {
          await fetch(authApiUrl('/logout'), { method: 'POST', credentials: 'include' }).catch(() => undefined)
        }
        await clearAccountDriveCache().catch(() => undefined)
        useWorkspaceStore.getState().clearWorkspace()
        set({
          isAuthenticated: false,
          isLoading: false,
          error: null,
          email: null,
          displayName: null,
          accessToken: null,
          accessTokenExpiresAt: null,
        })
        clearExpiryTimer()
        if (!isBackendAuthEnabled && accessToken && window.google?.accounts?.oauth2) {
          window.google.accounts.oauth2.revoke(accessToken, () => undefined)
        }
        window.google?.accounts?.id?.disableAutoSelect()
      },
    }),
    {
      name: 'mybook-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => safeStoredState(state),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        if (!isTokenFresh(state.accessTokenExpiresAt)) {
          state.accessToken = null
          state.accessTokenExpiresAt = null
          state.isAuthenticated = Boolean(state.email)
        } else {
          state.isAuthenticated = true
          scheduleExpiry(
            (partial) => {
              Object.assign(state, partial)
            },
            state.accessTokenExpiresAt,
          )
        }
      },
    },
  ),
)
