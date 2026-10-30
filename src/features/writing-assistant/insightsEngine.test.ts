import { describe, expect, it, vi } from 'vitest'

import { analyzeWriting } from './analysis'
import type { EngineContext } from './contracts'
import { createWritingInsightsEngine } from './insightsEngine'

const context: EngineContext = {
  requestId: 3,
  documentId: 'doc-3',
  snapshotId: 'snapshot-3',
  languageTag: 'en',
  text: 'the the. I think this is very useful.',
}

describe('Writing Insights engine adapter', () => {
  it('delegates to the existing analysis result and preserves finding text and UTF-16 ranges', async () => {
    const runInWorker = vi.fn(async (_requestId: number, text: string) => analyzeWriting(text))
    const engine = createWritingInsightsEngine(runInWorker)
    const result = await engine.analyze(context)

    expect(runInWorker).toHaveBeenCalledWith(3, context.text)
    expect(result.data).toEqual(analyzeWriting(context.text))
    expect(result.findings.map(({ kind, text, range }) => ({ kind, text, range }))).toContainEqual({
      kind: 'repeated-word',
      text: 'the',
      range: { start: 4, end: 7, text: 'the' },
    })
    expect(result.findings.map((finding) => finding.text)).toContain('I think')
  })

  it('declares only the three supported English regional profiles', () => {
    const engine = createWritingInsightsEngine(async () => analyzeWriting(''))

    expect(engine.capabilities.supports).toEqual([
      { capability: 'insights', languages: [{ tag: 'en-IN' }, { tag: 'en-GB' }, { tag: 'en-US' }] },
    ])
  })
})
