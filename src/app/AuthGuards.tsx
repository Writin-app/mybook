import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { LoadingOverlay } from '../components/common/LoadingOverlay'
import { AboutPage } from '../pages/AboutPage'
import { useAuthStore } from '../stores/useAuthStore'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'

export function RequireAuth() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isLoading = useAuthStore((state) => state.isLoading)
  const workspaceMode = useWorkspaceStore((state) => state.mode)
  const location = useLocation()

  if (isLoading) {
    return <LoadingOverlay message="Checking your session…" />
  }

  if (!isAuthenticated && workspaceMode !== 'local') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

export function RedirectAuthenticated() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isLoading = useAuthStore((state) => state.isLoading)
  const workspaceMode = useWorkspaceStore((state) => state.mode)
  const location = useLocation()
  const isGoogleSetupReturn = new URLSearchParams(location.search).get('setup') === 'google'

  if (isLoading) {
    return <LoadingOverlay message="Checking your session…" />
  }

  return ((isAuthenticated && workspaceMode === 'drive' && !isGoogleSetupReturn) || workspaceMode === 'local')
    ? <Navigate to="/home" replace />
    : <Outlet />
}

export function RootGate() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isLoading = useAuthStore((state) => state.isLoading)
  const workspaceMode = useWorkspaceStore((state) => state.mode)

  if (isLoading) {
    return <LoadingOverlay message="Checking your session…" />
  }

  const isUserLoggedIn = (isAuthenticated && workspaceMode === 'drive') || workspaceMode === 'local'

  return isUserLoggedIn
    ? <Navigate to="/home" replace />
    : <AboutPage />
}
