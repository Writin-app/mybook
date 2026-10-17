// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SidebarProvider, useSidebar } from './sidebar'

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }))

function Probe() {
  const { open } = useSidebar()
  return <span data-testid="state">{open ? 'open' : 'closed'}</span>
}

describe('SidebarProvider', () => {
  afterEach(cleanup)

  it('does not toggle on Mod+B so it cannot clash with the bold shortcut', () => {
    const { getByTestId } = render(<SidebarProvider defaultOpen={false}><Probe /></SidebarProvider>)
    const event = new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, cancelable: true })
    act(() => { window.dispatchEvent(event) })
    expect(getByTestId('state').textContent).toBe('closed')
    expect(event.defaultPrevented).toBe(false)
  })
})
