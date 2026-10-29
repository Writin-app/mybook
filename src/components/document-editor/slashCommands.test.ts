// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import type { JSONContent } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import { Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

import { DateTimeBlock } from './extensions/DateTimeBlock'
import { Columns, Column } from './extensions/Columns'
import { ToggleBlock } from './extensions/ToggleBlock'
import { commandMenuTop, filterMentionCommands, filterSlashCommands, getMentionMenuState, groupSlashCommands, isInsideColumns, runSlashCommand, slashCommands } from './slashCommands'

describe('slashCommands', () => {
  it('keeps Date & Time in the Mention block category and exposes it for @ suggestions', () => {
    expect(slashCommands.find((command) => command.id === 'date-time')?.category).toBe('Mention')
    expect(filterMentionCommands('').map((command) => command.title)).toEqual(['Date & Time'])
    expect(filterMentionCommands('time').map((command) => command.id)).toEqual(['date-time'])
    const editor = new Editor({ content: '<p>@date</p>', extensions: [StarterKit, DateTimeBlock] })
    editor.commands.setTextSelection(6)
    vi.spyOn(editor.view, 'coordsAtPos').mockReturnValue({ left: 10, right: 10, top: 20, bottom: 40 } as DOMRect)
    expect(getMentionMenuState(editor)?.query).toBe('date')
    editor.destroy()
  })
  it('includes Video command under Media category', () => {
    const videoCmd = slashCommands.find((c) => c.id === 'video')
    expect(videoCmd).toBeDefined()
    expect(videoCmd?.category).toBe('Media')
    expect(videoCmd?.title).toBe('Video')

    const groups = groupSlashCommands(slashCommands)
    const mediaGroup = groups.find((g) => g.category === 'Media')
    expect(mediaGroup?.commands.some((c) => c.id === 'video')).toBe(true)
    expect(mediaGroup?.commands.some((c) => c.id === 'audio')).toBe(true)
  })

  it('includes Audio command under Media category', () => {
    const audioCmd = slashCommands.find((c) => c.id === 'audio')
    expect(audioCmd).toBeDefined()
    expect(audioCmd?.category).toBe('Media')
    expect(audioCmd?.title).toBe('Audio')
  })

  it('inserts a current date-time inline and allows typing after it', () => {
    const element = document.body.appendChild(document.createElement('div'))
    const editor = new Editor({
      element,
      extensions: [StarterKit, DateTimeBlock],
      content: '<p>Meet </p>',
    })
    editor.commands.setTextSelection(6)

    runSlashCommand(editor, 'date-time', { from: 6, to: 6 })

    const paragraph = editor.getJSON().content?.[0] as JSONContent | undefined
    const dateTime = paragraph?.content?.find((node) => node.type === 'dateTimeBlock')
    expect(paragraph?.type).toBe('paragraph')
    expect(dateTime?.attrs?.value).toEqual(expect.any(String))
    expect(dateTime?.attrs?.includeTime).toBe(true)
    expect(editor.state.selection.$from.parent.type.name).toBe('paragraph')
    expect(editor.state.selection.$from.parentOffset).toBe(editor.state.selection.$from.parent.content.size)
    editor.commands.insertContent('tomorrow')
    const finalParagraph = editor.getJSON().content?.[0] as JSONContent | undefined
    expect(finalParagraph?.type).toBe('paragraph')
    expect(finalParagraph?.content?.some((node) => node.type === 'dateTimeBlock')).toBe(true)
    expect(finalParagraph?.content?.at(-1)?.text).toBe('tomorrow')
    const cursorAfterTyping = editor.state.selection.from
    editor.commands.deleteRange({ from: cursorAfterTyping - 'tomorrow'.length, to: cursorAfterTyping })
    expect(editor.state.selection.$from.parent.type.name).toBe('paragraph')
    expect(editor.state.selection.$from.parentOffset).toBe(editor.state.selection.$from.parent.content.size)
    expect((editor.getJSON().content?.[0] as JSONContent).content?.at(-1)?.type).toBe('dateTimeBlock')

    editor.destroy()
    element.remove()
  })

  it('keeps block-picker Date & Time insertion at the end of the selected line', () => {
    const element = document.body.appendChild(document.createElement('div'))
    const editor = new Editor({ element, extensions: [StarterKit, DateTimeBlock], content: '<p></p><p>Next</p>' })
    const insertPos = 1 // End of the selected empty paragraph.
    editor.view.focus()
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, insertPos)))

    runSlashCommand(editor, 'date-time', { from: insertPos, to: insertPos })
    expect(editor.state.selection.$from.parent.type.name).toBe('paragraph')
    expect(editor.state.selection.$from.parentOffset).toBe(editor.state.selection.$from.parent.content.size)
    editor.commands.insertContent('continue')

    const paragraphs = editor.getJSON().content as JSONContent[] | undefined
    expect(paragraphs?.[0]?.type).toBe('paragraph')
    expect(paragraphs?.[0]?.content?.map((node) => node.type)).toEqual(['dateTimeBlock', 'text'])
    expect(paragraphs?.[0]?.content?.at(-1)?.text).toBe('continue')
    expect(paragraphs?.[1]?.content?.[0]?.text).toBe('Next')

    editor.destroy()
    element.remove()
  })

  it('filters video command on query "video" or "youtube"', () => {
    const results = filterSlashCommands('video')
    expect(results.some((c) => c.id === 'video')).toBe(true)

    const youtubeResults = filterSlashCommands('youtube')
    expect(youtubeResults.some((c) => c.id === 'video')).toBe(true)
  })

  it('filters audio command on query "audio", "music", or "sound"', () => {
    const results = filterSlashCommands('audio')
    expect(results.some((c) => c.id === 'audio')).toBe(true)

    const musicResults = filterSlashCommands('music')
    expect(musicResults.some((c) => c.id === 'audio')).toBe(true)
  })

  it('prioritizes matching command titles over incidental description matches', () => {
    expect(filterSlashCommands('fil').map((command) => command.id)).toEqual(['file'])
    expect(filterSlashCommands('file').map((command) => command.id)).toEqual(['file'])
  })

  it('keeps media keyword search broad across media commands', () => {
    expect(filterSlashCommands('media').map((command) => command.id)).toEqual([
      'image',
      'video',
      'audio',
      'file',
    ])
  })

  it('dispatches mybook:insert-video event on runSlashCommand with video', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    const mockEditor = {
      chain: vi.fn(() => ({
        focus: vi.fn(() => ({
          deleteRange: vi.fn(() => ({
            run: vi.fn(),
          })),
        })),
      })),
    } as unknown as Editor

    runSlashCommand(mockEditor, 'video', { from: 0, to: 5 })

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'mybook:insert-video' })
    )
  })

  it('dispatches mybook:insert-audio event on runSlashCommand with audio', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    const mockEditor = {
      chain: vi.fn(() => ({
        focus: vi.fn(() => ({
          deleteRange: vi.fn(() => ({
            run: vi.fn(),
          })),
        })),
      })),
    } as unknown as Editor

    runSlashCommand(mockEditor, 'audio', { from: 0, to: 5 })

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'mybook:insert-audio' })
    )
  })

  it('executes code-block slash command, sets code block, and moves selection inside', () => {
    const element = document.body.appendChild(document.createElement('div'))
    const editor = new Editor({
      element,
      extensions: [StarterKit],
      content: '<p>/code</p>',
    })
    editor.commands.setTextSelection(6)

    runSlashCommand(editor, 'code-block', { from: 1, to: 6 })

    expect(editor.isActive('codeBlock')).toBe(true)
    expect(editor.state.selection.from).toBe(1)
    editor.destroy()
    element.remove()
  })

  it('adds inline code to insertion commands and toggles the inline code mark', () => {
    const element = document.body.appendChild(document.createElement('div'))
    const editor = new Editor({ element, extensions: [StarterKit], content: '<p>hello world</p>' })
    editor.commands.setTextSelection({ from: 7, to: 12 })

    const inlineCode = slashCommands.find((command) => command.id === 'inline-code')
    expect(inlineCode).toMatchObject({ title: 'Inline code', shortcut: '`code`' })
    runSlashCommand(editor, 'inline-code', { from: 7, to: 12 })

    expect(editor.state.doc.rangeHasMark(7, 12, editor.schema.marks.code!)).toBe(true)
    editor.destroy()
    element.remove()
  })

  it('removes the slash query and turns on inline code for typing', () => {
    const element = document.body.appendChild(document.createElement('div'))
    const editor = new Editor({ element, extensions: [StarterKit], content: '<p>/inline-code</p>' })
    editor.commands.setTextSelection(13)

    runSlashCommand(editor, 'inline-code', { from: 1, to: 13 })

    expect(editor.state.doc.textContent).toBe('')
    expect(editor.isActive('code')).toBe(true)
    editor.destroy()
    element.remove()
  })

  it('includes 5 Toggle insertion options under Lists category', () => {
    const toggleOptions = ['toggle', 'toggle-h1', 'toggle-h2', 'toggle-h3', 'toggle-h4']
    for (const id of toggleOptions) {
      const cmd = slashCommands.find((c) => c.id === id)
      expect(cmd).toBeDefined()
      expect(cmd?.category).toBe('Lists')
    }

    expect(slashCommands.find((c) => c.id === 'toggle')?.title).toBe('Toggle')
    expect(slashCommands.find((c) => c.id === 'toggle-h1')?.title).toBe('Toggle H1')
    expect(slashCommands.find((c) => c.id === 'toggle-h2')?.title).toBe('Toggle H2')
    expect(slashCommands.find((c) => c.id === 'toggle-h3')?.title).toBe('Toggle H3')
    expect(slashCommands.find((c) => c.id === 'toggle-h4')?.title).toBe('Toggle H4')
  })

  it('converts existing paragraph into a toggle heading with text preserved via slash command', () => {
    const element = document.body.appendChild(document.createElement('div'))
    const editor = new Editor({ element, extensions: [StarterKit, ToggleBlock], content: '<p>Project Roadmap /toggle-h1</p>' })
    editor.commands.setTextSelection(27)

    runSlashCommand(editor, 'toggle-h1', { from: 17, to: 27 })

    const toggle = editor.state.doc.firstChild
    expect(toggle?.type.name).toBe('toggleBlock')
    expect(toggle?.attrs.title).toBe('Project Roadmap')
    expect(toggle?.attrs.level).toBe(1)

    editor.destroy()
    element.remove()
  })

  it('inserts quote block with caret positioned inside the paragraph and supports continuous typing', () => {
    const element = document.body.appendChild(document.createElement('div'))
    const editor = new Editor({ element, extensions: [StarterKit], content: '<p>/quote</p>' })
    editor.commands.setTextSelection(7)

    runSlashCommand(editor, 'quote', { from: 1, to: 7 })

    expect(editor.getHTML()).toContain('<blockquote><p></p></blockquote>')
    expect(editor.state.selection.$from.parent.type.name).toBe('paragraph')
    expect(editor.state.selection.$from.parentOffset).toBe(0)

    // Type text into the blockquote
    editor.commands.insertContent('Inspiring quote')
    expect(editor.getHTML()).toContain('<blockquote><p>Inspiring quote</p></blockquote>')
    expect(editor.state.doc.child(0).childCount).toBe(1)

    editor.destroy()
    element.remove()
  })

  it('filters toggle options on query "toggle"', () => {
    const results = filterSlashCommands('toggle')
    expect(results.some((c) => c.id === 'toggle')).toBe(true)
    expect(results.some((c) => c.id === 'toggle-h1')).toBe(true)
    expect(results.some((c) => c.id === 'toggle-h2')).toBe(true)
    expect(results.some((c) => c.id === 'toggle-h3')).toBe(true)
    expect(results.some((c) => c.id === 'toggle-h4')).toBe(true)
  })

  it('includes Columns 2, 3, 4, and 5 under Advanced category', () => {
    const colIds = ['columns-2', 'columns-3', 'columns-4', 'columns-5']
    for (const id of colIds) {
      const cmd = slashCommands.find((c) => c.id === id)
      expect(cmd).toBeDefined()
      expect(cmd?.category).toBe('Advanced')
    }

    expect(slashCommands.find((c) => c.id === 'columns-2')?.title).toBe('Columns 2')
    expect(slashCommands.find((c) => c.id === 'columns-3')?.title).toBe('Columns 3')
    expect(slashCommands.find((c) => c.id === 'columns-4')?.title).toBe('Columns 4')
    expect(slashCommands.find((c) => c.id === 'columns-5')?.title).toBe('Columns 5')
  })

  it('filters column options on query "columns" or "column"', () => {
    const results = filterSlashCommands('column')
    expect(results.some((c) => c.id === 'columns-2')).toBe(true)
    expect(results.some((c) => c.id === 'columns-3')).toBe(true)
    expect(results.some((c) => c.id === 'columns-4')).toBe(true)
    expect(results.some((c) => c.id === 'columns-5')).toBe(true)
  })

  it('inserts columns using runSlashCommand', () => {
    const element = document.body.appendChild(document.createElement('div'))
    const editor = new Editor({
      element,
      extensions: [StarterKit, Columns, Column],
      content: '<p></p>',
    })

    runSlashCommand(editor, 'columns-2', { from: 1, to: 1 })

    const columnsNode = editor.state.doc.firstChild
    expect(columnsNode?.type.name).toBe('columns')
    expect(columnsNode?.attrs.count).toBe(2)
    expect(columnsNode?.childCount).toBe(2)
    expect(columnsNode?.child(0).type.name).toBe('column')
    expect(columnsNode?.child(1).type.name).toBe('column')

    editor.destroy()
    element.remove()
  })

  it('detects isInsideColumns and filters/prevents nested columns', () => {
    const element = document.body.appendChild(document.createElement('div'))
    const editor = new Editor({
      element,
      extensions: [StarterKit, Columns, Column],
      content: '<p></p>',
    })

    // Outside columns
    expect(isInsideColumns(editor)).toBe(false)
    expect(filterSlashCommands('columns', editor).some((c) => c.id === 'columns-2')).toBe(true)

    // Insert columns
    runSlashCommand(editor, 'columns-2', { from: 1, to: 1 })

    // Move cursor inside column 1
    editor.commands.setTextSelection(3)
    expect(isInsideColumns(editor)).toBe(true)

    // filterSlashCommands should exclude columns commands when inside columns
    const insideResults = filterSlashCommands('columns', editor)
    expect(insideResults.some((c) => c.id.startsWith('columns-'))).toBe(false)

    // runSlashCommand should not insert nested columns
    const initialChildCount = editor.state.doc.firstChild?.child(0).childCount
    runSlashCommand(editor, 'columns-3', { from: 3, to: 3 })
    expect(editor.state.doc.firstChild?.child(0).childCount).toBe(initialChildCount)

    editor.destroy()
    element.remove()
  })

  describe('commandMenuTop', () => {
    it('positions below the rect when there is room below', () => {
      const rect = { top: 100, bottom: 120, left: 10, right: 10 } as DOMRect
      // menuHeight 250, gap 8 -> below is 120 + 8 = 128. 128 + 250 = 378 <= 768 - 8
      expect(commandMenuTop(rect, 250)).toBe(128)
    })

    it('flips above when there is no room below in standard viewport', () => {
      const rect = { top: 600, bottom: 620, left: 10, right: 10 } as DOMRect
      // menuHeight 300, gap 8 -> below is 628, 628 + 300 = 928 > 768 - 8
      // above is 600 - 300 - 8 = 292
      expect(commandMenuTop(rect, 300)).toBe(292)
    })

    it('respects a reduced viewportHeight (e.g. virtual keyboard open)', () => {
      const rect = { top: 220, bottom: 240, left: 10, right: 10 } as DOMRect
      // viewportHeight 380, menuHeight 200, gap 8
      // below is 248 + 200 = 448 > 380 - 8 (372)
      // above is 220 - 200 - 8 = 12 >= 8
      expect(commandMenuTop(rect, 200, 8, 8, 380)).toBe(12)
    })

    it('uses visualViewport offsetTop and height when viewportHeight argument is omitted', () => {
      const originalVV = window.visualViewport
      try {
        // Mock visualViewport for a keyboard state: height 350, offsetTop 0
        window.visualViewport = {
          height: 350,
          offsetTop: 0,
          width: 375,
          offsetLeft: 0,
          pageTop: 0,
          pageLeft: 0,
          scale: 1,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
          onresize: null,
          onscroll: null,
        } as unknown as VisualViewport

        const rect = { top: 200, bottom: 220, left: 10, right: 10 } as DOMRect
        // below is 228 + 200 = 428 > 350 - 8 (342)
        // above is 200 - 200 - 8 = -8 < 8
        // clamps to max(8, 350 - 200 - 8) = 142
        expect(commandMenuTop(rect, 200)).toBe(142)
      } finally {
        window.visualViewport = originalVV
      }
    })
  })
})
