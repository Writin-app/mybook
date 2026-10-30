import type { AnalysisEngine, EngineCapabilities, EngineContext, AnalysisResult, WritingFinding } from './contracts'
import type { WritingAnalysis } from './types'

export const WRITING_INSIGHTS_CAPABILITIES = {
  supports: [{ capability: 'insights', languages: [{ tag: 'en-IN' }, { tag: 'en-GB' }, { tag: 'en-US' }] }],
} as const satisfies EngineCapabilities

export type AnalyzeInWorker = (requestId: number, text: string) => Promise<WritingAnalysis>

function toFindings(engineId: string, analysis: WritingAnalysis): WritingFinding[] {
  const matches = [
    ...analysis.insights.map((insight) => ({
      kind: insight.type,
      message: insight.message,
      match: insight,
    })),
    ...analysis.fillerWords.map((match) => ({
      kind: 'filler-word',
      message: 'This word or phrase may be optional.',
      match,
    })),
  ]

  return matches.map(({ kind, message, match }, index) => ({
    id: `${engineId}:${kind}:${match.start}:${match.end}:${index}`,
    engineId,
    capability: 'insights',
    kind,
    message,
    text: match.text,
    range: { start: match.start, end: match.end, text: match.text },
  }))
}

/** Wraps the existing analysis output; the supplied executor retains Worker ownership. */
export function createWritingInsightsEngine(analyzeInWorker: AnalyzeInWorker): AnalysisEngine {
  const id = 'writin.writing-insights'
  return {
    id,
    capabilities: WRITING_INSIGHTS_CAPABILITIES,
    async analyze(context: EngineContext): Promise<AnalysisResult> {
      const analysis = await analyzeInWorker(context.requestId, context.text)
      return { findings: toFindings(id, analysis), data: analysis }
    },
  }
}
