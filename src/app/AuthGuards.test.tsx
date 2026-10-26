// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { RedirectAuthenticated, RequireAuth, RootGate } from './AuthGuards'
import { LegacyGoogleAuthStartRedirect } from './LegacyGoogleAuthStartRedirect'
import { useAuthStore } from '../stores/useAuthStore'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'

function LoginState() {
  const location = useLocation()
  const state = location.state as { from?: string } | null
  return <p>Login from {state?.from ?? 'none'}</p>
}

describe('route protection', () => {
  afterEach(() => cleanup())

  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: false, isLoading: false, error: null })
    useWorkspaceStore.setState({ mode: null })
  })

  it('redirects unauthenticated users to login', () => {
    render(<MemoryRouter initialEntries={['/home']}><Routes><Route element={<RequireAuth />}><Route path="/home" element={<p>Home</p>} /></Route><Route path="/login" element={<p>Login</p>} /></Routes></MemoryRouter>)
    expect(screen.getByText('Login')).toBeInTheDocument()
  })

  it('redirects authenticated users away from login when workspace mode is set', () => {
    useAuthStore.setState({ isAuthenticated: true })
    useWorkspaceStore.setState({ mode: 'drive' })
    render(<MemoryRouter initialEntries={['/login']}><Routes><Route element={<RedirectAuthenticated />}><Route path="/login" element={<p>Login</p>} /></Route><Route path="/home" element={<p>Home</p>} /></Routes></MemoryRouter>)
    expect(screen.getByText('Home')).toBeInTheDocument()
  })

  it('keeps authenticated users on the Google vault setup return even when Drive mode was saved', () => {
    useAuthStore.setState({ isAuthenticated: true })
    useWorkspaceStore.setState({ mode: 'drive' })
    render(<MemoryRouter initialEntries={['/login?setup=google&returnTo=%2Fhome']}><Routes><Route element={<RedirectAuthenticated />}><Route path="/login" element={<p>Vault setup</p>} /></Route><Route path="/home" element={<p>Home</p>} /></Routes></MemoryRouter>)
    expect(screen.getByText('Vault setup')).toBeInTheDocument()
  })

  it('keeps authenticated users on login while workspace mode is not set', () => {
    useAuthStore.setState({ isAuthenticated: true })
    useWorkspaceStore.setState({ mode: null })
    render(<MemoryRouter initialEntries={['/login']}><Routes><Route element={<RedirectAuthenticated />}><Route path="/login" element={<p>Login</p>} /></Route><Route path="/home" element={<p>Home</p>} /></Routes></MemoryRouter>)
    expect(screen.getByText('Login')).toBeInTheDocument()
  })

  it('allows local workspace users without a Google session', () => {
    useWorkspaceStore.setState({ mode: 'local' })
    render(<MemoryRouter initialEntries={['/home']}><Routes><Route element={<RequireAuth />}><Route path="/home" element={<p>Home</p>} /></Route><Route path="/login" element={<p>Login</p>} /></Routes></MemoryRouter>)
    expect(screen.getByText('Home')).toBeInTheDocument()
  })

  it('redirects local workspace users away from login', () => {
    useWorkspaceStore.setState({ mode: 'local' })
    render(<MemoryRouter initialEntries={['/login']}><Routes><Route element={<RedirectAuthenticated />}><Route path="/login" element={<p>Login</p>} /></Route><Route path="/home" element={<p>Home</p>} /></Routes></MemoryRouter>)
    expect(screen.getByText('Home')).toBeInTheDocument()
  })

  it('renders centered session checking overlay when RequireAuth is loading', () => {
    useAuthStore.setState({ isLoading: true })
    render(<MemoryRouter initialEntries={['/home']}><Routes><Route element={<RequireAuth />}><Route path="/home" element={<p>Home</p>} /></Route></Routes></MemoryRouter>)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Checking your session…')).toBeInTheDocument()
  })

  it('renders centered session checking overlay when RedirectAuthenticated is loading', () => {
    useAuthStore.setState({ isLoading: true })
    render(<MemoryRouter initialEntries={['/login']}><Routes><Route element={<RedirectAuthenticated />}><Route path="/login" element={<p>Login</p>} /></Route></Routes></MemoryRouter>)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Checking your session…')).toBeInTheDocument()
  })

  it('preserves legacy Google auth return paths', () => {
    render(<MemoryRouter initialEntries={['/api/auth/google/start?returnTo=%2Fsettings']}><Routes><Route path="/api/auth/google/start" element={<LegacyGoogleAuthStartRedirect />} /><Route path="/login" element={<LoginState />} /></Routes></MemoryRouter>)
    expect(screen.getByText('Login from /settings')).toBeInTheDocument()
  })

  it('renders landing page for unauthenticated users at root as a single page', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<RootGate />} />
          <Route path="/home" element={<p>Home Page</p>} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getAllByText('Writin').length).toBeGreaterThan(0)
    expect(screen.getByText(/Where thoughts/)).toBeInTheDocument()
  })

  it('redirects authenticated drive users at root to /home', () => {
    useAuthStore.setState({ isAuthenticated: true })
    useWorkspaceStore.setState({ mode: 'drive' })
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<RootGate />} />
          <Route path="/about" element={<p>About Page</p>} />
          <Route path="/home" element={<p>Home Page</p>} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Home Page')).toBeInTheDocument()
  })

  it('redirects local workspace users at root to /home', () => {
    useWorkspaceStore.setState({ mode: 'local' })
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<RootGate />} />
          <Route path="/about" element={<p>About Page</p>} />
          <Route path="/home" element={<p>Home Page</p>} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Home Page')).toBeInTheDocument()
  })

  it('renders centered session checking overlay when RootGate is loading', () => {
    useAuthStore.setState({ isLoading: true })
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<RootGate />} />
          <Route path="/about" element={<p>About Page</p>} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Checking your session…')).toBeInTheDocument()
  })
})
