import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

export const FRESH_BLOCK_CLASS = 'mybook-block-just-inserted'

const guardedNodeTypes = new Set([
  'imageBlock',
  'videoBlock',
  'audioBlock',
  'fileAttachment',
  'bookmarkBlock',
  'documentLink',
  'embedBlock',
])
const POINTER_TRAVEL_PX = 6

const guardKey = new PluginKey<boolean>('freshBlockToolbarGuard')

// A step slice is the only place newly inserted nodes can come from.
function insertsGuardedBlock(steps: readonly unknown[]) {
  return steps.some((step) => {
    const content = (step as { slice?: { content?: { descendants: (callback: (node: { type: { name: string } }) => boolean | void) => void } } }).slice?.content
    if (!content) return false
    let found = false
    content.descendants((node) => {
      if (guardedNodeTypes.has(node.type.name)) found = true
      return !found
    })
    return found
  })
}

/**
 * Hides hover/focus block action toolbars right after a media or link block is
 * inserted, until the user actually moves the pointer or interacts again.
 */
export const FreshBlockToolbarGuard = Extension.create({
  name: 'freshBlockToolbarGuard',

  addProseMirrorPlugins() {
    return [
      new Plugin<boolean>({
        key: guardKey,
        state: {
          init: () => false,
          apply: (tr) => tr.docChanged && tr.getMeta('addToHistory') !== false && insertsGuardedBlock(tr.steps),
        },
        view: (view) => {
          let origin: { x: number; y: number } | null = null
          const release = () => {
            view.dom.classList.remove(FRESH_BLOCK_CLASS)
            origin = null
            document.removeEventListener('pointermove', onPointerMove, true)
            document.removeEventListener('pointerdown', release, true)
            document.removeEventListener('keydown', release, true)
          }
          const onPointerMove = (event: PointerEvent) => {
            if (!origin) {
              origin = { x: event.clientX, y: event.clientY }
              return
            }
            if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) >= POINTER_TRAVEL_PX) release()
          }
          const engage = () => {
            release()
            view.dom.classList.add(FRESH_BLOCK_CLASS)
            document.addEventListener('pointermove', onPointerMove, true)
            document.addEventListener('pointerdown', release, true)
            document.addEventListener('keydown', release, true)
          }
          return {
            update: (updatedView) => {
              if (guardKey.getState(updatedView.state)) engage()
            },
            destroy: release,
          }
        },
      }),
    ]
  },
})
