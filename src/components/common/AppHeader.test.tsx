// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'

import { TextBoldIcon, TextItalicIcon } from '@hugeicons/core-free-icons'
import { createRef } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AppHeader } from './AppHeader'
import { DropdownMenuItem } from '../ui/dropdown-menu'

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
    matches: window.innerWidth < 768, media: query,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('AppHeader', () => {
  it('uses a mobile rename modal and saves the edited name', () => {
    vi.stubGlobal('innerWidth', 375)
    const onRename = vi.fn()
    render(<AppHeader breadcrumbs={[{ label: 'Draft' }]} onBreadcrumbRename={onRename} />)
    fireEvent.click(screen.getByRole('button', { name: 'Rename Draft' }))
    expect(screen.getByRole('dialog', { name: 'Rename file' })).toHaveAttribute('data-slot', 'dialog-content')
    expect(document.querySelector('[data-slot="dialog-overlay"]')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'File name' }), { target: { value: ' Renamed ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onRename).toHaveBeenCalledWith('Renamed')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it.each([375, 768, 1280])('uses the correct menu presentation at %ipx', async (width) => {
    vi.stubGlobal('innerWidth', width)
    const onMore = vi.fn()
    render(<AppHeader moreAction moreContent={<DropdownMenuItem onClick={onMore}>Save now</DropdownMenuItem>} />)
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
    expect(screen.getByRole('menu').hasAttribute('data-bottom-sheet')).toBe(width < 768)
    expect(!!document.querySelector('[data-slot="dropdown-menu-backdrop"]')).toBe(width < 768)
    expect(screen.getByRole('menu').style.maxHeight).toBe(width < 768 ? '90vh' : '')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Save now' }))
    expect(onMore).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Add new' }))
    expect(screen.getByRole('menu').hasAttribute('data-bottom-sheet')).toBe(width < 768)
    expect(!!document.querySelector('[data-slot="dropdown-menu-backdrop"]')).toBe(width < 768)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Document' }))
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  })

  it.each([375, 768, 1280])('hides opted-in leading controls and breadcrumbs only on mobile at %ipx', (width) => {
    vi.stubGlobal('innerWidth', width)
    render(<AppHeader hideLeadingOnMobile hideBreadcrumbsOnMobile onBack={vi.fn()} breadcrumbs={[{ label: 'Draft' }]} />)
    expect(!!screen.queryByRole('button', { name: 'Open navigation' })).toBe(width >= 768)
    expect(!!screen.queryByRole('button', { name: 'Go back' })).toBe(width >= 768)
    expect(!!screen.queryByRole('navigation', { name: 'breadcrumb' })).toBe(width >= 768)
  })

  it('renders the page identity and optional rows', () => {
    render(
      <AppHeader
        title="Project notes"
        breadcrumbs={[{ label: 'Home' }, { label: 'Project notes' }]}
        status="saved"
        shareAction
        toolbar={<div>Formatting toolbar</div>}
        segmentControl={<div>View controls</div>}
      />,
    )

    expect(screen.queryByRole('heading', { name: 'Project notes' })).toBeNull()
    expect(screen.getByRole('navigation', { name: 'breadcrumb' }).textContent).toContain('Home')
    expect(screen.getByRole('navigation', { name: 'breadcrumb' }).textContent).toContain('Project notes')
    expect(screen.getByText('Formatting toolbar')).toBeTruthy()
    expect(screen.getByText('View controls')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy()
  })

  it('shows the title below the breadcrumb when enabled and updates it with props', () => {
    const { rerender } = render(<AppHeader title="Project brief" showTitle breadcrumbs={[{ label: 'Documents' }]} />)
    const breadcrumb = screen.getByRole('navigation', { name: 'breadcrumb' })
    expect(breadcrumb.nextElementSibling).toBe(screen.getByRole('heading', { name: 'Project brief', level: 1 }))
    rerender(<AppHeader title="Updated brief" showTitle breadcrumbs={[{ label: 'Documents' }]} />)
    expect(screen.getByRole('heading', { name: 'Updated brief' })).toBeInTheDocument()
    rerender(<AppHeader title="Updated brief" breadcrumbs={[{ label: 'Documents' }]} />)
    expect(screen.queryByRole('heading')).toBeNull()
  })

  it.each([
    ['saving', 'Saving…'],
    ['saved', 'Saved'],
  ] as const)('announces the %s state', (saveStatus, label) => {
    render(<AppHeader title="Draft" status={saveStatus} />)
    expect(screen.getByRole('status').textContent).toContain(label)
  })

  it('uses the current breadcrumb as the fallback title without a duplicate page heading', () => {
    render(<AppHeader breadcrumbs={[{ label: 'Welcome to Writin' }]} />)
    expect(screen.queryByRole('heading')).toBeNull()
    expect(screen.getAllByText('Welcome to Writin')).toHaveLength(2)
  })

  it('opens a rename popover from the current breadcrumb', () => {
    const onRename = vi.fn()
    render(<AppHeader title="Project notes" breadcrumbs={[{ label: 'Home' }, { label: 'Untitled' }]} onBreadcrumbRename={onRename} />)

    fireEvent.click(screen.getByRole('button', { name: 'Rename Untitled' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'File name' }), { target: { value: 'Project brief' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onRename).toHaveBeenCalledWith('Project brief')
  })

  it('shows collapsed breadcrumbs in the More dropdown', () => {
    const openDocuments = vi.fn()
    render(
      <AppHeader
        title="Draft"
        breadcrumbs={[
          { label: 'Home' },
          { label: 'Documents', onPress: openDocuments },
          { label: 'Projects' },
          { label: 'Drafts' },
          { label: 'Untitled' },
        ]}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'More breadcrumbs' }))
    expect(screen.getByRole('menuitem', { name: 'Drafts' })).toBeTruthy()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Documents' }))

    expect(openDocuments).toHaveBeenCalledOnce()
  })

  it('handles sidebar and back leading action callbacks', () => {
    const onSidebarToggle = vi.fn()
    const onBack = vi.fn()

    const { rerender } = render(
      <AppHeader leadingAction="sidebar" onSidebarToggle={onSidebarToggle} onBack={onBack} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
    expect(onSidebarToggle).toHaveBeenCalledOnce()
    expect(onBack).not.toHaveBeenCalled()

    rerender(<AppHeader leadingAction="back" onSidebarToggle={onSidebarToggle} onBack={onBack} />)
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('omits leading button when leadingAction is none', () => {
    render(<AppHeader leadingAction="none" />)
    expect(screen.queryByRole('button', { name: /Open navigation|Go back/ })).toBeNull()
  })

  it('disables leading button when handler is missing', () => {
    render(<AppHeader leadingAction="sidebar" />)
    expect(screen.getByRole('button', { name: 'Open navigation' })).toBeDisabled()
  })

  it('opens share and More interfaces and calls the favorite callback', () => {
    const onFavorite = vi.fn()
    const onMore = vi.fn()

    render(
      <AppHeader
        shareAction
        favoriteAction
        moreAction
        onFavorite={onFavorite}
        moreContent={<DropdownMenuItem onClick={onMore}>Save now</DropdownMenuItem>}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Share' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    fireEvent.click(screen.getByRole('button', { name: 'Add to favorites' }))
    expect(onFavorite).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Save now' }))
    expect(onMore).toHaveBeenCalledOnce()
  })

  it('renders lock action and calls onLockToggle', () => {
    const onLockToggle = vi.fn()
    const { rerender } = render(<AppHeader lockAction isLocked={false} onLockToggle={onLockToggle} />)
    const lockBtn = screen.getByRole('button', { name: 'Lock page' })
    expect(lockBtn).toBeInTheDocument()
    fireEvent.click(lockBtn)
    expect(onLockToggle).toHaveBeenCalledOnce()

    rerender(<AppHeader lockAction isLocked={true} onLockToggle={onLockToggle} />)
    expect(screen.getByRole('button', { name: 'Unlock page' })).toBeInTheDocument()
  })

  it('reflects favorite active state and accessibility attributes', () => {
    const { container, rerender } = render(
      <AppHeader favoriteAction isFavorite={true} />,
    )
    const favButton = screen.getByRole('button', { name: 'Remove from favorites' })
    expect(favButton).toHaveAttribute('aria-pressed', 'true')
    expect(container.querySelector('.text-amber-500')).toBeTruthy()

    rerender(<AppHeader favoriteAction isFavorite={false} />)
    const unfavButton = screen.getByRole('button', { name: 'Add to favorites' })
    expect(unfavButton).toHaveAttribute('aria-pressed', 'false')
    expect(container.querySelector('.text-amber-500')).toBeFalsy()
  })

  it('renders current breadcrumb as non-editable page when onRename is false', () => {
    render(
      <AppHeader onRename={false} breadcrumbs={[{ label: 'Home' }, { label: 'Fixed Page' }]} />,
    )

    expect(screen.queryByRole('button', { name: /Rename/ })).toBeNull()
    const currentItem = screen.getByRole('link', { name: 'Fixed Page' })
    expect(currentItem).toHaveAttribute('aria-current', 'page')
  })

  it('does not trigger onRename when submitted with empty or whitespace value', () => {
    const onRename = vi.fn()
    render(
      <AppHeader
        breadcrumbs={[{ label: 'Home' }, { label: 'Initial' }]}
        onBreadcrumbRename={onRename}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Rename Initial' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'File name' }), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onRename).not.toHaveBeenCalled()
  })

  it('renders center left actions with proper attributes and handles clicks', () => {
    const onBold = vi.fn()
    render(
      <AppHeader
        centerLeftActions={[
          {
            id: 'bold',
            label: 'Bold',
            icon: TextBoldIcon,
            isActive: true,
            onPress: onBold,
          },
          {
            id: 'italic',
            label: 'Italic',
            icon: TextItalicIcon,
            isDisabled: true,
          },
        ]}
      />,
    )

    const boldBtn = screen.getByRole('button', { name: 'Bold' })
    expect(boldBtn).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(boldBtn)
    expect(onBold).toHaveBeenCalledOnce()

    const italicBtn = screen.getByRole('button', { name: 'Italic' })
    expect(italicBtn).toBeDisabled()
  })

  it.each([375, 1280])('copies the current editor link from the share modal at %ipx', async (width) => {
    vi.stubGlobal('innerWidth', width)
    const nativeShare = vi.fn()
    Object.defineProperty(navigator, 'share', { configurable: true, value: nativeShare })
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    render(<AppHeader title="Draft" shareAction hideBreadcrumbsOnMobile addNewAction={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))
    expect(screen.getByRole('dialog', { name: 'Share Draft' })).toBeInTheDocument()
    expect(nativeShare).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    await waitFor(() => expect(screen.getByText('Link copied')).toBeInTheDocument())
    expect(writeText).toHaveBeenCalledWith(window.location.href)
  })

  it('reports clipboard failures without claiming success', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
    render(<AppHeader shareAction />)
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    expect(await screen.findByText(/Could not copy the link/)).toBeInTheDocument()
  })

  it('enables renaming by default and updates the displayed name without a callback', () => {
    const { rerender } = render(<AppHeader breadcrumbs={[{ label: 'Documents' }, { label: 'Draft' }]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Rename Draft' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'File name' }), { target: { value: '  New name  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('button', { name: 'Rename New name' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rename Documents' })).toBeNull()
    rerender(<AppHeader breadcrumbs={[{ label: 'Documents' }, { label: 'Other document' }]} />)
    expect(screen.getByRole('button', { name: 'Rename Other document' })).toBeInTheDocument()
  })

  it('disables More when no menu items are supplied', () => {
    render(<AppHeader moreAction />)
    expect(screen.getByRole('button', { name: 'More actions' })).toBeDisabled()
  })

  it('uses the editor title position instead of a fixed scroll threshold', () => {
    // Compact mode is mobile-only; simulate a narrow viewport.
    const originalInnerWidth = window.innerWidth
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true, writable: true })

    const titleRef = createRef<HTMLHeadingElement>()
    const { container, unmount } = render(
      <div data-app-header-scroll>
        <AppHeader title="Scrollable Document" titleRef={titleRef} status="saving" shareAction />
        <h1 ref={titleRef}>Editor title</h1>
      </div>,
    )
    const header = container.querySelector('header')!
    const scroller = container.querySelector('[data-app-header-scroll]')!
    vi.spyOn(header, 'getBoundingClientRect').mockReturnValue({ bottom: 64 } as DOMRect)
    const titleBounds = vi.spyOn(titleRef.current!, 'getBoundingClientRect')
    titleBounds.mockReturnValue({ top: 120 } as DOMRect)
    Object.defineProperty(scroller, 'scrollTop', { value: 200, writable: true })
    fireEvent.scroll(scroller)
    expect(header).toHaveAttribute('data-compact', 'false')

    titleBounds.mockReturnValue({ top: 64 } as DOMRect)
    fireEvent.scroll(scroller)
    expect(header).toHaveAttribute('data-compact', 'true')
    expect(screen.getByRole('status').nextElementSibling).toBe(screen.getByRole('group', { name: 'Trailing actions' }))
    expect(screen.getByRole('group', { name: 'Trailing actions' })).toContain(screen.getByRole('button', { name: 'Share' }))

    titleBounds.mockReturnValue({ top: 65 } as DOMRect)
    fireEvent.resize(window)
    expect(header).toHaveAttribute('data-compact', 'false')
    unmount()
    titleBounds.mockClear()
    fireEvent.scroll(window)
    expect(titleBounds).not.toHaveBeenCalled()

    Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, configurable: true, writable: true })
  })

  it('does not reveal a scroll title without an editor title target', () => {
    const { container } = render(<AppHeader title="Draft" />)
    fireEvent.scroll(window)
    expect(container.querySelector('header')).toHaveAttribute('data-compact', 'false')
  })

  it('does not enter compact mode on desktop viewports regardless of scroll', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true, writable: true })
    const titleRef = createRef<HTMLHeadingElement>()
    const { container } = render(
      <div data-app-header-scroll>
        <AppHeader title="Desktop Doc" titleRef={titleRef} />
        <h1 ref={titleRef}>Desktop title</h1>
      </div>,
    )
    const header = container.querySelector('header')!
    vi.spyOn(header, 'getBoundingClientRect').mockReturnValue({ bottom: 64 } as DOMRect)
    vi.spyOn(titleRef.current!, 'getBoundingClientRect').mockReturnValue({ top: 64 } as DOMRect)
    fireEvent.scroll(window)
    expect(header).toHaveAttribute('data-compact', 'false')
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true, writable: true })
  })

  it('provides mobile back navigation separately from the desktop sidebar', () => {
    const onBack = vi.fn()
    const onSidebarToggle = vi.fn()
    render(<AppHeader onBack={onBack} onSidebarToggle={onSidebarToggle} />)
    const back = screen.getByRole('button', { name: 'Go back' })
    expect(back).toHaveClass('md:hidden')
    expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveClass('hidden', 'md:inline-flex')
    fireEvent.click(back)
    expect(onBack).toHaveBeenCalledOnce()
    expect(onSidebarToggle).not.toHaveBeenCalled()
  })

  it('keeps status accessible while hiding its label on mobile and animates only saving', () => {
    const { rerender } = render(<AppHeader status="saving" />)
    expect(screen.getByRole('status')).toHaveAccessibleName('Saving…')
    expect(screen.getByText('Saving…')).toHaveClass('hidden', 'md:inline')
    expect(screen.getByRole('status').querySelector('svg')).toHaveClass('animate-spin')
    rerender(<AppHeader status="saved" />)
    expect(screen.getByRole('status')).toHaveAccessibleName('Saved')
    expect(screen.getByRole('status').querySelector('svg')).not.toHaveClass('animate-spin')
  })
})
