import type { JSONContent } from '@tiptap/core'

export interface DocumentMergeResult {
  success: boolean
  content: string
  hasConflict?: boolean
}

/**
 * Deterministically serialize a JSON-compatible value to a canonical string
 * with sorted object keys, ensuring object comparison is independent of key order.
 */
function canonicalJson(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj)
  }
  if (Array.isArray(obj)) {
    return `[${obj.map(canonicalJson).join(',')}]`
  }
  const record = obj as Record<string, unknown>
  const keys = Object.keys(record).sort()
  const entries = keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(record[k])}`)
  return `{${entries.join(',')}}`
}

function serializeNode(node: JSONContent): string {
  try {
    return canonicalJson(node)
  } catch {
    return ''
  }
}

interface Match {
  aIdx: number
  bIdx: number
}

/**
 * Computes the Longest Common Subsequence (LCS) match pairs between sequence A and sequence B.
 */
function computeLcsMatches<T>(
  a: T[],
  b: T[],
  isEqual: (x: T, y: T) => boolean
): Match[] {
  const m = a.length
  const n = b.length
  if (m === 0 || n === 0) return []

  // Dynamic programming matrix for LCS
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

  // Backtrack to recover matches
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

/**
 * Computes the edit hunks to transform Base into Version.
 */
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

interface Cluster<T> {
  baseStart: number
  baseEnd: number
  localHunks: EditHunk<T>[]
  remoteHunks: EditHunk<T>[]
}

function doHunksOverlap<T>(h1: EditHunk<T>, h2: EditHunk<T>): boolean {
  const isIns1 = h1.baseStart === h1.baseEnd
  const isIns2 = h2.baseStart === h2.baseEnd

  if (isIns1 && isIns2) {
    return h1.baseStart === h2.baseStart
  }
  if (isIns1) {
    return h1.baseStart > h2.baseStart && h1.baseStart < h2.baseEnd
  }
  if (isIns2) {
    return h2.baseStart > h1.baseStart && h2.baseStart < h1.baseEnd
  }
  return Math.max(h1.baseStart, h2.baseStart) < Math.min(h1.baseEnd, h2.baseEnd)
}

function applyHunksToRange<T>(
  base: T[],
  rangeStart: number,
  rangeEnd: number,
  hunks: EditHunk<T>[]
): T[] {
  if (hunks.length === 0) {
    return base.slice(rangeStart, rangeEnd)
  }

  const result: T[] = []
  let cursor = rangeStart

  for (const hunk of hunks) {
    if (hunk.baseStart > cursor) {
      result.push(...base.slice(cursor, hunk.baseStart))
    }
    result.push(...hunk.replacement)
    cursor = hunk.baseEnd
  }

  if (cursor < rangeEnd) {
    result.push(...base.slice(cursor, rangeEnd))
  }

  return result
}

function areSlicesEqual<T>(s1: T[], s2: T[], isEqual: (x: T, y: T) => boolean): boolean {
  if (s1.length !== s2.length) return false
  for (let i = 0; i < s1.length; i += 1) {
    if (!isEqual(s1[i]!, s2[i]!)) return false
  }
  return true
}

/**
 * Three-way sequence merge using LCS alignment.
 * Preserves independent non-overlapping edits and correctly reports conflicts on overlapping edits.
 */
function sequence3WayMerge<T>(
  base: T[],
  local: T[],
  remote: T[],
  isEqual: (x: T, y: T) => boolean,
  mergeConflictCandidate?: (bSlice: T[], lSlice: T[], rSlice: T[]) => { merged: T[]; resolvedCleanly: boolean } | null
): { items: T[]; hasConflict: boolean } {
  // Shortcut if both sides match
  if (areSlicesEqual(local, remote, isEqual)) {
    return { items: local, hasConflict: false }
  }
  if (base.length > 0) {
    if (areSlicesEqual(local, base, isEqual)) {
      return { items: remote, hasConflict: false }
    }
    if (areSlicesEqual(remote, base, isEqual)) {
      return { items: local, hasConflict: false }
    }
  }

  // Handle empty base: interleave additions using LCS between local and remote
  if (base.length === 0) {
    if (local.length === 0) return { items: remote, hasConflict: false }
    if (remote.length === 0) return { items: local, hasConflict: false }

    const matches = computeLcsMatches(local, remote, isEqual)
    const result: T[] = []
    let prevL = -1
    let prevR = -1

    for (const m of matches) {
      result.push(...local.slice(prevL + 1, m.aIdx))
      for (const rItem of remote.slice(prevR + 1, m.bIdx)) {
        if (!result.some((existing) => isEqual(existing, rItem))) {
          result.push(rItem)
        }
      }
      result.push(local[m.aIdx]!)
      prevL = m.aIdx
      prevR = m.bIdx
    }

    result.push(...local.slice(prevL + 1))
    for (const rItem of remote.slice(prevR + 1)) {
      if (!result.some((existing) => isEqual(existing, rItem))) {
        result.push(rItem)
      }
    }

    return { items: result, hasConflict: false }
  }

  const hunksL = computeEdits(base, local, isEqual)
  const hunksR = computeEdits(base, remote, isEqual)

  // Cluster overlapping or touching hunks
  interface HunkEntry {
    side: 'local' | 'remote'
    hunk: EditHunk<T>
  }
  const allEntries: HunkEntry[] = [
    ...hunksL.map((hunk) => ({ side: 'local' as const, hunk })),
    ...hunksR.map((hunk) => ({ side: 'remote' as const, hunk })),
  ].sort((a, b) => {
    if (a.hunk.baseStart !== b.hunk.baseStart) {
      return a.hunk.baseStart - b.hunk.baseStart
    }
    return a.hunk.baseEnd - b.hunk.baseEnd
  })

  const clusters: Cluster<T>[] = []

  for (const entry of allEntries) {
    const { side, hunk } = entry
    const matchingCluster = clusters.find((c) => {
      // Check if hunk overlaps with cluster bounds or any hunk in cluster
      const clusterSpan: EditHunk<T> = { baseStart: c.baseStart, baseEnd: c.baseEnd, replacement: [] }
      if (doHunksOverlap(hunk, clusterSpan)) return true
      return (
        c.localHunks.some((lh) => doHunksOverlap(hunk, lh)) ||
        c.remoteHunks.some((rh) => doHunksOverlap(hunk, rh))
      )
    })

    if (matchingCluster) {
      matchingCluster.baseStart = Math.min(matchingCluster.baseStart, hunk.baseStart)
      matchingCluster.baseEnd = Math.max(matchingCluster.baseEnd, hunk.baseEnd)
      if (side === 'local') {
        matchingCluster.localHunks.push(hunk)
      } else {
        matchingCluster.remoteHunks.push(hunk)
      }
    } else {
      clusters.push({
        baseStart: hunk.baseStart,
        baseEnd: hunk.baseEnd,
        localHunks: side === 'local' ? [hunk] : [],
        remoteHunks: side === 'remote' ? [hunk] : [],
      })
    }
  }

  // Merge any overlapping clusters that may have expanded into each other
  clusters.sort((a, b) => a.baseStart - b.baseStart)
  const mergedClusters: Cluster<T>[] = []
  for (const c of clusters) {
    const prev = mergedClusters[mergedClusters.length - 1]
    if (prev && (prev.baseEnd > c.baseStart || (prev.baseEnd === c.baseStart && (prev.baseStart === prev.baseEnd || c.baseStart === c.baseEnd)))) {
      prev.baseEnd = Math.max(prev.baseEnd, c.baseEnd)
      prev.localHunks.push(...c.localHunks)
      prev.remoteHunks.push(...c.remoteHunks)
    } else {
      mergedClusters.push(c)
    }
  }

  const resultItems: T[] = []
  let hasConflict = false
  let cursor = 0

  for (const cluster of mergedClusters) {
    if (cluster.baseStart > cursor) {
      resultItems.push(...base.slice(cursor, cluster.baseStart))
    }

    const baseSlice = base.slice(cluster.baseStart, cluster.baseEnd)
    const localSlice = applyHunksToRange(base, cluster.baseStart, cluster.baseEnd, cluster.localHunks)
    const remoteSlice = applyHunksToRange(base, cluster.baseStart, cluster.baseEnd, cluster.remoteHunks)

    const localChanged = !areSlicesEqual(localSlice, baseSlice, isEqual)
    const remoteChanged = !areSlicesEqual(remoteSlice, baseSlice, isEqual)

    if (!localChanged && !remoteChanged) {
      resultItems.push(...baseSlice)
    } else if (localChanged && !remoteChanged) {
      resultItems.push(...localSlice)
    } else if (!localChanged && remoteChanged) {
      resultItems.push(...remoteSlice)
    } else {
      // Both changed
      if (areSlicesEqual(localSlice, remoteSlice, isEqual)) {
        resultItems.push(...localSlice)
      } else {
        const candidate = mergeConflictCandidate
          ? mergeConflictCandidate(baseSlice, localSlice, remoteSlice)
          : null

        if (candidate && candidate.resolvedCleanly) {
          resultItems.push(...candidate.merged)
        } else if (candidate) {
          resultItems.push(...candidate.merged)
          hasConflict = true
        } else {
          // Both changed incompatibly: preserve local then remote without data loss
          resultItems.push(...localSlice, ...remoteSlice)
          hasConflict = true
        }
      }
    }

    cursor = cluster.baseEnd
  }

  if (cursor < base.length) {
    resultItems.push(...base.slice(cursor))
  }

  return { items: resultItems, hasConflict }
}

/**
 * Recursive merge for container blocks (lists, callouts, etc.).
 */
function mergeBlockCluster(
  bSlice: JSONContent[],
  lSlice: JSONContent[],
  rSlice: JSONContent[]
): { merged: JSONContent[]; resolvedCleanly: boolean } | null {
  // If base was non-empty and local deleted all blocks while remote edited
  if (bSlice.length > 0 && lSlice.length === 0 && rSlice.length > 0) {
    return { merged: rSlice, resolvedCleanly: false }
  }
  if (bSlice.length > 0 && rSlice.length === 0 && lSlice.length > 0) {
    return { merged: lSlice, resolvedCleanly: false }
  }

  // If both are single container blocks of the same type
  if (lSlice.length === 1 && rSlice.length === 1 && bSlice.length === 1) {
    const lNode = lSlice[0]!
    const rNode = rSlice[0]!
    const bNode = bSlice[0]!

    if (lNode.type === rNode.type && lNode.type === bNode.type) {
      const isListContainer =
        lNode.type === 'bulletList' ||
        lNode.type === 'orderedList' ||
        lNode.type === 'taskList'

      if (isListContainer) {
        const baseItems = bNode.content ?? []
        const localItems = lNode.content ?? []
        const remoteItems = rNode.content ?? []

        const childResult = sequence3WayMerge(
          baseItems,
          localItems,
          remoteItems,
          (x, y) => serializeNode(x) === serializeNode(y),
          mergeBlockCluster
        )

        return {
          merged: [
            {
              ...lNode,
              content: childResult.items,
            },
          ],
          resolvedCleanly: !childResult.hasConflict,
        }
      }

      if (lNode.type === 'callout') {
        const baseKind = bNode.attrs?.kind
        const localKind = lNode.attrs?.kind
        const remoteKind = rNode.attrs?.kind

        const kindSame = localKind === remoteKind
        const kindResolved = kindSame
          ? localKind
          : localKind !== baseKind
            ? localKind
            : remoteKind

        const childResult = sequence3WayMerge(
          bNode.content ?? [],
          lNode.content ?? [],
          rNode.content ?? [],
          (x, y) => serializeNode(x) === serializeNode(y),
          mergeBlockCluster
        )

        return {
          merged: [
            {
              ...lNode,
              attrs: { ...lNode.attrs, kind: kindResolved },
              content: childResult.items,
            },
          ],
          resolvedCleanly: !childResult.hasConflict && (kindSame || localKind === baseKind || remoteKind === baseKind),
        }
      }

      if (lNode.type === 'paragraph' || lNode.type === 'heading') {
        const isPlainSingleText = (node: JSONContent) => {
          if (!node.content || node.content.length === 0) return true
          if (node.content.length === 1) {
            const child = node.content[0]!
            return child.type === 'text' && (!child.marks || child.marks.length === 0)
          }
          return false
        }

        const extractText = (node: JSONContent) => {
          if (!node.content || node.content.length === 0) return ''
          return node.content.map((c) => c.text ?? '').join('')
        }

        const baseLevel = bNode.attrs?.level
        const localLevel = lNode.attrs?.level
        const remoteLevel = rNode.attrs?.level
        const levelSame = localLevel === remoteLevel
        const levelResolved = levelSame
          ? localLevel
          : localLevel !== baseLevel
            ? localLevel
            : remoteLevel
        const attrsResolved = lNode.type === 'heading'
          ? { ...lNode.attrs, level: levelResolved }
          : lNode.attrs

        // If all three blocks contain simple plain text without marks
        if (isPlainSingleText(bNode) && isPlainSingleText(lNode) && isPlainSingleText(rNode)) {
          const bText = extractText(bNode)
          const lText = extractText(lNode)
          const rText = extractText(rNode)

          const tokenize = (s: string) => s.match(/\s+|\S+/g) ?? []
          const bTokens = tokenize(bText)
          const lTokens = tokenize(lText)
          const rTokens = tokenize(rText)

          const tokenResult = sequence3WayMerge(
            bTokens,
            lTokens,
            rTokens,
            (x, y) => x === y
          )

          if (!tokenResult.hasConflict) {
            const mergedText = tokenResult.items.join('')
            return {
              merged: [
                {
                  ...lNode,
                  attrs: attrsResolved,
                  content: mergedText ? [{ type: 'text', text: mergedText }] : [],
                },
              ],
              resolvedCleanly: levelSame || localLevel === baseLevel || remoteLevel === baseLevel,
            }
          }

          // Conflicting edits within the same textblock: return null so outer sequence3WayMerge
          // preserves both complete paragraph versions (local then remote) without content loss.
          return null
        }
      }
    }
  }

  return null
}

function mergeTiptapBlocks(
  baseBlocks: JSONContent[],
  localBlocks: JSONContent[],
  remoteBlocks: JSONContent[]
): { blocks: JSONContent[]; hasConflict: boolean } {
  const result = sequence3WayMerge(
    baseBlocks,
    localBlocks,
    remoteBlocks,
    (a, b) => serializeNode(a) === serializeNode(b),
    mergeBlockCluster
  )

  const blocks = result.items.length > 0 ? result.items : [{ type: 'paragraph' }]
  return { blocks, hasConflict: result.hasConflict }
}

function mergeLines(baseRaw: string, localRaw: string, remoteRaw: string): DocumentMergeResult {
  const baseLines = baseRaw.split('\n')
  const localLines = localRaw.split('\n')
  const remoteLines = remoteRaw.split('\n')

  const result = sequence3WayMerge(
    baseLines,
    localLines,
    remoteLines,
    (a, b) => a === b
  )

  return { success: true, content: result.items.join('\n'), hasConflict: result.hasConflict }
}

export function parseJsonDoc(raw: string | null | undefined): JSONContent | null {
  if (!raw || typeof raw !== 'string') return null
  try {
    const parsed = JSON.parse(raw) as JSONContent
    if (parsed && typeof parsed === 'object' && parsed.type === 'doc' && Array.isArray(parsed.content)) {
      return parsed
    }
  } catch {
    // not JSON
  }
  return null
}

export function isEmptyDocument(raw: string | null | undefined): boolean {
  if (!raw || !raw.trim()) return true
  const doc = parseJsonDoc(raw)
  if (!doc) return false
  if (!doc.content || doc.content.length === 0) return true
  return doc.content.every((block) => {
    if (!block || block.type !== 'paragraph') return false
    if (!block.content || block.content.length === 0) return true
    return block.content.every((inline) => inline && inline.type === 'text' && (!inline.text || !inline.text.trim()))
  })
}

export function areDocumentContentsEquivalent(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a === b) return true
  if (isEmptyDocument(a) && isEmptyDocument(b)) return true
  if (!a || !b) return false
  const docA = parseJsonDoc(a)
  const docB = parseJsonDoc(b)
  if (docA && docB) {
    return JSON.stringify(docA) === JSON.stringify(docB)
  }
  return false
}

export function mergeDocuments(
  baseRaw: string | null | undefined,
  localRaw: string,
  remoteRaw: string
): DocumentMergeResult {
  if (areDocumentContentsEquivalent(localRaw, remoteRaw)) {
    return { success: true, content: localRaw || remoteRaw, hasConflict: false }
  }

  if (baseRaw !== undefined && baseRaw !== null && areDocumentContentsEquivalent(localRaw, baseRaw)) {
    return { success: true, content: remoteRaw, hasConflict: false }
  }

  if (baseRaw !== undefined && baseRaw !== null && areDocumentContentsEquivalent(remoteRaw, baseRaw)) {
    return { success: true, content: localRaw, hasConflict: false }
  }

  const localDoc = parseJsonDoc(localRaw)
  const remoteDoc = parseJsonDoc(remoteRaw)

  if (localDoc && remoteDoc) {
    const baseDoc = parseJsonDoc(baseRaw)
    const { blocks, hasConflict } = mergeTiptapBlocks(
      baseDoc?.content ?? [],
      localDoc.content ?? [],
      remoteDoc.content ?? []
    )
    const resultDoc: JSONContent = {
      type: 'doc',
      ...localDoc.attrs ? { attrs: localDoc.attrs } : {},
      content: blocks,
    }
    return { success: true, content: JSON.stringify(resultDoc), hasConflict }
  }

  return mergeLines(baseRaw ?? '', localRaw, remoteRaw)
}
