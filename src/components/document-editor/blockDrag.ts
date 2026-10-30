import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

export const BLOCK_CONTAINERS = new Set(['column', 'toggleBlock', 'callout'])

// Drag moves whole blocks: the top-level block, or the direct child when inside a container (column, toggleBlock, callout).
export function movableBlockAt(doc: ProseMirrorNode, pos: number): { node: ProseMirrorNode; pos: number } | null {
  const $pos = doc.resolve(pos)
  let containerDepth = -1
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    if (BLOCK_CONTAINERS.has($pos.node(depth).type.name)) {
      containerDepth = depth
      break
    }
  }
  const childDepth = containerDepth === -1 ? 1 : containerDepth + 1
  if ($pos.depth < childDepth) return null
  return { node: $pos.node(childDepth), pos: $pos.before(childDepth) }
}
