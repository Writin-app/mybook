// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NodeViewProps } from '@tiptap/react'

import { ImageBlockNodeView } from './ImageBlockNodeView'

describe('ImageBlockNodeView', () => {
  let mockEditor: unknown
  let mockNode: {
    attrs: {
      src: string
      alt: string
      width: string
      align: string
      caption: string
      showCaption: boolean
      href?: string
    }
    nodeSize: number
    toJSON: () => unknown
  }
  let updateAttributes: (attributes: Record<string, unknown>) => void
  let deleteNode: () => void
  let getPos: () => number | undefined

  beforeEach(() => {
    updateAttributes = vi.fn() as unknown as (attributes: Record<string, unknown>) => void
    deleteNode = vi.fn() as unknown as () => void
    getPos = vi.fn(() => 10) as unknown as () => number | undefined

    mockEditor = {
      view: { focus: vi.fn() },
      chain: vi.fn(() => ({
        focus: vi.fn(() => ({
          insertContentAt: vi.fn(() => ({
            run: vi.fn(),
          })),
        })),
      })),
    }

    mockNode = {
      attrs: {
        src: 'https://example.com/test-image.png',
        alt: 'Test Diagram',
        width: '100%',
        align: 'center',
        caption: '',
        showCaption: true,
      },
      nodeSize: 1,
      toJSON: () => ({
        type: 'imageBlock',
        attrs: mockNode.attrs,
      }),
    }

    // Mock clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
        write: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  function createProps(customNode = mockNode, selected = false): NodeViewProps {
    return {
      editor: mockEditor,
      node: customNode,
      updateAttributes,
      deleteNode,
      getPos,
      selected,
      decorations: [],
      extension: {} as unknown,
      HTMLAttributes: {},
      view: (mockEditor as { view: unknown }).view,
      innerDecorations: [] as unknown,
    } as unknown as NodeViewProps
  }

  it('renders image, resize handles, and primary toolbar actions (Replace, Fullscreen, Copy, Align, More)', () => {
    render(<ImageBlockNodeView {...createProps()} />)

    const img = screen.getByRole('img', { name: /test diagram/i })
    expect(img).toHaveAttribute('src', 'https://example.com/test-image.png')

    // 4 corners and 2 side resize handles
    expect(screen.getByRole('slider', { name: /resize top left/i })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: /resize top right/i })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: /resize bottom right/i })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: /resize bottom left/i })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: /resize left/i })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: /resize right/i })).toBeInTheDocument()

    // Primary Action toolbar buttons
    expect(screen.getByRole('button', { name: /replace image/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /full screen/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /copy block/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /align image/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /more image options/i })).toBeInTheDocument()
  })

  it('handles image alignment selection (Left, Center, Right)', () => {
    render(<ImageBlockNodeView {...createProps()} />)

    const alignBtn = screen.getByRole('button', { name: /align image/i })
    fireEvent.click(alignBtn)

    const leftOption = screen.getByText('Left')
    fireEvent.click(leftOption)
    expect(updateAttributes).toHaveBeenCalledWith({ align: 'left' })
  })

  it('handles More dropdown actions: Duplicate and Delete', () => {
    render(<ImageBlockNodeView {...createProps()} />)

    const moreBtn = screen.getByRole('button', { name: /more image options/i })
    fireEvent.click(moreBtn)

    // Duplicate action
    const duplicateOption = screen.getByText('Duplicate')
    fireEvent.click(duplicateOption)
    expect((mockEditor as { chain: unknown }).chain).toHaveBeenCalled()

    // Reopen More and click Delete
    fireEvent.click(moreBtn)
    const deleteOption = screen.getByText('Delete')
    fireEvent.click(deleteOption)
    expect(deleteNode).toHaveBeenCalledTimes(1)
  })

  it('handles opening fullscreen overlay', () => {
    render(<ImageBlockNodeView {...createProps()} />)

    const fullscreenBtn = screen.getByRole('button', { name: /full screen/i })
    fireEvent.click(fullscreenBtn)
    expect(screen.getByRole('dialog', { name: /image full screen preview/i })).toBeInTheDocument()
  })

  it('handles opening replace popover from top-right toolbar anchor', () => {
    render(<ImageBlockNodeView {...createProps()} />)

    const replaceBtn = screen.getByRole('button', { name: /replace image/i })
    fireEvent.click(replaceBtn)
    expect(screen.getByRole('tab', { name: /upload/i })).toBeInTheDocument()
  })

  it('handles caption workflow: adding, left-aligned input, showing/hiding, and removing', () => {
    const { rerender } = render(<ImageBlockNodeView {...createProps()} />)

    // Open More and click Add caption
    const moreBtn = screen.getByRole('button', { name: /more image options/i })
    fireEvent.click(moreBtn)

    const addCaptionOption = screen.getByText('Add caption')
    fireEvent.click(addCaptionOption)
    expect(updateAttributes).toHaveBeenCalledWith({ showCaption: true })

    // Now render with a caption attribute
    const nodeWithCaption = {
      ...mockNode,
      attrs: {
        ...mockNode.attrs,
        caption: 'Figure 1: Architectural diagram',
        showCaption: true,
      },
    }

    rerender(<ImageBlockNodeView {...createProps(nodeWithCaption)} />)

    const captionInput = screen.getByPlaceholderText('Write a caption')
    expect(captionInput).toHaveValue('Figure 1: Architectural diagram')
    expect(captionInput).toHaveClass('text-left')

    // Open More and check Remove caption with visibility toggle
    fireEvent.click(moreBtn)
    expect(screen.getByText('Remove caption')).toBeInTheDocument()

    const hideCaptionBtn = screen.getByRole('button', { name: /hide caption/i })
    fireEvent.click(hideCaptionBtn)
    expect(updateAttributes).toHaveBeenCalledWith({ showCaption: false })

    const removeCaptionOption = screen.getByText('Remove caption')
    fireEvent.click(removeCaptionOption)
    expect(updateAttributes).toHaveBeenCalledWith({ caption: '', showCaption: false })
  })

  it('keeps toolbar active and visible when opening Align or More dropdown menus', () => {
    const { container } = render(<ImageBlockNodeView {...createProps()} />)
    const toolbar = screen.getByTestId('image-toolbar')
    const figure = container.querySelector('figure')

    expect(toolbar).not.toHaveClass('is-open')
    expect(figure).toHaveAttribute('data-menu-open', 'false')

    // Open More dropdown
    const moreBtn = screen.getByRole('button', { name: /more image options/i })
    fireEvent.click(moreBtn)

    expect(toolbar).toHaveClass('is-open')
    expect(toolbar).toHaveAttribute('data-state', 'open')
    expect(figure).toHaveAttribute('data-menu-open', 'true')

    // Close More menu
    const duplicateOption = screen.getByText('Duplicate')
    fireEvent.click(duplicateOption)

    expect(toolbar).not.toHaveClass('is-open')
    expect(figure).toHaveAttribute('data-menu-open', 'false')
  })

  it('handles Add link / Edit link popover and image click navigation', () => {
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const { rerender } = render(<ImageBlockNodeView {...createProps()} />)

    // Open More and click Add link
    const moreBtn = screen.getByRole('button', { name: /more image options/i })
    fireEvent.click(moreBtn)

    const addLinkOption = screen.getByText('Add link')
    fireEvent.click(addLinkOption)

    // Link popover opens
    expect(screen.getByRole('dialog', { name: 'Add link' })).toBeInTheDocument()

    // Render with linked image
    const linkedNode = {
      ...mockNode,
      attrs: {
        ...mockNode.attrs,
        href: 'https://google.com',
      },
    }

    rerender(<ImageBlockNodeView {...createProps(linkedNode)} />)

    const img = screen.getByRole('img', { name: /test diagram/i })
    expect(img).toHaveClass('cursor-pointer')

    // Clicking image navigates to URL
    fireEvent.click(img)
    // Open More and verify Open and Edit link are shown
    fireEvent.click(moreBtn)
    expect(screen.getAllByText('Edit link').length).toBeGreaterThan(0)
    const openOption = screen.getByText('Open')
    expect(openOption).toBeInTheDocument()

    // Clicking Open navigates to URL
    fireEvent.click(openOption)
    expect(windowOpenSpy).toHaveBeenCalledWith('https://google.com', '_blank', 'noopener,noreferrer')

    // Render with internal doc link
    const internalDocNode = {
      ...mockNode,
      attrs: {
        ...mockNode.attrs,
        href: 'doc:doc-123',
      },
    }
    rerender(<ImageBlockNodeView {...createProps(internalDocNode)} />)

    // Open More and verify Open option is NOT present for internal document link, but Edit link and Copy link are
    fireEvent.click(moreBtn)
    expect(screen.queryByText('Open')).not.toBeInTheDocument()
    expect(screen.getAllByText('Edit link').length).toBeGreaterThan(0)
    expect(screen.getByText('Copy link')).toBeInTheDocument()

    // Close More menu
    fireEvent.click(moreBtn)

    // Render unlinked image
    rerender(<ImageBlockNodeView {...createProps()} />)
    fireEvent.click(moreBtn)
    expect(screen.queryByText('Copy link')).not.toBeInTheDocument()
    expect(screen.getAllByText('Add link').length).toBeGreaterThan(0)

    // Close More menu
    fireEvent.click(moreBtn)

    // When linked, Copy link is visible and writes to clipboard
    const writeTextSpy = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextSpy,
      },
    })

    rerender(<ImageBlockNodeView {...createProps(linkedNode)} />)
    fireEvent.click(moreBtn)
    const copyLinkOption = screen.getByText('Copy link')
    expect(copyLinkOption).toBeInTheDocument()

    fireEvent.click(copyLinkOption)
    expect(writeTextSpy).toHaveBeenCalledWith('https://google.com')

    windowOpenSpy.mockRestore()
  })
  it('removes only the attached link from the image menu', () => {
    mockNode.attrs.href = 'https://example.com'
    render(<ImageBlockNodeView {...createProps()} />)
    fireEvent.click(screen.getByRole('button', { name: /more image options/i }))
    const items = screen.getAllByRole('menuitem').map((item) => item.textContent)
    expect(items.indexOf('Remove link')).toBe(items.indexOf('Edit link') + 1)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove link' }))
    expect(updateAttributes).toHaveBeenCalledWith({ href: null })
    expect(deleteNode).not.toHaveBeenCalled()
  })

  it('hides Remove link when the image has no attached link', () => {
    render(<ImageBlockNodeView {...createProps()} />)
    fireEvent.click(screen.getByRole('button', { name: /more image options/i }))
    expect(screen.queryByRole('menuitem', { name: 'Remove link' })).not.toBeInTheDocument()
  })

  it('renders an error fallback with Retry and Replace buttons when the image fails to load', () => {
    render(<ImageBlockNodeView {...createProps()} />)
    const img = screen.getByRole('img', { name: /test diagram/i, hidden: true })
    expect(img).toHaveAttribute('referrerpolicy', 'no-referrer')

    fireEvent.error(img)

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Unable to load image')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^replace$/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
  })

  it('immediately surfaces error fallback with friendly text for unsupported data uri formats', () => {
    const emfNode = {
      ...mockNode,
      attrs: {
        ...mockNode.attrs,
        src: 'data:image/x-emf;base64,AQID',
      },
    }
    render(<ImageBlockNodeView {...createProps(emfNode)} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Unable to load image')).toBeInTheDocument()
    expect(screen.getByText('Embedded image could not be loaded')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^replace$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument()
  })

  it('renders a friendly placeholder with Replace button and no Retry button when src is empty', () => {
    const emptySrcNode = {
      ...mockNode,
      attrs: {
        ...mockNode.attrs,
        src: '',
        alt: 'Missing graphic',
      },
    }
    render(<ImageBlockNodeView {...createProps(emptySrcNode)} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Missing graphic')).toBeInTheDocument()
    expect(screen.getByText('Click Replace to select or upload an image')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^replace$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument()
  })

  it('renders a local file notice with Replace button and no Retry button for relative file paths', () => {
    const relativeNode = {
      ...mockNode,
      attrs: {
        ...mockNode.attrs,
        src: './attachments/photo.png',
      },
    }
    render(<ImageBlockNodeView {...createProps(relativeNode)} />)
    const img = screen.getByRole('img', { name: /test diagram/i, hidden: true })
    fireEvent.error(img)

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Unable to load image')).toBeInTheDocument()
    expect(screen.getByText('./attachments/photo.png (not accessible from browser — click Replace to upload)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^replace$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument()
  })

  it('displays loading placeholder and eager loading attribute until onLoad fires', () => {
    render(<ImageBlockNodeView {...createProps()} />)
    const img = screen.getByRole('img', { name: /test diagram/i, hidden: true })
    expect(img).toHaveAttribute('loading', 'eager')
    expect(screen.getByText('Loading image…')).toBeInTheDocument()

    // Trigger image loaded
    fireEvent.load(img)

    expect(screen.queryByText('Loading image…')).not.toBeInTheDocument()
    expect(img).toHaveAttribute('loading', 'lazy')
    expect(img).toHaveClass('block')
  })
})
