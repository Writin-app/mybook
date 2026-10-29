import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'

import { FileBlockNodeView } from '../FileBlockNodeView'
import { formatFileSize } from '../fileIcons'

export const FileAttachment = Node.create({
  name: 'fileAttachment',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  isolating: true,

  addAttributes() {
    return {
      name: {
        default: 'Attachment',
        parseHTML: (element) => element.getAttribute('data-name') ?? 'Attachment',
        renderHTML: (attributes) => ({ 'data-name': attributes.name ?? 'Attachment' }),
      },
      mimeType: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-mime-type') ?? '',
        renderHTML: (attributes) => ({ 'data-mime-type': attributes.mimeType ?? '' }),
      },
      size: {
        default: 0,
        parseHTML: (element) => Number(element.getAttribute('data-size') ?? 0),
        renderHTML: (attributes) => ({ 'data-size': attributes.size ?? 0 }),
      },
      src: {
        default: '',
        parseHTML: (element) =>
          element.getAttribute('data-src') ??
          element.querySelector('a')?.getAttribute('href') ??
          '',
        renderHTML: (attributes) => ({ 'data-src': attributes.src ?? '' }),
      },
      pdfPreview: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-pdf-preview') === 'true',
        renderHTML: (attributes) => attributes.pdfPreview ? { 'data-pdf-preview': 'true' } : {},
      },
      href: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute('data-href') ??
          element.querySelector('a[data-file-link]')?.getAttribute('href') ??
          null,
        renderHTML: (attributes) => attributes.href ? { 'data-href': attributes.href } : {},
      },
    }
  },

  parseHTML() {
    return [{ tag: 'section[data-type="file-attachment"]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const name = String(node.attrs.name ?? 'Attachment')
    const src = String(node.attrs.src ?? '')
    const mimeType = String(node.attrs.mimeType ?? '')
    const size = Number(node.attrs.size ?? 0)
    return [
      'section',
      mergeAttributes(
        {
          'data-type': 'file-attachment',
          class: 'mybook-file-attachment',
        },
        HTMLAttributes
      ),
      ['a', { href: src, download: name, class: 'mybook-file-attachment-link' }, name],
      [
        'span',
        { class: 'mybook-file-attachment-meta' },
        [mimeType, formatAttachmentSize(size)].filter(Boolean).join(' · '),
      ],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(FileBlockNodeView)
  },
})

export function fileAttachmentNode(
  src: string,
  name: string,
  mimeType = '',
  size = 0,
  href?: string | null,
  pdfPreview = false
) {
  return {
    type: 'fileAttachment',
    attrs: {
      src,
      name,
      mimeType,
      size,
      href: href || null,
      pdfPreview: Boolean(pdfPreview),
    },
  }
}

export function formatAttachmentSize(size: number) {
  return formatFileSize(size)
}
