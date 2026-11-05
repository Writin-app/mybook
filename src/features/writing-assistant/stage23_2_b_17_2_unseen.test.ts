// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import type { WorkerResponse } from './bergamotTypes'
import { handleWorkerMessage, resetWorkerStateForTests } from './bergamot.worker'
import { validateAndCleanGenerativeOutput } from './outputValidation'
import { classifyTextLanguage } from './translationCapabilityRegistry'

const UNSEEN_TEST_CASES = [
  { id: 'case_01', category: 'Short everyday English', text: 'Can we meet tomorrow at the coffee shop?' },
  { id: 'case_02', category: 'Business communication', text: 'We have finalized the quarterly budget and sent it to leadership.' },
  { id: 'case_03', category: 'Long paragraph', text: 'The engineering team has been working on improving the performance of the web application. Over the past three months, several memory leaks were identified in the data processing pipeline, resulting in noticeable latency reductions across all major workflows.' },
  { id: 'case_04', category: 'Dates and numbers', text: 'The deadline for submission is October 15, 2026 at 3:30 PM.' },
  { id: 'case_05', category: 'Names and technical terms', text: 'Dr. Sharma presented his research on quantum cryptography at MIT.' },
  { id: 'case_06', category: 'Imperative sentences', text: 'Please restart the server immediately.' },
  { id: 'case_07', category: 'Questions', text: 'How do you configure the database connection for local development?' },
  { id: 'case_08', category: 'Mixed punctuation', text: "Wait—did you see the update? It's amazing; check it out!" },
  { id: 'case_09', category: 'Everyday English', text: 'I forgot my keys on the kitchen table.' },
  { id: 'case_10', category: 'Business communication', text: 'Please find the attached invoice for services rendered in September.' },
  { id: 'case_11', category: 'Long paragraph', text: 'Writing in an offline environment requires robust synchronization strategies. When network connectivity is restored, local changes must be reconciled with the remote repository without losing user edits.' },
  { id: 'case_12', category: 'Dates and numbers', text: 'Total revenue increased by 14.5% to $2.4 million in Q3.' },
  { id: 'case_13', category: 'Technical terms', text: 'Kubernetes manages containerized workloads across distributed server clusters.' },
  { id: 'case_14', category: 'Imperative sentences', text: 'Turn off the lights and lock the front door before leaving.' },
  { id: 'case_15', category: 'Questions', text: 'What time will the conference call start this evening?' }
]

describe('Stage 23.2.B.17.2 Unseen Translation Verification', () => {
  it('evaluates unseen inputs against the current worker translation engine', async () => {
    resetWorkerStateForTests()
    const fakeModel = new ArrayBuffer(200_000)
    const fakeLex = new ArrayBuffer(20_000)
    const fakeVocab = new ArrayBuffer(5_000)

    let initResp: WorkerResponse | null = null
    await handleWorkerMessage({
      type: 'INIT',
      requestId: 'init_unseen',
      directions: ['en-hi', 'hi-en'],
      buffers: {
        'en-hi': { model: fakeModel, lex: fakeLex, vocab: fakeVocab },
        'hi-en': { model: fakeModel, lex: fakeLex, vocab: fakeVocab }
      }
    }, (resp) => { initResp = resp })

    expect((initResp as WorkerResponse | null)?.type).toBe('INIT_SUCCESS')

    const auditResults = []

    for (const tc of UNSEEN_TEST_CASES) {
      let trResp: WorkerResponse | null = null
      await handleWorkerMessage({
        type: 'TRANSLATE',
        requestId: tc.id,
        direction: 'en-hi',
        text: tc.text
      }, (resp) => { trResp = resp })

      const currentResp = trResp as WorkerResponse | null
      const rawOutput = (currentResp && currentResp.type === 'TRANSLATE_SUCCESS') ? currentResp.targetText : ''
      const validation = validateAndCleanGenerativeOutput({
        rawText: rawOutput,
        actionId: 'translate',
        sourceText: tc.text,
        targetLanguage: 'hi'
      })

      auditResults.push({
        id: tc.id,
        category: tc.category,
        sourceText: tc.text,
        rawEngineOutput: rawOutput,
        realWasmInference: false, // Identified as fallback dictionary
        modelDirection: 'en-hi',
        outputDifferentFromSource: rawOutput !== tc.text,
        isValidDevanagari: /[\u0900-\u097F]/.test(rawOutput),
        preservesMeaning: false,
        validatorAccepted: validation.isValid,
        validatorErrorCode: validation.errorCode || null,
        validatorErrorMessage: validation.errorMessage || null,
      })
    }

    console.log('AUDIT_RESULTS_START')
    console.log(JSON.stringify(auditResults, null, 2))
    console.log('AUDIT_RESULTS_END')

    expect(auditResults.length).toBe(15)
  })

  it('tests Roman Hindi and Hinglish classification examples', () => {
    const ex1 = classifyTextLanguage('Please yeh report check kar lo')
    const ex2 = classifyTextLanguage('Main late ho gaya because of traffic')
    const ex3 = classifyTextLanguage('Mujhe yeh kaam karna hai')
    const ex4 = classifyTextLanguage('Today I will go to office')

    console.log('ROMAN_CLASSIFICATION_RESULTS_START')
    console.log(JSON.stringify({ ex1, ex2, ex3, ex4 }, null, 2))
    console.log('ROMAN_CLASSIFICATION_RESULTS_END')
  })
})

