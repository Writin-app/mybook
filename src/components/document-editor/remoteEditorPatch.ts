import type { Editor, JSONContent } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

interface Match {
  aIdx: number
  bIdx: number
}

function computeLcsMatches<T>(
  a: T[],
  b: T[],
  isEqual: (x: T, y: T) => boolean
): Match[] {
  const m = a.length
  const n = b.length
  if (m === 0 || n === 0) return []

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))

  for (let i = 0; i < m; i += 1) {
    for (let j = 0; j < n; j += 1) {
      if (isEqual(a[i]!, b[j]!)) {
        dp[i + 1]![j + 1] = dp[i]![j]! + 1
      } else {
        dp[i + 1]![j + 1] = Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!)
      }
    }
  }

  const matches: Match[] = []
  let i = m
  let j = n
  while (i > 0 && j > 0) {
    if (isEqual(a[i - 1]!, b[j - 1]!)) {
      matches.unshift({ aIdx: i - 1, bIdx: j - 1 })
      i -= 1
      j -= 1
    } else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) {
      i -= 1
    } else {
      j -= 1
    }
  }
  return matches
}

interface EditHunk<T> {
  baseStart: number
  baseEnd: number
  replacement: T[]
}

function computeEdits<T>(
  base: T[],
  version: T[],
  isEqual: (x: T, y: T) => boolean
): EditHunk<T>[] {
  const matches = computeLcsMatches(base, version, isEqual)
  const edits: EditHunk<T>[] = []

  let prevBase = -1
  let prevVer = -1

  for (const m of matches) {
    const baseGap = m.aIdx - (prevBase + 1)
    const verGap = m.bIdx - (prevVer + 1)
    if (baseGap > 0 || verGap > 0) {
      edits.push({
        baseStart: prevBase + 1,
        baseEnd: m.aIdx,
        replacement: version.slice(prevVer + 1, m.bIdx),
      })
    }
    prevBase = m.aIdx
    prevVer = m.bIdx
  }

  if (prevBase + 1 < base.length || prevVer + 1 < version.length) {
    edits.push({
      baseStart: prevBase + 1,
      baseEnd: base.length,
      replacement: version.slice(prevVer + 1),
    })
  }

  return edits
}

function areAttrsEqual(
  a: Record<string, unknown> | null | undefined,
  b: Record<string, unknown> | null | undefined
): boolean {
  if (a === b) return true
  if (!a || !b) return !a && !b
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false
  for (const k of keysA) {
    if (a[k] !== b[k]) return false
  }
  return true
}

function getChildPositions(doc: ProseMirrorNode): Array<{ start: number; end: number }> {
  const positions: Array<{ start: number; end: number }> = []
  let cur = 0
  for (let i = 0; i < doc.childCount; i += 1) {
    const size = doc.child(i).nodeSize
    positions.push({ start: cur, end: cur + size })
    cur += size
  }
  return positions
}

export interface ApplyRemotePatchResult {
  applied: boolean
  changed: boolean
  error?: string
}

/**
 * Applies incoming remote content to a running TipTap editor instance as a non-destructive
 * ProseMirror transaction.
 *
 * Guarantees:
 * 1. Caret and selection are preserved via ProseMirror position mapping.
 * 2. Undo/redo history for local typing is preserved (addToHistory: false).
 * 3. Only the changed top-level nodes are replaced, leaving unaffected blocks untouched.
 * 4. Custom block attributes (callouts, databases, toggles, tables) are retained with 100% fidelity.
 */
export interface ApplyRemotePatchOptions {
  ignoreCaretCollision?: boolean
}

export function applyRemoteDocumentPatch(
  editor: Editor,
  nextContent: string | JSONContent,
  options: ApplyRemotePatchOptions = {}
): ApplyRemotePatchResult {
  if (editor.isDestroyed || !editor.view) {
    return { applied: false, changed: false, error: 'Editor is destroyed or unavailable' }
  }

  let nextJson: JSONContent
  if (typeof nextContent === 'string') {
    if (!nextContent) {
      nextJson = { type: 'doc', content: [{ type: 'paragraph' }] }
    } else {
      try {
        nextJson = JSON.parse(nextContent) as JSONContent
      } catch {
        nextJson = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: nextContent }] }] }
      }
    }
  } else {
    nextJson = nextContent
  }

  let nextDoc: ProseMirrorNode
  try {
    nextDoc = editor.schema.nodeFromJSON(nextJson)
  } catch (err) {
    return {
      applied: false,
      changed: false,
      error: `Failed to construct ProseMirror node from incoming JSON: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  const currentDoc = editor.state.doc
  if (currentDoc.eq(nextDoc)) {
    return { applied: true, changed: false }
  }

  try {
    const currentChildren: ProseMirrorNode[] = []
    for (let i = 0; i < currentDoc.childCount; i += 1) {
      currentChildren.push(currentDoc.child(i))
    }

    const nextChildren: ProseMirrorNode[] = []
    for (let i = 0; i < nextDoc.childCount; i += 1) {
      nextChildren.push(nextDoc.child(i))
    }

    const edits = computeEdits(currentChildren, nextChildren, (a, b) => a.eq(b))
    if (edits.length === 0) {
      return { applied: true, changed: false }
    }

    const positions = getChildPositions(currentDoc)
    const tr = editor.state.tr
    const selection = editor.state.selection

    // Apply edits in reverse order so downstream character positions remain stable
    edits.sort((a, b) => b.baseStart - a.baseStart)

    for (const hunk of edits) {
      const fromPos = hunk.baseStart < positions.length ? positions[hunk.baseStart]!.start : currentDoc.content.size
      const toPos = hunk.baseEnd > hunk.baseStart && hunk.baseEnd - 1 < positions.length
        ? positions[hunk.baseEnd - 1]!.end
        : fromPos

      // Intra-textblock fine-grained diffing when an existing single textblock is modified
      if (
        hunk.replacement.length === 1 &&
        hunk.baseEnd === hunk.baseStart + 1 &&
        hunk.baseStart < currentChildren.length
      ) {
        const currentChild = currentChildren[hunk.baseStart]!
        const nextChild = hunk.replacement[0]!

        if (
          currentChild.isTextblock &&
          nextChild.isTextblock &&
          currentChild.type === nextChild.type &&
          areAttrsEqual(currentChild.attrs, nextChild.attrs)
        ) {
          const diffStart = currentChild.content.findDiffStart(nextChild.content)
          if (diffStart === null) {
            // Contents are identical
            continue
          }
          const diffEnd = currentChild.content.findDiffEnd(nextChild.content)
          if (diffEnd === null) {
            continue
          }

          let toA = diffEnd.a
          let toB = diffEnd.b
          if (toA < diffStart) {
            const diff = diffStart - toA
            toA = diffStart
            toB += diff
          }

          const replaceFrom = fromPos + 1 + diffStart
          const replaceTo = fromPos + 1 + toA

          // Check for collision with active selection:
          if (selection) {
            const selFrom = selection.from
            const selTo = selection.to
            const isDeletingOrReplacing = replaceTo > replaceFrom

            // If the user has a highlighted range overlapping with the replacement,
            // OR if the editor is focused and the caret is within the replaced range:
            const collision =
              !options.ignoreCaretCollision &&
              isDeletingOrReplacing &&
              ((!selection.empty && selFrom < replaceTo && selTo > replaceFrom) ||
                (editor.isFocused && selFrom <= replaceTo && selTo >= replaceFrom))

            if (collision) {
              return {
                applied: false,
                changed: false,
                error: `Remote update directly conflicts with active selection/typing in block ${hunk.baseStart} (${replaceFrom}..${replaceTo})`,
              }
            }
          }

          const slice = nextChild.content.cut(diffStart, toB)
          if (replaceFrom === replaceTo) {
            if (slice.size > 0) {
              tr.insert(replaceFrom, slice)
            }
          } else {
            tr.replaceWith(replaceFrom, replaceTo, slice)
          }
          continue
        }
      }

      // For whole-block deletions or structural replacements:
      // If the block currently contains the active selection/cursor in a focused editor, reject:
      if (!options.ignoreCaretCollision && selection && editor.isFocused && toPos > fromPos) {
        if (selection.from < toPos && selection.to > fromPos) {
          return {
            applied: false,
            changed: false,
            error: `Remote update would destructively replace the active block currently containing the cursor (${fromPos}..${toPos})`,
          }
        }
      }

      if (hunk.replacement.length === 0) {
        tr.delete(fromPos, toPos)
      } else if (fromPos === toPos) {
        tr.insert(fromPos, hunk.replacement)
      } else {
        tr.replaceWith(fromPos, toPos, hunk.replacement)
      }
    }

    // Set doc-level attributes if they changed
    if (nextDoc.attrs) {
      for (const [key, val] of Object.entries(nextDoc.attrs)) {
        if (currentDoc.attrs[key] !== val) {
          try {
            tr.setDocAttribute(key, val)
          } catch {
            // Some schemas may disallow doc attribute mutation
          }
        }
      }
    }

    // Mark as remote update so history plugin ignores it
    tr.setMeta('addToHistory', false)
    tr.setMeta('remoteUpdate', true)

    // Map selection through the transaction mapping
    if (editor.state.selection) {
      const mapped = editor.state.selection.map(tr.doc, tr.mapping)
      tr.setSelection(mapped)
    }

    editor.view.dispatch(tr)
    return { applied: true, changed: true }
  } catch (err) {
    return {
      applied: false,
      changed: false,
      error: `Failed to dispatch transaction patch: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}
