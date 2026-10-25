// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { MobileBottomSheet } from './MobileBottomSheet'

afterEach(() => cleanup())

describe('MobileBottomSheet', () => {
  it('renders content with safe-area padding when footer is absent', () => {
    render(
      <MobileBottomSheet
        isOpen
        trigger={<span>Open Sheet</span>}
        triggerLabel="Open Sheet"
        title="Actions Sheet"
      >
        <p>Sheet body content</p>
      </MobileBottomSheet>,
    )

    expect(screen.getByText('Sheet body content')).toBeInTheDocument()

    // Find the scrollable container
    const bodyText = screen.getByText('Sheet body content')
    const container = bodyText.closest('div')
    expect(container).toHaveClass('overflow-y-auto')
    expect(container).toHaveClass('pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]')
    expect(container).toHaveClass('max-h-[calc(90dvh-4rem)]')
  })

  it('renders footer with safe-area padding and reduces body bottom padding', () => {
    render(
      <MobileBottomSheet
        isOpen
        trigger={<span>Open Sheet</span>}
        triggerLabel="Open Sheet"
        title="Sheet with Footer"
        footer={<button type="button">Done</button>}
      >
        <p>Sheet body with footer</p>
      </MobileBottomSheet>,
    )

    const footerButton = screen.getByRole('button', { name: 'Done' })
    expect(footerButton).toBeInTheDocument()

    const footer = footerButton.closest('div[data-slot="sheet-footer"]')
    expect(footer).toBeInTheDocument()
    expect(footer).toHaveClass('pb-[calc(1rem+env(safe-area-inset-bottom,0px))]')

    const bodyText = screen.getByText('Sheet body with footer')
    const container = bodyText.closest('div')
    expect(container).toHaveClass('pb-3')
    expect(container).not.toHaveClass('pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]')
  })
})
