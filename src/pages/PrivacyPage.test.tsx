// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import { PrivacyPage } from './PrivacyPage'

describe('PrivacyPage', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders privacy policy heading and core commitments', () => {
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { level: 1, name: /privacy policy/i })).toBeInTheDocument()
    expect(screen.getAllByText(/drive\.file/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Google API Services User Data Policy/i)).toBeInTheDocument()
    expect(screen.getByText(/writin\.app@gmail\.com/i)).toBeInTheDocument()
  })

  it('renders links to about, terms, and login', () => {
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>,
    )

    expect(screen.getAllByRole('link', { name: /about/i }).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /terms of service/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open app/i })).toBeInTheDocument()
  })
})
