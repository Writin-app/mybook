import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

// Drag moves whole blocks: the top-level block, or the direct child when inside a column.
export function movableBlockAt(doc: ProseMirrorNode, pos: number): { node: ProseMirrorNode; pos: number } | null {
  const $pos = doc.resolve(pos)
  let columnDepth = -1
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    if ($pos.node(depth).type.name === 'column') {
      columnDepth = depth
      break
    }
  }
  const childDepth = columnDepth === -1 ? 1 : columnDepth + 1
  if ($pos.depth < childDepth) return null
  return { node: $pos.node(childDepth), pos: $pos.before(childDepth) }
}
