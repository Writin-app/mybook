// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import { TermsPage } from './TermsPage'

describe('TermsPage', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders terms of service heading and ownership commitments', () => {
    render(
      <MemoryRouter>
        <TermsPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { level: 1, name: /terms of service/i })).toBeInTheDocument()
    expect(screen.getByText(/100% Content Ownership/i)).toBeInTheDocument()
    expect(screen.getByText(/No AI Training on User Content/i)).toBeInTheDocument()
    expect(screen.getByText(/writin\.app@gmail\.com/i)).toBeInTheDocument()
  })

  it('renders links to about, privacy, and login', () => {
    render(
      <MemoryRouter>
        <TermsPage />
      </MemoryRouter>,
    )

    expect(screen.getAllByRole('link', { name: /about/i }).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /privacy policy/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open app/i })).toBeInTheDocument()
  })
})
