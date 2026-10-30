/// <reference lib="webworker" />
import type { Lint, LocalLinter } from 'harper.js'
import type { ProofreadCategory, ProofreadFinding, ProofreadWorkerRequest, ProofreadWorkerResponse } from './proofreadingTypes'

const scope = self as DedicatedWorkerGlobalScope
let linter: LocalLinter | null = null
let currentSessionId: string | null = null
let lints: Lint[] = []

function releaseLints() {
  for (const lint of lints) lint.free()
  lints = []
}

function categoryFor(kind: string): ProofreadCategory {
  if (kind === 'Spelling' || kind === 'Typo' || kind === 'Malapropism' || kind === 'Eggcorn') return 'spelling'
  if (kind === 'Punctuation' || kind === 'Formatting' || kind === 'BoundaryError') return 'punctuation'
  if (kind === 'Grammar' || kind === 'Agreement' || kind === 'WordOrder' || kind === 'Usage' || kind === 'Capitalization') return 'grammar'
  return 'style'
}

function post(message: ProofreadWorkerResponse) {
  scope.postMessage(message)
}

scope.onmessage = async ({ data }: MessageEvent<ProofreadWorkerRequest>) => {
  if (data.type === 'dispose') {
    if (data.sessionId === currentSessionId) {
      releaseLints()
      await linter?.dispose()
      linter = null
      lints = []
      currentSessionId = null
    }
    return
  }

  if (data.type === 'analyze') {
    currentSessionId = data.sessionId
    const requestId = data.requestId
    try {
      const startedAt = performance.now()
      if (!linter) {
        const [{ LocalLinter, Dialect: HarperDialect }, { binary }] = await Promise.all([
          import('harper.js'), import('harper.js/binary'),
        ])
        const dialect = data.dialect === 'en-IN' ? HarperDialect.Indian
          : data.dialect === 'en-GB' ? HarperDialect.British : HarperDialect.American
        linter = new LocalLinter({ binary, dialect })
        await linter.setup()
      }
      if (data.sessionId !== currentSessionId) return
      post({ type: 'ready', requestId, sessionId: data.sessionId, initMs: performance.now() - startedAt })
      const analysisStartedAt = performance.now()
      releaseLints()
      lints = await linter.lint(data.text, { language: 'plaintext', dedup: true })
      if (data.sessionId !== currentSessionId) return
      const findings: ProofreadFinding[] = []
      for (let index = 0; index < lints.length; index += 1) {
        const lint = lints[index]!
        const span = lint.span()
        const start = span.start
        const end = span.end
        span.free()
        const text = lint.get_problem_text()
        if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > data.text.length || data.text.slice(start, end) !== text) continue
        const kind = lint.lint_kind()
        findings.push({ id: String(index), kind, category: categoryFor(kind), message: lint.message(), text, start, end })
      }
      post({ type: 'findings', requestId, sessionId: data.sessionId, analysisMs: performance.now() - analysisStartedAt, findings })
    } catch (error) {
      post({ type: 'error', requestId, sessionId: data.sessionId, message: error instanceof Error ? error.message : 'Harper could not analyze this text.' })
    }
    return
  }

  if (data.sessionId !== currentSessionId || !linter) return
  try {
    const lint = lints[Number(data.findingId)]
    if (!lint || String(Number(data.findingId)) !== data.findingId) throw new Error('This finding is no longer available.')
    const suggestionObjects = lint.suggestions()
    const suggestions = suggestionObjects.map((suggestion) => suggestion.get_replacement_text())
    suggestionObjects.forEach((suggestion) => suggestion.free())
    post({ type: 'suggestions', requestId: data.requestId, sessionId: data.sessionId, findingId: data.findingId, suggestions })
  } catch (error) {
    post({ type: 'error', requestId: data.requestId, sessionId: data.sessionId, message: error instanceof Error ? error.message : 'Suggestions are unavailable.' })
  }
}

export {}
