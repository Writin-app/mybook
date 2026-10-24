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

function areSlicesPrefix<T>(prefix: T[], value: T[], isEqual: (x: T, y: T) => boolean): boolean {
  if (prefix.length > value.length) return false
  return prefix.every((item, index) => {
    const candidate = value[index]!
    if (isEqual(item, candidate)) return true

    // Entering text after Return changes an empty trailing paragraph into a
    // populated paragraph. Treat that as the same incremental block so a
    // delayed empty-line snapshot cannot leave an extra blank row behind.
    if (item && candidate && typeof item === 'object' && typeof candidate === 'object') {
      const emptyBlock = item as JSONContent
      const populatedBlock = candidate as JSONContent
      const isEmptyTextBlock =
        (emptyBlock.type === 'paragraph' || emptyBlock.type === 'heading') &&
        (!emptyBlock.content || emptyBlock.content.length === 0 || emptyBlock.content.every(
          (child) => child.type === 'text' && (child.text ?? '') === '' && (!child.marks || child.marks.length === 0)
        ))
      return isEmptyTextBlock &&
        emptyBlock.type === populatedBlock.type &&
        canonicalJson(emptyBlock.attrs ?? {}) === canonicalJson(populatedBlock.attrs ?? {})
    }
    return false
  })
}

function stableSliceKey<T>(slice: T[]): string {
  return slice.map((item) => typeof item === 'string' ? item : JSON.stringify(item) ?? String(item)).join('')
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

    // A typing snapshot can arrive just before or after its longer successor.
    // When both versions extend the same base and one is a prefix of the
    // other, the longer snapshot is the newer incremental edit. Merging the
    // suffixes separately can otherwise duplicate spaces or paragraph breaks.
    if (areSlicesPrefix(base, local, isEqual) && areSlicesPrefix(base, remote, isEqual)) {
      if (areSlicesPrefix(local, remote, isEqual)) {
        return { items: remote, hasConflict: false }
      }
      if (areSlicesPrefix(remote, local, isEqual)) {
        return { items: local, hasConflict: false }
      }
    }
  }

  // Handle empty base: interleave additions using LCS between local and remote
  if (base.length === 0) {
    if (local.length === 0) return { items: remote, hasConflict: false }
    if (remote.length === 0) return { items: local, hasConflict: false }
    if (areSlicesPrefix(local, remote, isEqual)) return { items: remote, hasConflict: false }
    if (areSlicesPrefix(remote, local, isEqual)) return { items: local, hasConflict: false }

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
      } else if (
        cluster.baseStart === cluster.baseEnd &&
        cluster.localHunks.every((hunk) => hunk.baseStart === hunk.baseEnd && hunk.baseStart === cluster.baseStart) &&
        cluster.remoteHunks.every((hunk) => hunk.baseStart === hunk.baseEnd && hunk.baseStart === cluster.baseStart)
      ) {
        // Concurrent insertions at the same boundary are both valid. If one
        // snapshot extends the other, use the longer snapshot (common while a
        // device is still typing). Otherwise order whole insertions stably so
        // every replica produces the same combined text without a banner.
        if (areSlicesPrefix(localSlice, remoteSlice, isEqual)) {
          resultItems.push(...remoteSlice)
        } else if (areSlicesPrefix(remoteSlice, localSlice, isEqual)) {
          resultItems.push(...localSlice)
        } else if (stableSliceKey(localSlice) <= stableSliceKey(remoteSlice)) {
          resultItems.push(...localSlice, ...remoteSlice)
        } else {
          resultItems.push(...remoteSlice, ...localSlice)
        }
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

          if (lText === rText) {
            return { merged: [lNode], resolvedCleanly: true }
          }
          if (bText === lText) {
            return {
              merged: [{ ...rNode, attrs: attrsResolved }],
              resolvedCleanly: true,
            }
          }
          if (bText === rText) {
            return {
              merged: [{ ...lNode, attrs: attrsResolved }],
              resolvedCleanly: true,
            }
          }
          if (lText.startsWith(rText) && (!bText || rText.startsWith(bText))) {
            return {
              merged: [{ ...lNode, attrs: attrsResolved }],
              resolvedCleanly: true,
            }
          }
          if (rText.startsWith(lText) && (!bText || lText.startsWith(bText))) {
            return {
              merged: [{ ...rNode, attrs: attrsResolved }],
              resolvedCleanly: true,
            }
          }

          const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
          const tokenize = (s: string) => Array.from(graphemeSegmenter.segment(s), ({ segment }) => segment)
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
    if (parsed && typeof parsed === 'object' && parsed.type === 'doc') {
      if (!parsed.content) {
        parsed.content = []
      }
      if (Array.isArray(parsed.content)) {
        return parsed
      }
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

export function normalizeDocValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeDocValue)
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const normalized: Record<string, unknown> = {}
    const sortedKeys = Object.keys(obj).sort()
    for (const key of sortedKeys) {
      const val = obj[key]
      if (key === 'attrs') {
        if (val && typeof val === 'object' && Object.keys(val).length > 0) {
          const sortedAttrs: Record<string, unknown> = {}
          for (const attrKey of Object.keys(val as Record<string, unknown>).sort()) {
            const attrVal = (val as Record<string, unknown>)[attrKey]
            if (attrVal !== undefined) {
              sortedAttrs[attrKey] = normalizeDocValue(attrVal)
            }
          }
          if (Object.keys(sortedAttrs).length > 0) {
            normalized.attrs = sortedAttrs
          }
        }
      } else if (key === 'content') {
        if (Array.isArray(val) && val.length > 0) {
          normalized.content = val.map(normalizeDocValue)
        }
      } else if (key === 'marks') {
        if (Array.isArray(val) && val.length > 0) {
          const sortedMarks = val
            .map(normalizeDocValue)
            .sort((m1, m2) => JSON.stringify(m1).localeCompare(JSON.stringify(m2)))
          normalized.marks = sortedMarks
        }
      } else if (val !== undefined) {
        normalized[key] = normalizeDocValue(val)
      }
    }
    return normalized
  }
  return value
}

export function areDocumentContentsEquivalent(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a === b) return true
  if (isEmptyDocument(a) && isEmptyDocument(b)) return true
  if (!a || !b) return false
  const docA = parseJsonDoc(a)
  const docB = parseJsonDoc(b)
  if (docA && docB) {
    return JSON.stringify(normalizeDocValue(docA)) === JSON.stringify(normalizeDocValue(docB))
  }
  try {
    const parsedA = JSON.parse(a)
    const parsedB = JSON.parse(b)
    if (parsedA && parsedB && typeof parsedA === 'object' && typeof parsedB === 'object') {
      return JSON.stringify(normalizeDocValue(parsedA)) === JSON.stringify(normalizeDocValue(parsedB))
    }
  } catch {
    // not JSON
  }
  return a.trim() === b.trim()
}

export function isDocumentPrefix(shorter: JSONContent, longer: JSONContent): boolean {
  const shortBlocks = shorter.content ?? []
  const longBlocks = longer.content ?? []
  if (shortBlocks.length > longBlocks.length) return false

  for (let index = 0; index < shortBlocks.length; index += 1) {
    const shortBlock = shortBlocks[index]!
    const longBlock = longBlocks[index]!
    if (serializeNode(shortBlock) === serializeNode(longBlock)) continue

    // A common case for an uninitialized document is the previous autosaved
    // snapshot being a prefix of the text currently in the editor. Treat that
    // as one continuing edit, not as two paragraphs to concatenate.
    const isLastShortBlock = index === shortBlocks.length - 1
    const isTextBlock = shortBlock.type === 'paragraph' || shortBlock.type === 'heading'
    const shortInline = shortBlock.content ?? []
    const longInline = longBlock.content ?? []
    const hasPlainTextOnly = (items: JSONContent[]) =>
      items.length === 0 || (items.length === 1 && items[0]?.type === 'text' && !(items[0].marks?.length))

    if (
      !isLastShortBlock ||
      !isTextBlock ||
      shortBlock.type !== longBlock.type ||
      serializeNode({ type: shortBlock.type, attrs: shortBlock.attrs }) !== serializeNode({ type: longBlock.type, attrs: longBlock.attrs }) ||
      !hasPlainTextOnly(shortInline) ||
      !hasPlainTextOnly(longInline)
    ) return false

    const shortText = shortInline[0]?.text ?? ''
    const longText = longInline[0]?.text ?? ''
    if (!longText.startsWith(shortText)) return false
  }

  return true
}

function isRawTextPrefix(shorter: string, longer: string): boolean {
  return longer.startsWith(shorter)
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

  // A missing or empty baseline is common while a new document is being
  // created and its first local save is still syncing. Snapshot merging from
  // an empty ancestor can turn successive versions of one paragraph into two
  // paragraphs (for example "abc" + "abcdef"). Only auto-accept a clear
  // prefix relationship; otherwise preserve local content and surface a real
  // conflict instead of inventing a merge.
  if (baseRaw === undefined || baseRaw === null || isEmptyDocument(baseRaw)) {
    const localDoc = parseJsonDoc(localRaw)
    const remoteDoc = parseJsonDoc(remoteRaw)
    if (localDoc && remoteDoc) {
      if (isDocumentPrefix(localDoc, remoteDoc)) {
        return { success: true, content: remoteRaw, hasConflict: false }
      }
      if (isDocumentPrefix(remoteDoc, localDoc)) {
        return { success: true, content: localRaw, hasConflict: false }
      }

      const isSingleTextBlock = (doc: JSONContent) => {
        const blocks = doc.content ?? []
        return blocks.length === 1 && (blocks[0]?.type === 'paragraph' || blocks[0]?.type === 'heading')
      }
      if (isSingleTextBlock(localDoc) && isSingleTextBlock(remoteDoc)) {
        return { success: true, content: localRaw, hasConflict: true }
      }
      // Keep the existing sequence merge for independent block additions such
      // as two devices adding separate paragraphs to a previously empty doc.
    }

    if (!localDoc || !remoteDoc) {
      if (isRawTextPrefix(localRaw, remoteRaw)) return { success: true, content: remoteRaw, hasConflict: false }
      if (isRawTextPrefix(remoteRaw, localRaw)) return { success: true, content: localRaw, hasConflict: false }
    }
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
