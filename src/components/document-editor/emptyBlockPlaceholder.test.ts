// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { EmptyBlockPlaceholder, emptyBlockPlaceholderKey } from './emptyBlockPlaceholder'

describe('EmptyBlockPlaceholder plugin', () => {
  it('preserves heading placeholder and only sets picker placeholder on the active paragraph', () => {
    const editor = new Editor({
      extensions: [StarterKit, EmptyBlockPlaceholder],
      content: '<p></p><h1></h1><p></p><h2></h2>',
    })

    // doc structure:
    // pos 0: start of doc
    // pos 0..2: paragraph 1 (empty)
    // pos 2..4: heading 1 (empty)
    // pos 4..6: paragraph 2 (empty)
    // pos 6..8: heading 2 (empty)

    // Place selection in paragraph 2 (pos 5)
    editor.commands.setTextSelection(5)

    // Mark editor as focused
    editor.view.dispatch(editor.state.tr.setMeta(emptyBlockPlaceholderKey, { focused: true }))

    const plugin = emptyBlockPlaceholderKey.get(editor.state)
    expect(plugin).toBeDefined()

    const getDecoList = () => {
      const decos = plugin ? plugin.props.decorations?.call(plugin, editor.state) : null
      return (decos as unknown as { find: () => Array<{ type: { attrs: Record<string, string> }; from: number; to: number }> } | null)?.find() ?? []
    }

    // Check initial decorations
    let decoList = getDecoList()

    // Heading 1 should have data-placeholder: "Heading 1"
    const h1Initial = decoList.find((d) => d.from === 2 && d.to === 4)
    expect(h1Initial?.type.attrs['data-placeholder']).toBe('Heading 1')
    expect(h1Initial?.type.attrs['class']).toContain('mybook-heading-placeholder')
    expect(h1Initial?.type.attrs['class']).not.toContain('mybook-picker-placeholder')

    // Heading 2 should have data-placeholder: "Heading 2"
    const h2Initial = decoList.find((d) => d.from === 6 && d.to === 8)
    expect(h2Initial?.type.attrs['data-placeholder']).toBe('Heading 2')
    expect(h2Initial?.type.attrs['class']).toContain('mybook-heading-placeholder')
    expect(h2Initial?.type.attrs['class']).not.toContain('mybook-picker-placeholder')

    // Paragraph 1 (unfocused) should NOT have mybook-picker-placeholder
    const p1Initial = decoList.find((d) => d.from === 0 && d.to === 2)
    expect(p1Initial?.type.attrs?.class ?? '').not.toContain('mybook-picker-placeholder')

    // Open an image picker
    editor.view.dispatch(editor.state.tr.setMeta(emptyBlockPlaceholderKey, { pickerActive: true, pickerType: 'image' }))

    decoList = getDecoList()

    // Headings must retain their original placeholders and NOT be overwritten by "Add an image"
    const h1After = decoList.find((d) => d.from === 2 && d.to === 4)
    expect(h1After?.type.attrs['data-placeholder']).toBe('Heading 1')
    expect(h1After?.type.attrs['class']).not.toContain('mybook-picker-placeholder')

    const h2After = decoList.find((d) => d.from === 6 && d.to === 8)
    expect(h2After?.type.attrs['data-placeholder']).toBe('Heading 2')
    expect(h2After?.type.attrs['class']).not.toContain('mybook-picker-placeholder')

    // Unfocused paragraph 1 must NOT have "Add an image"
    const p1After = decoList.find((d) => d.from === 0 && d.to === 2)
    expect(p1After?.type.attrs?.class ?? '').not.toContain('mybook-picker-placeholder')

    // Active paragraph 2 MUST have "Add an image"
    const p2After = decoList.find((d) => d.from === 4 && d.to === 6)
    expect(p2After?.type.attrs['class']).toContain('mybook-picker-placeholder')
    expect(p2After?.type.attrs['data-placeholder']).toBe('Add an image')

    // Switch to file picker
    editor.view.dispatch(editor.state.tr.setMeta(emptyBlockPlaceholderKey, { pickerActive: true, pickerType: 'file' }))

    decoList = getDecoList()

    const p2File = decoList.find((d) => d.from === 4 && d.to === 6)
    expect(p2File?.type.attrs['class']).toContain('mybook-picker-placeholder')
    expect(p2File?.type.attrs['data-placeholder']).toBe('Add a file')

    // Headings STILL remain Heading 1 and Heading 2
    expect(decoList.find((d) => d.from === 2 && d.to === 4)?.type.attrs['data-placeholder']).toBe('Heading 1')
    expect(decoList.find((d) => d.from === 6 && d.to === 8)?.type.attrs['data-placeholder']).toBe('Heading 2')

    // Close picker
    editor.view.dispatch(editor.state.tr.setMeta(emptyBlockPlaceholderKey, { pickerActive: false, pickerType: null }))

    decoList = getDecoList()
    const p2Closed = decoList.find((d) => d.from === 4 && d.to === 6)
    expect(p2Closed?.type.attrs?.class).not.toContain('mybook-picker-placeholder')
    expect(p2Closed?.type.attrs?.['data-placeholder']).toBeUndefined()

    editor.destroy()
  })
})
