// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'

import { convertSelectedBlocks } from './blockConversion'
import { BlockMarkdownShortcuts } from './extensions/BlockMarkdownShortcuts'
import { Callout } from './extensions/Callout'
import { ToggleBlock } from './extensions/ToggleBlock'

function createTestEditor(content: string) {
  const element = document.body.appendChild(document.createElement('div'))
  const editor = new Editor({
    element,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Callout,
      ToggleBlock,
      BlockMarkdownShortcuts,
    ],
    content,
  })

  return {
    editor,
    cleanup: () => {
      editor.destroy()
      element.remove()
    },
  }
}

describe('blockConversion', () => {
  describe('Multiple Block Selection and Conversion', () => {
    it('converts multiple checklist items to bullet list at once', () => {
      const { editor, cleanup } = createTestEditor(
        '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Item 1</p></li><li data-type="taskItem" data-checked="false"><p>Item 2</p></li><li data-type="taskItem" data-checked="false"><p>Item 3</p></li></ul>',
      )

      // Select all 3 items (from inside item 1 to inside item 3)
      let pos1 = 0, pos3 = 0
      editor.state.doc.descendants((node, pos) => {
        if (node.isText && node.text === 'Item 1') pos1 = pos
        if (node.isText && node.text === 'Item 3') pos3 = pos
      })
      editor.commands.setTextSelection({ from: pos1, to: pos3 + 6 })

      const result = convertSelectedBlocks(editor, 'bullet')
      expect(result).toBe(true)

      const html = editor.getHTML()
      expect(html).toContain('<ul><li><p>Item 1</p></li><li><p>Item 2</p></li><li><p>Item 3</p></li></ul>')
      expect(html).not.toContain('taskList')
      expect(html).not.toContain('taskItem')

      cleanup()
    })

    it('converts multiple checklist items to numbered list at once', () => {
      const { editor, cleanup } = createTestEditor(
        '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Step A</p></li><li data-type="taskItem" data-checked="false"><p>Step B</p></li></ul>',
      )

      let posA = 0, posB = 0
      editor.state.doc.descendants((node, pos) => {
        if (node.isText && node.text === 'Step A') posA = pos
        if (node.isText && node.text === 'Step B') posB = pos
      })
      editor.commands.setTextSelection({ from: posA, to: posB + 6 })

      const result = convertSelectedBlocks(editor, 'numbered')
      expect(result).toBe(true)

      const html = editor.getHTML()
      expect(html).toContain('<ol><li><p>Step A</p></li><li><p>Step B</p></li></ol>')
      expect(html).not.toContain('taskList')

      cleanup()
    })

    it('converts multiple checklist items to headings at once', () => {
      const { editor, cleanup } = createTestEditor(
        '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Section 1</p></li><li data-type="taskItem" data-checked="false"><p>Section 2</p></li></ul>',
      )

      let pos1 = 0, pos2 = 0
      editor.state.doc.descendants((node, pos) => {
        if (node.isText && node.text === 'Section 1') pos1 = pos
        if (node.isText && node.text === 'Section 2') pos2 = pos
      })
      editor.commands.setTextSelection({ from: pos1, to: pos2 + 9 })

      const result = convertSelectedBlocks(editor, 'h2')
      expect(result).toBe(true)

      const html = editor.getHTML()
      expect(html).toContain('<h2>Section 1</h2><h2>Section 2</h2>')
      expect(html).not.toContain('taskList')

      cleanup()
    })

    it('converts multiple bullet list items to checklist items at once', () => {
      const { editor, cleanup } = createTestEditor(
        '<ul><li><p>Task A</p></li><li><p>Task B</p></li></ul>',
      )

      let posA = 0, posB = 0
      editor.state.doc.descendants((node, pos) => {
        if (node.isText && node.text === 'Task A') posA = pos
        if (node.isText && node.text === 'Task B') posB = pos
      })
      editor.commands.setTextSelection({ from: posA, to: posB + 6 })

      const result = convertSelectedBlocks(editor, 'task')
      expect(result).toBe(true)

      const html = editor.getHTML()
      expect(html).toContain('data-type="taskList"')
      expect(html).toContain('Task A')
      expect(html).toContain('Task B')

      cleanup()
    })

    it('converts a subset of checklist items leaving unselected items intact', () => {
      const { editor, cleanup } = createTestEditor(
        '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Keep 1</p></li><li data-type="taskItem" data-checked="false"><p>Convert 2</p></li><li data-type="taskItem" data-checked="false"><p>Convert 3</p></li><li data-type="taskItem" data-checked="false"><p>Keep 4</p></li></ul>',
      )

      let pos2 = 0, pos3 = 0
      editor.state.doc.descendants((node, pos) => {
        if (node.isText && node.text === 'Convert 2') pos2 = pos
        if (node.isText && node.text === 'Convert 3') pos3 = pos
      })
      editor.commands.setTextSelection({ from: pos2, to: pos3 + 9 })

      const result = convertSelectedBlocks(editor, 'bullet')
      expect(result).toBe(true)

      const html = editor.getHTML()
      expect(html).toContain('Keep 1')
      expect(html).toContain('<ul><li><p>Convert 2</p></li><li><p>Convert 3</p></li></ul>')
      expect(html).toContain('Keep 4')

      cleanup()
    })
  })

  describe('Single Block Conversion', () => {
    it('converts a single checklist item to a bullet list item via blockTarget', () => {
      const { editor, cleanup } = createTestEditor(
        '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Single Task</p></li></ul>',
      )

      // Find the taskItem node
      let targetPos = 0
      let targetNode = editor.state.doc.firstChild!
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'taskItem') {
          targetPos = pos
          targetNode = node
          return false
        }
      })

      const blockTarget = {
        node: targetNode,
        pos: targetPos,
        rect: new DOMRect(),
        controlRect: new DOMRect(),
      }

      // Cursor is elsewhere or selection is empty
      editor.commands.setTextSelection(1)

      const result = convertSelectedBlocks(editor, 'bullet', blockTarget)
      expect(result).toBe(true)

      const html = editor.getHTML()
      expect(html).toContain('<ul><li><p>Single Task</p></li></ul>')
      expect(html).not.toContain('taskList')

      cleanup()
    })

    it('converts a single checklist item to Heading 3 via blockTarget', () => {
      const { editor, cleanup } = createTestEditor(
        '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Heading Section</p></li></ul>',
      )

      let targetPos = 0
      let targetNode = editor.state.doc.firstChild!
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'taskItem') {
          targetPos = pos
          targetNode = node
          return false
        }
      })

      const blockTarget = {
        node: targetNode,
        pos: targetPos,
        rect: new DOMRect(),
        controlRect: new DOMRect(),
      }

      const result = convertSelectedBlocks(editor, 'h3', blockTarget)
      expect(result).toBe(true)

      const html = editor.getHTML()
      expect(html).toContain('<h3>Heading Section</h3>')
      expect(html).not.toContain('taskList')

      cleanup()
    })
  })

  describe('Markdown Shortcut on Existing Blocks', () => {
    it('converts existing checklist item with text to bullet list when typing "- "', () => {
      const { editor, cleanup } = createTestEditor(
        '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Existing task text</p></li></ul>',
      )

      let textPos = 0
      editor.state.doc.descendants((node, pos) => {
        if (node.isText && node.text === 'Existing task text') textPos = pos
      })

      // Place cursor at beginning of existing text
      editor.commands.setTextSelection(textPos)
      editor.view.dispatch(editor.state.tr.insertText('-', textPos))

      // Trigger space
      const handleTextInput1 = editor.view.someProp('handleTextInput', (fn) => fn) as
        | ((view: unknown, from: number, to: number, text: string) => boolean | void)
        | undefined
      handleTextInput1?.(editor.view, textPos + 1, textPos + 1, ' ')

      const html = editor.getHTML()
      expect(html).toContain('<ul><li><p>Existing task text</p></li></ul>')
      expect(html).not.toContain('taskList')

      cleanup()
    })

    it('converts existing bullet item with text to checklist when typing "[ ] "', () => {
      const { editor, cleanup } = createTestEditor(
        '<ul><li><p>Existing bullet text</p></li></ul>',
      )

      let textPos = 0
      editor.state.doc.descendants((node, pos) => {
        if (node.isText && node.text === 'Existing bullet text') textPos = pos
      })

      editor.commands.setTextSelection(textPos)
      editor.view.dispatch(editor.state.tr.insertText('[ ]', textPos))

      // Trigger space after "[ ]"
      const handleTextInput2 = editor.view.someProp('handleTextInput', (fn) => fn) as
        | ((view: unknown, from: number, to: number, text: string) => boolean | void)
        | undefined
      handleTextInput2?.(editor.view, textPos + 3, textPos + 3, ' ')

      const html = editor.getHTML()
      expect(html).toContain('data-type="taskList"')
      expect(html).toContain('Existing bullet text')

      cleanup()
    })

    it('converts existing checklist item with text to Heading 2 when typing "## "', () => {
      const { editor, cleanup } = createTestEditor(
        '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>My Section Title</p></li></ul>',
      )

      let textPos = 0
      editor.state.doc.descendants((node, pos) => {
        if (node.isText && node.text === 'My Section Title') textPos = pos
      })

      editor.commands.setTextSelection(textPos)
      editor.view.dispatch(editor.state.tr.insertText('##', textPos))

      // Trigger space after "##"
      const handleTextInput3 = editor.view.someProp('handleTextInput', (fn) => fn) as
        | ((view: unknown, from: number, to: number, text: string) => boolean | void)
        | undefined
      handleTextInput3?.(editor.view, textPos + 2, textPos + 2, ' ')

      const html = editor.getHTML()
      expect(html).toContain('<h2>My Section Title</h2>')
      expect(html).not.toContain('taskList')

      cleanup()
    })

    it('converts existing paragraph to Heading 1 cleanly without orphan spaces and sets caret to start', () => {
      const { editor, cleanup } = createTestEditor('<p>Heading One</p>')

      let textPos = 0
      editor.state.doc.descendants((node, pos) => {
        if (node.isText && node.text === 'Heading One') textPos = pos
      })

      // Type '# ' at the beginning
      editor.commands.setTextSelection(textPos)
      editor.view.dispatch(editor.state.tr.insertText('#', textPos))

      const handleTextInput = editor.view.someProp('handleTextInput', (fn) => fn) as
        | ((view: unknown, from: number, to: number, text: string) => boolean | void)
        | undefined
      handleTextInput?.(editor.view, textPos + 1, textPos + 1, ' ')

      expect(editor.getHTML()).toContain('<h1>Heading One</h1>')
      expect(editor.state.doc.textContent).toBe('Heading One')
      expect(editor.state.selection.$from.parentOffset).toBe(0)

      cleanup()
    })

    it('converts existing paragraph to Heading 2 cleanly without orphan spaces and sets caret to start', () => {
      const { editor, cleanup } = createTestEditor('<p>Heading Two</p>')

      let textPos = 0
      editor.state.doc.descendants((node, pos) => {
        if (node.isText && node.text === 'Heading Two') textPos = pos
      })

      // Type '## ' at the beginning
      editor.commands.setTextSelection(textPos)
      editor.view.dispatch(editor.state.tr.insertText('##', textPos))

      const handleTextInput = editor.view.someProp('handleTextInput', (fn) => fn) as
        | ((view: unknown, from: number, to: number, text: string) => boolean | void)
        | undefined
      handleTextInput?.(editor.view, textPos + 2, textPos + 2, ' ')

      expect(editor.getHTML()).toContain('<h2>Heading Two</h2>')
      expect(editor.state.doc.textContent).toBe('Heading Two')
      expect(editor.state.selection.$from.parentOffset).toBe(0)

      cleanup()
    })

    it('converts blank paragraph to Heading 2 cleanly and keeps caret inside heading', () => {
      const { editor, cleanup } = createTestEditor('<p></p>')

      editor.commands.setTextSelection(1)
      editor.view.dispatch(editor.state.tr.insertText('##', 1))

      const handleTextInput = editor.view.someProp('handleTextInput', (fn) => fn) as
        | ((view: unknown, from: number, to: number, text: string) => boolean | void)
        | undefined
      const result = handleTextInput?.(editor.view, 3, 3, ' ')

      expect(result).toBe(true)
      expect(editor.getHTML()).toContain('<h2></h2>')
      expect(editor.state.selection.$from.parent.type.name).toBe('heading')
      expect(editor.state.selection.$from.parentOffset).toBe(0)

      cleanup()
    })

    it('converts blank paragraph to Heading 1 cleanly and keeps caret inside heading', () => {
      const { editor, cleanup } = createTestEditor('<p></p>')

      editor.commands.setTextSelection(1)
      editor.view.dispatch(editor.state.tr.insertText('#', 1))

      const handleTextInput = editor.view.someProp('handleTextInput', (fn) => fn) as
        | ((view: unknown, from: number, to: number, text: string) => boolean | void)
        | undefined
      const result = handleTextInput?.(editor.view, 2, 2, ' ')

      expect(result).toBe(true)
      expect(editor.getHTML()).toContain('<h1></h1>')
      expect(editor.state.selection.$from.parent.type.name).toBe('heading')
      expect(editor.state.selection.$from.parentOffset).toBe(0)

      cleanup()
    })

    it('converts blank paragraph to bullet list cleanly and keeps caret inside item', () => {
      const { editor, cleanup } = createTestEditor('<p></p>')

      editor.commands.setTextSelection(1)
      editor.view.dispatch(editor.state.tr.insertText('-', 1))

      const handleTextInput = editor.view.someProp('handleTextInput', (fn) => fn) as
        | ((view: unknown, from: number, to: number, text: string) => boolean | void)
        | undefined
      const result = handleTextInput?.(editor.view, 2, 2, ' ')

      expect(result).toBe(true)
      expect(editor.getHTML()).toContain('<ul><li><p></p></li></ul>')
      expect(editor.state.selection.$from.parent.type.name).toBe('paragraph')
      expect(editor.state.selection.$from.parentOffset).toBe(0)

      cleanup()
    })

    it('converts blank paragraph to numbered list cleanly and keeps caret inside item', () => {
      const { editor, cleanup } = createTestEditor('<p></p>')

      editor.commands.setTextSelection(1)
      editor.view.dispatch(editor.state.tr.insertText('1.', 1))

      const handleTextInput = editor.view.someProp('handleTextInput', (fn) => fn) as
        | ((view: unknown, from: number, to: number, text: string) => boolean | void)
        | undefined
      const result = handleTextInput?.(editor.view, 3, 3, ' ')

      expect(result).toBe(true)
      expect(editor.getHTML()).toContain('<ol><li><p></p></li></ol>')
      expect(editor.state.selection.$from.parent.type.name).toBe('paragraph')
      expect(editor.state.selection.$from.parentOffset).toBe(0)

      cleanup()
    })

    it('converts blank paragraph to checklist cleanly and keeps caret inside item', () => {
      const { editor, cleanup } = createTestEditor('<p></p>')

      editor.commands.setTextSelection(1)
      editor.view.dispatch(editor.state.tr.insertText('[]', 1))

      const handleTextInput = editor.view.someProp('handleTextInput', (fn) => fn) as
        | ((view: unknown, from: number, to: number, text: string) => boolean | void)
        | undefined
      const result = handleTextInput?.(editor.view, 3, 3, ' ')

      expect(result).toBe(true)
      expect(editor.getHTML()).toContain('data-type="taskList"')
      expect(editor.state.selection.$from.parentOffset).toBe(0)

      cleanup()
    })

    it('converts blank paragraph to blockquote cleanly and keeps caret inside quote', () => {
      const { editor, cleanup } = createTestEditor('<p></p>')

      editor.commands.setTextSelection(1)
      editor.view.dispatch(editor.state.tr.insertText('>', 1))

      const handleTextInput = editor.view.someProp('handleTextInput', (fn) => fn) as
        | ((view: unknown, from: number, to: number, text: string) => boolean | void)
        | undefined
      const result = handleTextInput?.(editor.view, 2, 2, ' ')

      expect(result).toBe(true)
      expect(editor.getHTML()).toContain('<blockquote><p></p></blockquote>')
      expect(editor.state.selection.$from.parentOffset).toBe(0)

      cleanup()
    })

    it('creates bullet list inside blockquote when typing "- " inside quote', () => {
      const { editor, cleanup } = createTestEditor('<blockquote><p></p></blockquote>')

      // Inside the blockquote paragraph: doc layout is doc > blockquote (pos 0) > p (pos 1) > content (pos 2)
      editor.commands.setTextSelection(2)
      editor.view.dispatch(editor.state.tr.insertText('-', 2))

      const handleTextInput = editor.view.someProp('handleTextInput', (fn) => fn) as
        | ((view: unknown, from: number, to: number, text: string) => boolean | void)
        | undefined
      const result = handleTextInput?.(editor.view, 3, 3, ' ')

      expect(result).toBe(true)
      const html = editor.getHTML()
      expect(html).toContain('<blockquote><ul><li><p></p></li></ul></blockquote>')

      cleanup()
    })

    it('creates numbered list inside callout when typing "1. " inside callout', () => {
      const { editor, cleanup } = createTestEditor('<aside data-type="callout"><p></p></aside>')

      // Inside callout paragraph
      let pPos = 0
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'paragraph') pPos = pos + 1
      })

      editor.commands.setTextSelection(pPos)
      editor.view.dispatch(editor.state.tr.insertText('1.', pPos))

      const handleTextInput = editor.view.someProp('handleTextInput', (fn) => fn) as
        | ((view: unknown, from: number, to: number, text: string) => boolean | void)
        | undefined
      const result = handleTextInput?.(editor.view, pPos + 2, pPos + 2, ' ')

      expect(result).toBe(true)
      const html = editor.getHTML()
      expect(html).toContain('data-type="callout"')
      expect(html).toContain('<ol><li><p></p></li></ol>')

      cleanup()
    })

    it('creates task list inside toggle when typing "[ ] " inside toggle', () => {
      const { editor, cleanup } = createTestEditor('<details data-type="toggle"><summary>Toggle</summary><div><p></p></div></details>')

      let pPos = 0
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'paragraph') pPos = pos + 1
      })

      editor.commands.setTextSelection(pPos)
      editor.view.dispatch(editor.state.tr.insertText('[ ]', pPos))

      const handleTextInput = editor.view.someProp('handleTextInput', (fn) => fn) as
        | ((view: unknown, from: number, to: number, text: string) => boolean | void)
        | undefined
      const result = handleTextInput?.(editor.view, pPos + 3, pPos + 3, ' ')

      expect(result).toBe(true)
      const html = editor.getHTML()
      expect(html).toContain('data-type="toggle"')
      expect(html).toContain('data-type="taskList"')

      cleanup()
    })
  })

  describe('Toggle and Callout block replacement', () => {
    it('replaces a Heading with a Toggle Heading 1, preserving heading text as title', () => {
      const { editor, cleanup } = createTestEditor('<h1>Section Overview</h1><p>Next paragraph</p>')
      expect(editor.state.doc.childCount).toBe(2)

      const headingNode = editor.state.doc.child(0)
      const target = { node: headingNode, pos: 0 }

      const converted = convertSelectedBlocks(editor, 'toggle-h1', target)
      expect(converted).toBe(true)

      // Must replace the heading, so doc still has 2 children (toggleBlock + paragraph)
      expect(editor.state.doc.childCount).toBe(2)
      const firstChild = editor.state.doc.child(0)
      expect(firstChild.type.name).toBe('toggleBlock')
      expect(firstChild.attrs.title).toBe('Section Overview')
      expect(firstChild.attrs.level).toBe(1)

      const titleInput = editor.view.dom.querySelector<HTMLInputElement>('input.mybook-toggle-title')
      expect(titleInput).not.toBeNull()
      expect(document.activeElement).toBe(titleInput)
      expect(titleInput?.selectionStart).toBe('Section Overview'.length)

      cleanup()
    })

    it('focuses the toggle heading input with cursor at end of text when converting an existing block', () => {
      const { editor, cleanup } = createTestEditor('<h2>Heading To Convert</h2>')
      const target = { node: editor.state.doc.child(0), pos: 0 }

      const converted = convertSelectedBlocks(editor, 'toggle-h2', target)
      expect(converted).toBe(true)

      const titleInput = editor.view.dom.querySelector<HTMLInputElement>('input.mybook-toggle-title')
      expect(titleInput).not.toBeNull()
      expect(document.activeElement).toBe(titleInput)
      expect(titleInput?.value).toBe('Heading To Convert')
      expect(titleInput?.selectionStart).toBe('Heading To Convert'.length)

      cleanup()
    })

    it('replaces a Paragraph with a basic Toggle', () => {
      const { editor, cleanup } = createTestEditor('<p>Collapsible notes</p><p>Subsequent block</p>')
      expect(editor.state.doc.childCount).toBe(2)
      const target = { node: editor.state.doc.child(0), pos: 0 }

      const converted = convertSelectedBlocks(editor, 'toggle', target)
      expect(converted).toBe(true)

      expect(editor.state.doc.childCount).toBe(2)
      const toggle = editor.state.doc.child(0)
      expect(toggle.type.name).toBe('toggleBlock')
      expect(toggle.attrs.title).toBe('Collapsible notes')
      expect(toggle.attrs.level).toBeNull()
      expect(editor.state.doc.child(1).textContent).toBe('Subsequent block')

      cleanup()
    })

    it('replaces a Toggle Heading with a regular Heading 1', () => {
      const { editor, cleanup } = createTestEditor('<details data-type="toggle" data-level="1" data-title="Architecture"><summary class="mybook-toggle-summary">Architecture</summary><div class="mybook-toggle-content"><p>Detail line</p></div></details><p>Subsequent block</p>')
      const target = { node: editor.state.doc.child(0), pos: 0 }

      const converted = convertSelectedBlocks(editor, 'h1', target)
      expect(converted).toBe(true)

      const firstChild = editor.state.doc.child(0)
      expect(firstChild.type.name).toBe('heading')
      expect(firstChild.attrs.level).toBe(1)
      expect(firstChild.textContent).toBe('Architecture')
      expect(editor.state.doc.child(1).textContent).toBe('Detail line')
      expect(editor.state.doc.child(2).textContent).toBe('Subsequent block')

      cleanup()
    })

    it('replaces a Heading with a Callout block', () => {
      const { editor, cleanup } = createTestEditor('<h2>Important Warning</h2><p>Subsequent block</p>')
      expect(editor.state.doc.childCount).toBe(2)
      const target = { node: editor.state.doc.child(0), pos: 0 }

      const converted = convertSelectedBlocks(editor, 'callout', target)
      expect(converted).toBe(true)

      expect(editor.state.doc.childCount).toBe(2)
      const callout = editor.state.doc.child(0)
      expect(callout.type.name).toBe('callout')
      expect(callout.textContent).toBe('Important Warning')
      expect(editor.state.doc.child(1).textContent).toBe('Subsequent block')

      cleanup()
    })

    it('replaces a Callout with a regular Heading 2', () => {
      const { editor, cleanup } = createTestEditor('<aside data-type="callout"><p>Key Takeaway</p></aside><p>Subsequent block</p>')
      expect(editor.state.doc.childCount).toBe(2)
      const target = { node: editor.state.doc.child(0), pos: 0 }

      const converted = convertSelectedBlocks(editor, 'h2', target)
      expect(converted).toBe(true)

      expect(editor.state.doc.childCount).toBe(2)
      const heading = editor.state.doc.child(0)
      expect(heading.type.name).toBe('heading')
      expect(heading.attrs.level).toBe(2)
      expect(heading.textContent).toBe('Key Takeaway')
      expect(editor.state.doc.child(1).textContent).toBe('Subsequent block')

      cleanup()
    })

    it('capitalizes the first letter when converting a lowercase paragraph to Heading 1', () => {
      const { editor, cleanup } = createTestEditor('<p>my lowercase heading</p><p>Subsequent block</p>')
      const target = { node: editor.state.doc.child(0), pos: 0 }

      const converted = convertSelectedBlocks(editor, 'h1', target)
      expect(converted).toBe(true)

      const heading = editor.state.doc.child(0)
      expect(heading.type.name).toBe('heading')
      expect(heading.attrs.level).toBe(1)
      expect(heading.textContent).toBe('My lowercase heading')

      cleanup()
    })

    it('capitalizes the title when converting a lowercase block to a Toggle Heading', () => {
      const { editor, cleanup } = createTestEditor('<p>section details</p><p>Subsequent block</p>')
      const target = { node: editor.state.doc.child(0), pos: 0 }

      const converted = convertSelectedBlocks(editor, 'toggle-h2', target)
      expect(converted).toBe(true)

      const toggle = editor.state.doc.child(0)
      expect(toggle.type.name).toBe('toggleBlock')
      expect(toggle.attrs.level).toBe(2)
      expect(toggle.attrs.title).toBe('Section details')

      cleanup()
    })
  })
})

