import { createBrowserRouter } from 'react-router-dom'

import { AppLayout } from '../components/layout/AppLayout'
import { AboutPage } from '../pages/AboutPage'
import { PrivacyPage } from '../pages/PrivacyPage'
import { TermsPage } from '../pages/TermsPage'
import { DocumentEditorPage } from '../pages/DocumentEditorPage'
import { DesignSystemPage } from '../pages/DesignSystemPage'
import { FolderPage } from '../pages/FolderPage'
import { FoldersPage } from '../pages/FoldersPage'
import { HomePage } from '../pages/HomePage'
import { LoginPage } from '../pages/LoginPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { SettingsPage } from '../pages/SettingsPage'
import { SearchPage } from '../pages/SearchPage'
import { TrashPage } from '../pages/TrashPage'
import { RedirectAuthenticated, RequireAuth, RootGate } from './AuthGuards'
import { LegacyGoogleAuthStartRedirect } from './LegacyGoogleAuthStartRedirect'

export const router = createBrowserRouter([
  { path: '/', element: <RootGate /> },
  { path: '/about', element: <AboutPage /> },
  { path: '/privacy', element: <PrivacyPage /> },
  { path: '/terms', element: <TermsPage /> },
  { path: '/api/auth/google/start', element: <LegacyGoogleAuthStartRedirect /> },
  {
    element: <RedirectAuthenticated />,
    children: [{ path: '/login', element: <LoginPage /> }],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/home', element: <HomePage /> },
          { path: '/favorites', element: <HomePage initialTab="favorites" /> },
          { path: '/folders', element: <FoldersPage /> },
          { path: '/folders/:folderId', element: <FolderPage /> },
          { path: '/search', element: <SearchPage /> },
          { path: '/trash', element: <TrashPage /> },
          { path: '/document/:documentId', element: <DocumentEditorPage /> },
          {
            path: '/spreadsheet/:spreadsheetId',
            lazy: async () => {
              const { SpreadsheetEditorPage } = await import('../pages/SpreadsheetEditorPage')
              return { Component: SpreadsheetEditorPage }
            },
          },
          { path: '/settings', element: <SettingsPage /> },
          { path: '/design-system', element: <DesignSystemPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
