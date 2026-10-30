export type ProofreadDialect = 'en-IN' | 'en-GB' | 'en-US'
export type ProofreadCategory = 'spelling' | 'grammar' | 'punctuation' | 'style'

export interface ProofreadFinding {
  id: string
  kind: string
  category: ProofreadCategory
  message: string
  text: string
  start: number
  end: number
}

export type ProofreadWorkerRequest =
  | { type: 'analyze'; requestId: number; sessionId: string; dialect: ProofreadDialect; text: string }
  | { type: 'suggest'; requestId: number; sessionId: string; findingId: string }
  | { type: 'dispose'; sessionId: string }

export type ProofreadWorkerResponse =
  | { type: 'ready'; requestId: number; sessionId: string; initMs: number }
  | { type: 'findings'; requestId: number; sessionId: string; analysisMs: number; findings: ProofreadFinding[] }
  | { type: 'suggestions'; requestId: number; sessionId: string; findingId: string; suggestions: string[] }
  | { type: 'error'; requestId: number; sessionId: string; message: string }
