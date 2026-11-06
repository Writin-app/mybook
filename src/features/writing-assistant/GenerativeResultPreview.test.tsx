// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { GenerativeResultPreview } from './GenerativeResultPreview'

describe('GenerativeResultPreview', () => {
  it('shows a compact inline review with accept, regenerate, and discard controls', () => {
    render(
      <GenerativeResultPreview
        actionTitle="Rewrote the selected text."
        scopeLabel="Selected text"
        sourceText="The original wording."
        proposedText="The improved wording."
        isStale={false}
        compact
        onAccept={vi.fn()}
        onRegenerate={vi.fn()}
        onDiscard={vi.fn()}
      />,
    )

    expect(screen.getByText('Rewrote the selected text.')).toBeInTheDocument()
    expect(screen.getByText('The improved wording.')).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent(/Check names, dates, and important details/)
    expect(screen.getByRole('button', { name: 'Accept generated text' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Regenerate output' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Discard generated preview' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Original text' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Generated output' })).not.toBeInTheDocument()
  })
})
