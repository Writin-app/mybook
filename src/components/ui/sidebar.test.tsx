// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SidebarProvider, useSidebar } from './sidebar'

let isMobileMock = false
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => isMobileMock }))

function Probe() {
  const { open, openMobile, setOpenMobile } = useSidebar()
  return (
    <div>
      <span data-testid="state">{open ? 'open' : 'closed'}</span>
      <span data-testid="mobile-state">{openMobile ? 'open' : 'closed'}</span>
      <button type="button" data-testid="open-mobile-btn" onClick={() => setOpenMobile(true)}>Open Mobile</button>
    </div>
  )
}

describe('SidebarProvider', () => {
  afterEach(() => {
    cleanup()
    isMobileMock = false
  })

  it('does not toggle on Mod+B so it cannot clash with the bold shortcut', () => {
    const { getByTestId } = render(<SidebarProvider defaultOpen={false}><Probe /></SidebarProvider>)
    const event = new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, cancelable: true })
    act(() => { window.dispatchEvent(event) })
    expect(getByTestId('state').textContent).toBe('closed')
    expect(event.defaultPrevented).toBe(false)
  })

  it('closes mobile sidebar when clicking a destination link', async () => {
    isMobileMock = true
    const { Sidebar } = await import('./sidebar')
    const { getByTestId } = render(
      <SidebarProvider>
        <Probe />
        <Sidebar>
          <a href="/folders" data-testid="dest-link"><span>Library</span></a>
          <button type="button" data-testid="theme-btn">Light Theme</button>
        </Sidebar>
      </SidebarProvider>
    )

    act(() => {
      getByTestId('open-mobile-btn').click()
    })
    expect(getByTestId('mobile-state').textContent).toBe('open')

    // Clicking non-navigating button should NOT close the sidebar
    act(() => {
      getByTestId('theme-btn').click()
    })
    expect(getByTestId('mobile-state').textContent).toBe('open')

    // Clicking destination link should close the mobile sidebar
    act(() => {
      getByTestId('dest-link').click()
    })
    expect(getByTestId('mobile-state').textContent).toBe('closed')
  })

  it('preserves open mobile sidebar if destination link is clicked with modifier keys or target="_blank"', async () => {
    isMobileMock = true
    const { Sidebar } = await import('./sidebar')
    const { getByTestId } = render(
      <SidebarProvider>
        <Probe />
        <Sidebar>
          <a href="/target" data-testid="link-newtab" target="_blank">New Tab</a>
          <a href="/folders" data-testid="dest-link">Library</a>
        </Sidebar>
      </SidebarProvider>
    )

    act(() => {
      getByTestId('open-mobile-btn').click()
    })
    expect(getByTestId('mobile-state').textContent).toBe('open')

    // Target _blank does not dismiss
    act(() => {
      getByTestId('link-newtab').click()
    })
    expect(getByTestId('mobile-state').textContent).toBe('open')

    // Meta-key click does not dismiss
    act(() => {
      getByTestId('dest-link').dispatchEvent(new MouseEvent('click', { bubbles: true, metaKey: true }))
    })
    expect(getByTestId('mobile-state').textContent).toBe('open')
  })
})
