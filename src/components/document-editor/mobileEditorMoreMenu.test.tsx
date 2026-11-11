// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AppHeader } from '../common/AppHeader'
import { DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from '../ui/dropdown-menu'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { useState } from 'react'

describe('Mobile Editor More Menu & Header Actions', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
      matches: window.innerWidth < 768,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('renders lock action button in header and triggers toggle callback', () => {
    const onLockToggle = vi.fn()
    const { rerender } = render(
      <AppHeader
        lockAction
        isLocked={false}
        onLockToggle={onLockToggle}
        favoriteAction
        isFavorite={false}
      />
    )

    const lockBtn = screen.getByRole('button', { name: 'Enable reading mode' })
    expect(lockBtn).toBeInTheDocument()
    fireEvent.click(lockBtn)
    expect(onLockToggle).toHaveBeenCalledTimes(1)

    rerender(
      <AppHeader
        lockAction
        isLocked={true}
        onLockToggle={onLockToggle}
        favoriteAction
        isFavorite={false}
      />
    )
    expect(screen.getByRole('button', { name: 'Disable reading mode' })).toBeInTheDocument()
  })

  it('hides desktop-only items and kbd shortcuts on mobile, and drills down to Export to subview', () => {
    vi.stubGlobal('innerWidth', 375)

    function TestMenuHarness() {
      const [submenu, setSubmenu] = useState<'main' | 'export'>('main')
      const onExportPdf = vi.fn()
      const onExportMarkdown = vi.fn()
      const onExportDocx = vi.fn()
      const onPrint = vi.fn()

      return (
        <AppHeader
          moreAction
          onMoreOpenChange={(open) => {
            if (!open) setSubmenu('main')
          }}
          moreContent={
            submenu === 'export' ? (
              <div data-testid="export-subview">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Back to more options"
                    onClick={() => setSubmenu('main')}
                  >
                    <HugeiconsIcon icon={ArrowLeft01Icon} />
                  </button>
                  <span>Export to</span>
                </div>
                <DropdownMenuItem onClick={onExportPdf}>PDF (.pdf)</DropdownMenuItem>
                <DropdownMenuItem onClick={onExportMarkdown}>Copy as Markdown</DropdownMenuItem>
                <DropdownMenuItem onClick={onExportDocx}>Word (.docx)</DropdownMenuItem>
              </div>
            ) : (
              <>
                <DropdownMenuItem className="hidden md:flex"><span>Full width</span></DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="hidden md:flex">Zoom</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem>100%</DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuItem>
                  <span>Find and replace</span>
                  <kbd className="ml-auto hidden text-xs text-muted-foreground md:inline">⌘F</kbd>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="hidden md:block" />
                <DropdownMenuItem onClick={onPrint}>
                  <span>Print</span>
                  <kbd className="ml-auto hidden text-xs text-muted-foreground md:inline">⌘P</kbd>
                </DropdownMenuItem>
                <DropdownMenuItem>Import document</DropdownMenuItem>
                <DropdownMenuItem
                  closeOnClick={false}
                  onSelect={(e) => {
                    e.preventDefault()
                    setSubmenu('export')
                  }}
                  className="flex justify-between md:hidden"
                  onClick={() => setSubmenu('export')}
                >
                  <span>Export to</span>
                  <HugeiconsIcon icon={ArrowRight01Icon} />
                </DropdownMenuItem>
              </>
            )
          }
        />
      )
    }

    render(<TestMenuHarness />)

    // Open More menu
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }))

    // Verify Full width and Zoom are hidden on mobile
    const fullWidthItem = screen.getByText('Full width').closest('[role="menuitem"]')
    expect(fullWidthItem).toHaveClass('hidden')
    expect(fullWidthItem).toHaveClass('md:flex')

    const zoomItem = screen.getByText('Zoom').closest('[role="menuitem"]')
    expect(zoomItem).toHaveClass('hidden')
    expect(zoomItem).toHaveClass('md:flex')

    // Verify kbd is hidden on mobile
    const kbd = screen.getByText('⌘F')
    expect(kbd).toHaveClass('hidden')
    expect(kbd).toHaveClass('md:inline')

    // Verify Print is present immediately before Import document
    const printItem = screen.getByRole('menuitem', { name: /Print/ })
    const importItem = screen.getByRole('menuitem', { name: 'Import document' })
    expect(printItem).toBeInTheDocument()
    expect(importItem).toBeInTheDocument()
    expect(printItem.compareDocumentPosition(importItem) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    // Click Export to mobile item
    const exportBtn = screen.getByText('Export to')
    fireEvent.click(exportBtn)

    // Now in export subview
    expect(screen.getByTestId('export-subview')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'PDF (.pdf)' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Copy as Markdown' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Word (.docx)' })).toBeInTheDocument()

    // Click back button to return to main options
    fireEvent.click(screen.getByRole('button', { name: 'Back to more options' }))
    expect(screen.queryByTestId('export-subview')).toBeNull()
    expect(screen.getByText('Find and replace')).toBeInTheDocument()
  })
})
