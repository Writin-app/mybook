import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'

import { App } from './app/App'
import { AppErrorBoundary } from './components/common/AppErrorBoundary'
import './styles/globals.css'

const rootElement = document.getElementById('root')

if (typeof document !== 'undefined') {
  document.addEventListener('gesturestart', (e) => e.preventDefault())
  document.addEventListener('gesturechange', (e) => e.preventDefault())
  document.addEventListener('gestureend', (e) => e.preventDefault())
}

if (!rootElement) {
  throw new Error('Root element was not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <AppErrorBoundary><App /></AppErrorBoundary>
  </StrictMode>,
)
