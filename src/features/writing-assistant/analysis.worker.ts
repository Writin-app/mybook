import { analyzeWriting } from './analysis'
import type { WritingAnalysis } from './types'

interface AnalysisRequest {
  requestId: number
  text: string
}

interface AnalysisResponse {
  requestId: number
  analysis?: WritingAnalysis
}

const analysisWorkerScope = self as unknown as {
  addEventListener: (type: 'message', listener: (event: MessageEvent<AnalysisRequest>) => void) => void
  postMessage: (message: AnalysisResponse) => void
}

analysisWorkerScope.addEventListener('message', (event) => {
  analysisWorkerScope.postMessage({
    requestId: event.data.requestId,
    analysis: analyzeWriting(event.data.text),
  })
})
