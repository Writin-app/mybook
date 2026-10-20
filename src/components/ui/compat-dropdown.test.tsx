// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Dropdown } from './compat-dropdown'

let isMobileMock = false
vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => isMobileMock,
}))

afterEach(() => {
  cleanup()
})

describe('Dropdown (compat-dropdown)', () => {
  beforeEach(() => {
    isMobileMock = false
  })

  it('renders standard popover on desktop without bottom sheet attributes', () => {
    isMobileMock = false
    render(
      <Dropdown>
        <Dropdown.Trigger>Open Menu</Dropdown.Trigger>
        <Dropdown.Popover placement="bottom end">
          <Dropdown.Menu aria-label="Test menu">
            <Dropdown.Item id="item1">First item</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open Menu' }))
    const popup = screen.getByRole('menu')
    expect(popup).toBeInTheDocument()
    expect(popup).not.toHaveAttribute('data-bottom-sheet')
    expect(document.querySelector('[data-slot="dropdown-menu-backdrop"]')).toBeNull()
  })

  it('renders bottom sheet on mobile when isMobile is true', () => {
    isMobileMock = true
    render(
      <Dropdown>
        <Dropdown.Trigger>Open Menu</Dropdown.Trigger>
        <Dropdown.Popover placement="bottom end">
          <Dropdown.Menu aria-label="Test menu">
            <Dropdown.Item id="item1">First item</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open Menu' }))
    const popup = screen.getByRole('menu')
    expect(popup).toBeInTheDocument()
    expect(popup).toHaveAttribute('data-bottom-sheet', 'true')
    // Backdrop is present for bottom sheet
    expect(document.querySelector('[data-slot="dropdown-menu-backdrop"]')).toBeInTheDocument()
  })

  it('allows mobileBottomSheet={false} to disable bottom sheet on mobile', () => {
    isMobileMock = true
    render(
      <Dropdown>
        <Dropdown.Trigger>Open Menu</Dropdown.Trigger>
        <Dropdown.Popover placement="bottom end" mobileBottomSheet={false}>
          <Dropdown.Menu aria-label="Test menu">
            <Dropdown.Item id="item1">First item</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open Menu' }))
    const popup = screen.getByRole('menu')
    expect(popup).not.toHaveAttribute('data-bottom-sheet')
  })

  it('allows bottomSheet={true} to force bottom sheet even on desktop', () => {
    isMobileMock = false
    render(
      <Dropdown>
        <Dropdown.Trigger>Open Menu</Dropdown.Trigger>
        <Dropdown.Popover placement="bottom end" bottomSheet={true}>
          <Dropdown.Menu aria-label="Test menu">
            <Dropdown.Item id="item1">First item</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open Menu' }))
    const popup = screen.getByRole('menu')
    expect(popup).toHaveAttribute('data-bottom-sheet', 'true')
  })

  it('forwards aria-label and triggers onAction callback when item is clicked', () => {
    const handleAction = vi.fn()
    render(
      <Dropdown>
        <Dropdown.Trigger>Open Menu</Dropdown.Trigger>
        <Dropdown.Popover>
          <Dropdown.Menu aria-label="Action menu" onAction={handleAction}>
            <Dropdown.Item id="action-1" aria-label="Accessible action 1">
              Action 1
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open Menu' }))
    const item = screen.getByRole('menuitem', { name: 'Accessible action 1' })
    expect(item).toBeInTheDocument()

    fireEvent.click(item)
    expect(handleAction).toHaveBeenCalledWith('action-1')
  })
})
