import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm'

// Isolated Web Worker for production WebLLM Llama inference off the main UI thread
const handler = new WebWorkerMLCEngineHandler()

self.onmessage = (msg: MessageEvent) => {
  handler.onmessage(msg)
}
