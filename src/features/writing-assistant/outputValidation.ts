import { resolveTargetLanguageName } from './languages'
import { isRefusalOutput } from './localLlamaEngine'

export interface OutputValidationParams {
  rawText: string
  actionId: string
  sourceText: string
  targetLanguage?: string
  languageTag?: string
}

export interface OutputValidationResult {
  isValid: boolean
  cleanedText: string
  errorCode?: 'empty' | 'refusal' | 'truncated' | 'untranslated' | 'malformed' | 'wrong-language'
  errorMessage?: string
}

/**
 * Narrowly cleans known model synthetic wrapper tags, conversational preambles,
 * and trailing meta-notes while strictly preserving legitimate markdown, headings,
 * bullet lists, formatting, and user code blocks.
 */
export function cleanModelWrapperArtifacts(text: string, sourceText?: string): string {
  let cleaned = text.trim()
  const trimmedSource = sourceText?.trim() ?? ''

  // 1. Remove XML/HTML-like synthetic tags emitted by smaller models
  cleaned = cleaned.replace(/<\/?source_text>/gi, '')
  cleaned = cleaned.replace(/<\/?roman>/gi, '')
  cleaned = cleaned.replace(/<\/?output>/gi, '')

  // 2. Strip unclosed trailing tags cut off by token limits (e.g. "<source_text", "</source_text")
  cleaned = cleaned.replace(/<\/?source_text?$/gi, '')
  cleaned = cleaned.replace(/<\/?roman?$/gi, '')
  cleaned = cleaned.replace(/<\/?output?$/gi, '')

  // 3. Unwrap outer code fence ONLY when the entire output is wrapped in a fence
  // (e.g. ```markdown\n# Header\n...\n```)
  const trimmed = cleaned.trim()
  if (
    (trimmed.startsWith('```markdown\n') || trimmed.startsWith('```md\n') || trimmed.startsWith('```\n')) &&
    trimmed.endsWith('```')
  ) {
    const firstNewline = trimmed.indexOf('\n')
    const lastFence = trimmed.lastIndexOf('```')
    if (firstNewline !== -1 && lastFence > firstNewline) {
      cleaned = trimmed.slice(firstNewline + 1, lastFence).trim()
    }
  }

  // 4. Strip echoed Task header if model echoed the task instruction
  cleaned = cleaned.replace(/^Task:\s*[^\n]+\n+/i, '').trim()

  // 5. Safely strip multi-sentence conversational opener ending in "Here is the ... text/result:" or "However, I can provide..." or "Here's an example..."
  const multiSentencePreamble =
    /^(?:[^.\n]+[.\n]\s*)*?(?:(?:however,\s+)?i\s+(?:can|could|am\s+able\s+to)\s+provide(?:\s+you)?(?:\s+with)?\s+(?:a|an|the|some)?\s+[^:\n]*(?:version|text|sentence|rewritten|response|guidance)[^:\n]*:?\s*\n+|(?:here\s+(?:is|are)|here's|below\s+is)\s+(?:the\s+)?(?:rewritten|corrected|shortened|revised|improved|updated|transformed|new)\s+(?:version|text|sentence|paragraph|response|result|output)?:?\s*\n+|(?:here(?:'s|\s+is)\s+(?:an?\s+)?example\s+of\s+how\s+you\s+(?:could|can)\s+rephrase[^:\n]*:?\s*\n+))/i

  if (multiSentencePreamble.test(cleaned) && !multiSentencePreamble.test(trimmedSource)) {
    const match = cleaned.match(multiSentencePreamble)
    if (match && match[0].length < 350) {
      cleaned = cleaned.slice(match[0].length).trim()
    }
  }

  // 6. Safely strip identifiable conversational preamble prefixes
  const preambleRegex =
    /^(?:(?:certainly|sure|absolutely)!\s*)?(?:(?:here\s+(?:is|are)|here's|below\s+is|the\s+(?:corrected|rewritten|shortened|revised|improved|updated|new)\s+(?:text|sentence|version|result)\s+is)\s*(?:the\s+)?(?:rewritten|corrected|shortened|revised|improved|updated|concise|new)?\s*(?:version|text|sentence|paragraph|response|result|output)?|here(?:'s|\s+is)\s+(?:an?\s+)?example\s+of\s+how\s+you\s+(?:could|can)\s+rephrase[^:\n]*|i(?:\s+have|\s+will|'d|\s+would)?\s+(?:rewritten|corrected|shortened|revised|updated)\s+(?:the\s+)?(?:text|version|sentence|paragraph)|i(?:\s+would|'d)?\s+be\s+happy\s+to\s+(?:help(?:\s+you)?(?:\s+(?:with\s+(?:that|this)|to|shorten|rewrite|correct|improve))?|rewrite|correct|shorten|improve)(?:\s+(?:this|the|your)\s+text)?)\s*(?::|-|\.|\n)\s*/i

  if (!preambleRegex.test(trimmedSource)) {
    cleaned = cleaned.replace(preambleRegex, '').trim()
  }

  // 7. Safely strip trailing conversational commentary / notes if source text did not contain notes
  const sourceHasNote = /\b(?:note|explanation):/i.test(trimmedSource)
  if (!sourceHasNote) {
    cleaned = cleaned
      .replace(
        /\n\s*\n(?:\*|_)?(?:Note|Explanation|Notes|Summary of changes|Please note|I made the following changes|I preserved|Note that|This\s+(?:revised|rewritten|new|updated)\s+(?:version|text|sentence|draft))[\s\S]*$/i,
        '',
      )
      .trim()
  }

  // 8. Unwrap outer matching double quotes if the source did not begin with quotes
  if (cleaned.startsWith('"') && cleaned.endsWith('"') && cleaned.length >= 2 && !trimmedSource.startsWith('"')) {
    cleaned = cleaned.slice(1, -1).trim()
  }

  // 8. Strip single leading list/Roman artifact on a single sentence when source was not a list
  if (
    /^[IVXLCDM]+\.\s+/.test(cleaned) &&
    !/^[IVXLCDM]+\.\s+/.test(trimmedSource) &&
    !trimmedSource.includes('\n')
  ) {
    cleaned = cleaned.replace(/^[IVXLCDM]+\.\s+/, '').trim()
  }

  return cleaned.trim()
}

const ENGLISH_FUNCTION_WORDS = new Set([
  'the', 'is', 'are', 'was', 'were', 'this', 'that', 'these', 'those',
  'with', 'have', 'has', 'had', 'from', 'your', 'our', 'their', 'they',
  'will', 'would', 'should', 'could', 'please', 'about', 'between', 'during',
])

const TARGET_FUNCTION_WORDS: Record<string, Set<string>> = {
  Spanish: new Set([
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'en',
    'y', 'que', 'por', 'para', 'con', 'su', 'sus', 'este', 'esta', 'estos', 'estas',
    'es', 'son', 'está', 'están', 'al', 'o', 'pero', 'como',
  ]),
  French: new Set([
    'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'en', 'et', 'que', 'qui',
    'dans', 'pour', 'sur', 'avec', 'ce', 'cette', 'ces', 'est', 'sont', 'pas', 'plus',
    'ou', 'mais', 'au', 'aux', 'vos', 'notre', 'votre',
  ]),
  German: new Set([
    'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer', 'einem', 'einen',
    'und', 'in', 'im', 'zu', 'zum', 'zur', 'für', 'mit', 'auf', 'ist', 'sind', 'war',
    'nicht', 'von', 'vom', 'dieser', 'diese', 'dieses', 'wir', 'sie', 'es', 'ihr', 'ihre',
  ]),
}

/**
 * Detects model-generated meta-compliance, instruction echoing, or stall phrases
 * (in English or Hindi) where the model describes performing the task or acknowledges
 * prompt constraints rather than translating/transforming the actual document content.
 */
export function isInstructionLeakageOutput(text: string, sourceText?: string): boolean {
  if (!text) return false
  const trimmed = text.trim()
  if (!trimmed) return false

  const normalized = trimmed.replace(/\s+/g, ' ')
  const sourceNormalized = (sourceText || '').toLowerCase()

  // 1. Hindi Meta-Compliance & Stalling Statements
  const hindiInstructionLeakagePatterns = [
    // Stalling / readiness declaration
    /^(?:अनुकूलता:\s*)?मैं\s+आपकी\s+(?:सामग्री|लिखने|व्यूइंग|सूचना|लिखित\s+सहायता)\s+(?:को|के\s+लिए)\s+(?:इस\s+प्रकार\s+)?हिंदी\s+में\s+(?:अनुवाद|परिवर्तित|अनुवृत)\s*(?:करने\s+के\s+लिए\s+(?:प्रतीक्षा|तैयार|प्रशिक्षित|सहायता|उपलब्ध)\s*(?:करता\s+हूँ|हूँ|हूं|करूँगा)?|करता\s+हूँ|करता\s+हूं|करूँगा)/i,
    // Explicit compliance declaration
    /^मैं\s+आपकी\s+(?:कार्रवाइयों|निर्देशों|सूचना)\s+को\s+(?:ईमानदारी|अनुसार)\s+से?\s*पालन\s+कर\s+रहा\s+हूँ/i,
    // Permission / meta-role declaration
    /^मैं\s+आपकी\s+लिखने\s+की\s+अनुमति\s+देता\s+हूँ/i,
    // Process / maintenance meta declarations
    /^प्रोसेस\s+करने\s+वाली\s+स्थिति\s+को\s+पूरा\s+करते\s+हुए/i,
    /^मेंटेनेंस\s+करेंगे\s+पूरी\s+सामग्री/i,
    // Direct echo of Writin prompt instructions in Hindi
    /(?:तथ्यों,\s*नामों,\s*संख्याओं,\s*(?:स्वरों\s*और\s*)?समय\s*सीमाओं\s*को\s*संरक्षित\s*करें|कोई\s*अतिरिक्त\s*स्पष्टीकरण\s*न\s*जोड़ें)/i,
    /दृष्टिक्रम\s*\(\s*जैसे\s*["']?मैं["']?\s*को\s*["']?मैं["']?\s*के\s*रूप\s*में\s*रखकर\s*\)/i,
    /^आपका\s+निर्देश\s*:\s*\d+\.\s*मेरी\s+सामग्री/i,
    /^विशिष्ट\s+भाषा\s*:\s*हिंदी/i,
  ]

  for (const pattern of hindiInstructionLeakagePatterns) {
    if (pattern.test(normalized)) {
      if (!pattern.test(sourceNormalized)) {
        return true
      }
    }
  }

  // 2. English Meta-Compliance & Task Echoing
  const englishInstructionLeakagePatterns = [
    /^(?:i\s+am|i'm)\s+(?:faithfully\s+)?following\s+your\s+(?:writing\s+)?(?:instructions?|task|guidelines?)\b/i,
    /^(?:i\s+am|i'm)\s+ready\s+to\s+translate\s+(?:this|your|the)\s+(?:text|document|content)\s+into\b/i,
    /^(?:here\s+is\s+the\s+direct\s+result\s+without\s+conversational\s+preamble|output\s+only\s+the\s+direct\s+result)\b/i,
    /\bpreserve\s+all\s+(?:core\s+)?meaning,\s+facts,\s+names,\s+numbers,\s+dates,\s+and\s+perspective\b/i,
    /\bkeep\s+["']?i["']?\s+as\s+["']?i["']?\s+and\s+["']?you["']?\s+as\s+["']?you["']?\b/i,
  ]

  for (const pattern of englishInstructionLeakagePatterns) {
    if (pattern.test(normalized)) {
      if (!pattern.test(sourceNormalized)) {
        return true
      }
    }
  }

  return false
}

/**
 * Validates model output before showing it to the user.
 * Catches refusals, empty outputs, truncations, instruction leakage, and untranslated echoes.
 */
export function validateAndCleanGenerativeOutput({
  rawText,
  actionId,
  sourceText,
  targetLanguage,
}: OutputValidationParams): OutputValidationResult {
  if (!rawText || !rawText.trim()) {
    return {
      isValid: false,
      cleanedText: '',
      errorCode: 'empty',
      errorMessage: 'The assistant produced empty output. Please try again.',
    }
  }

  // Refusal check on raw text
  if (isRefusalOutput(rawText)) {
    return {
      isValid: false,
      cleanedText: '',
      errorCode: 'refusal',
      errorMessage:
        'The local assistant could not transform this text due to safety guidelines. Try rephrasing the text or choosing a different writing action.',
    }
  }

  // Narrowly clean artifacts passing sourceText for contextual preservation
  const cleanedText = cleanModelWrapperArtifacts(rawText, sourceText)

  // Refusal check on cleaned text as well (in case refusal was wrapped in synthetic tags)
  if (isRefusalOutput(cleanedText)) {
    return {
      isValid: false,
      cleanedText: '',
      errorCode: 'refusal',
      errorMessage:
        'The local assistant could not transform this text due to safety guidelines. Try rephrasing the text or choosing a different writing action.',
    }
  }

  if (!cleanedText) {
    return {
      isValid: false,
      cleanedText: '',
      errorCode: 'empty',
      errorMessage: 'The assistant produced empty output. Please try again.',
    }
  }

  // Detect severely truncated output (e.g. less than 10 chars when source was substantial)
  if (sourceText.length > 50 && cleanedText.length < 10 && actionId !== 'ask-ai') {
    return {
      isValid: false,
      cleanedText,
      errorCode: 'truncated',
      errorMessage: 'The generated output was truncated or incomplete. Please try again.',
    }
  }

  // Detect model instruction leakage / meta-compliance preamble
  if (isInstructionLeakageOutput(cleanedText, sourceText)) {
    const resolvedTarget = resolveTargetLanguageName(targetLanguage) ?? targetLanguage
    return {
      isValid: false,
      cleanedText,
      errorCode: actionId === 'translate' ? 'untranslated' : 'malformed',
      errorMessage:
        actionId === 'translate'
          ? `The local model could not complete the translation${
              resolvedTarget ? ` to ${resolvedTarget}` : ''
            }. Try rephrasing the text or try again.`
          : 'The local model generated instruction notes instead of transforming the text. Please try again.',
    }
  }

  // Translation validation: Detect unchanged source echoes, script mismatch, and wrong-language output
  if (actionId === 'translate') {
    const resolvedTarget = resolveTargetLanguageName(targetLanguage) ?? targetLanguage
    const normalizedSource = sourceText.trim().replace(/\s+/g, ' ').toLowerCase()
    const normalizedOutput = cleanedText.trim().replace(/\s+/g, ' ').toLowerCase()

    // Strip harmless trailing punctuation/whitespace while strictly preserving internal punctuation and meaningful symbols
    const stripTrailingPunct = (s: string) => s.replace(/[\s.,;:!?।॥'""‘’«»。、！？]+$/g, '')
    const baseSource = stripTrailingPunct(normalizedSource)
    const baseOutput = stripTrailingPunct(normalizedOutput)

    // 1. Exact or trailing punctuation echo
    if (baseSource.length > 15 && baseOutput === baseSource) {
      return {
        isValid: false,
        cleanedText,
        errorCode: 'untranslated',
        errorMessage: `The local model could not complete the translation${
          resolvedTarget ? ` to ${resolvedTarget}` : ''
        }. Try rephrasing the text or try again.`,
      }
    }

    // 2. Embedded source echo (model returns the source text along with extra repetition/preamble)
    if (
      baseSource.length > 25 &&
      baseOutput.includes(baseSource) &&
      baseOutput.length < baseSource.length * 1.5
    ) {
      return {
        isValid: false,
        cleanedText,
        errorCode: 'untranslated',
        errorMessage: `The local model could not complete the translation${
          resolvedTarget ? ` to ${resolvedTarget}` : ''
        }. Try rephrasing the text or try again.`,
      }
    }

    // 3. Repetitive filler token and degenerate loop detection
    const tokens = cleanedText
      .replace(/[.,/#!$%^&*;:{}=\-_`~()।॥'""‘’«»?]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean)

    if (tokens.length >= 3) {
      // 3a. Single token repeated 3+ times consecutively (e.g. "तत्व तत्व तत्व" or "word word word")
      let consecutiveCount = 1
      let lastToken = ''
      for (const token of tokens) {
        const lower = token.toLowerCase()
        if (lower === lastToken) {
          consecutiveCount++
          if (consecutiveCount >= 3) {
            return {
              isValid: false,
              cleanedText,
              errorCode: 'malformed',
              errorMessage: `The translation output contained repeated words ("${lastToken}"). Please try rephrasing or use an alternative provider.`,
            }
          }
        } else {
          consecutiveCount = 1
          lastToken = lower
        }
      }

      // 3b. Known synthetic filler / placeholder patterns
      const tatvaCount = (cleanedText.match(/तत्व/g) || []).length
      const hasSyntheticTatvaSequence = /तत्व\s+तत्व/.test(cleanedText)
      const isSyntheticTatva =
        hasSyntheticTatvaSequence ||
        /\b(lorem\s+ipsum|\[TRANSLATED:)\b/i.test(cleanedText) ||
        (!sourceText.includes('तत्व') && tatvaCount >= 3 && tatvaCount / tokens.length > 0.25)

      if (isSyntheticTatva) {
        return {
          isValid: false,
          cleanedText,
          errorCode: 'malformed',
          errorMessage:
            'The translation output contained synthetic placeholder words ("तत्व"). The local translation engine could not produce a valid translation.',
        }
      }

      // 3c. Dominant token ratio (> 35% of output for content words, > 55% for grammatical function words)
      if (tokens.length >= 6) {
        const freq = new Map<string, number>()
        let maxCount = 0
        let dominantToken = ''
        for (const t of tokens) {
          const lower = t.toLowerCase()
          const count = (freq.get(lower) || 0) + 1
          freq.set(lower, count)
          if (count > maxCount) {
            maxCount = count
            dominantToken = lower
          }
        }

        const COMMON_FUNCTION_WORDS = new Set([
          // English function words
          'the', 'is', 'are', 'was', 'were', 'it', 'its', 'in', 'on', 'at', 'to', 'for',
          'of', 'and', 'or', 'that', 'this', 'these', 'those', 'with', 'be', 'by', 'as', 'an', 'a',
          'i', 'you', 'he', 'she', 'we', 'they', 'what', 'which', 'who', 'how', 'when', 'where',
          'do', 'did', 'does', 'done', 'have', 'has', 'had', 'will', 'would', 'shall', 'should',
          'can', 'could', 'not', 'no', 'if', 'so',
          // Hindi grammatical function words / particles
          'है', 'हैं', 'था', 'थी', 'थे', 'का', 'के', 'की', 'में', 'से', 'को', 'पर',
          'और', 'भी', 'तो', 'ने', 'यह', 'वह', 'ये', 'वे', 'जो', 'सो', 'एक', 'हो', 'गा', 'गी', 'गे',
          'कि', 'या', 'तक', 'ही', 'कुछ', 'सब', 'कर', 'रहा', 'रही', 'रहे', 'गया', 'गई', 'गए',
        ])

        const isFunctionWord = COMMON_FUNCTION_WORDS.has(dominantToken)
        const dominantThreshold = isFunctionWord ? 0.55 : 0.35
        const minDominantCount = isFunctionWord ? 4 : 3

        if (maxCount >= minDominantCount && maxCount / tokens.length > dominantThreshold) {
          return {
            isValid: false,
            cleanedText,
            errorCode: 'malformed',
            errorMessage: `The translation output contained excessive repetition of the word "${dominantToken}". Please try rephrasing.`,
          }
        }

        // 3d. Low vocabulary diversity (unique ratio < 0.30 for length >= 12)
        if (tokens.length >= 12) {
          const uniqueRatio = freq.size / tokens.length
          if (uniqueRatio < 0.30) {
            return {
              isValid: false,
              cleanedText,
              errorCode: 'malformed',
              errorMessage:
                'The translation output had insufficient vocabulary diversity and appeared degenerate.',
            }
          }
        }

        // 3e. 2-gram phrase repetition loop (e.g. "a b a b a b")
        const bigramFreq = new Map<string, number>()
        for (let i = 0; i < tokens.length - 1; i++) {
          const bg = `${tokens[i]!.toLowerCase()} ${tokens[i + 1]!.toLowerCase()}`
          const c = (bigramFreq.get(bg) || 0) + 1
          bigramFreq.set(bg, c)
          if (c >= 3 && tokens.length <= 15) {
            return {
              isValid: false,
              cleanedText,
              errorCode: 'malformed',
              errorMessage: 'The translation output contained repeated phrase loops.',
            }
          }
        }
      }
    }

    // 4. Partial truncation: source had substantial length, output has very few words
    const sourceWords = sourceText.trim().split(/\s+/).filter(Boolean)
    const outputWords = cleanedText.trim().split(/\s+/).filter(Boolean)
    if (
      (sourceWords.length >= 15 && outputWords.length <= 2) ||
      (sourceWords.length >= 30 && outputWords.length < Math.max(5, Math.floor(sourceWords.length * 0.15)))
    ) {
      return {
        isValid: false,
        cleanedText,
        errorCode: 'truncated',
        errorMessage: 'The generated translation was truncated or incomplete. Please try again.',
      }
    }

    // 4. Target-language Script Verification (Quality signal, not proof of semantic accuracy)
    if (resolvedTarget === 'Hindi') {
      const hasDevanagari = /[\u0900-\u097F]/.test(cleanedText)
      const hasLatin = /[A-Za-z]/.test(cleanedText)
      const devanagariCount = (cleanedText.match(/[\u0900-\u097F]/g) || []).length
      const latinCount = (cleanedText.match(/[A-Za-z]/g) || []).length

      // If output has no Devanagari at all, but contains Latin/English prose, it was not translated into Hindi
      if (!hasDevanagari && hasLatin) {
        return {
          isValid: false,
          cleanedText,
          errorCode: 'wrong-language',
          errorMessage:
            'The local model produced an English or wrong-language response instead of Hindi. Try rephrasing the text or try again.',
        }
      }

      // If text is predominantly Latin with only a stray single Devanagari character
      if (latinCount > 40 && devanagariCount < 3) {
        return {
          isValid: false,
          cleanedText,
          errorCode: 'wrong-language',
          errorMessage:
            'The local model produced an English or wrong-language response instead of Hindi. Try rephrasing the text or try again.',
        }
      }
    } else if (resolvedTarget === 'Japanese') {
      const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(cleanedText)
      const hasLatin = /[A-Za-z]/.test(cleanedText)

      if (!hasJapanese && hasLatin) {
        return {
          isValid: false,
          cleanedText,
          errorCode: 'wrong-language',
          errorMessage:
            'The local model produced an English or wrong-language response instead of Japanese. Try rephrasing the text or try again.',
        }
      }
    } else if (resolvedTarget === 'English') {
      // If source had Devanagari Hindi, output must be translated into Latin script
      const sourceHasDevanagari = /[\u0900-\u097F]/.test(sourceText)
      if (sourceHasDevanagari) {
        const latinCount = (cleanedText.match(/[A-Za-z]/g) || []).length
        const devanagariCount = (cleanedText.match(/[\u0900-\u097F]/g) || []).length

        if (latinCount === 0 || devanagariCount > latinCount) {
          return {
            isValid: false,
            cleanedText,
            errorCode: 'wrong-language',
            errorMessage:
              'The local model returned Hindi text instead of translating to English. Try rephrasing the text or try again.',
          }
        }
      }
    } else if (
      resolvedTarget &&
      TARGET_FUNCTION_WORDS[resolvedTarget] &&
      /[A-Za-z]/.test(sourceText) &&
      outputWords.length >= 6
    ) {
      // 5. Latin-to-Latin wrong-language detection (e.g. English source -> Spanish/French/German)
      // Check if output consists predominantly of English function words with 0 target function words
      const lowerWords = cleanedText.toLowerCase().match(/\b[a-zà-ÿä-üß]+\b/g) || []
      const targetSet = TARGET_FUNCTION_WORDS[resolvedTarget]

      let englishCount = 0
      let targetCount = 0

      for (const w of lowerWords) {
        if (ENGLISH_FUNCTION_WORDS.has(w)) englishCount++
        if (targetSet.has(w)) targetCount++
      }

      // If output has 4+ English function words and zero target function words, it is still English
      if (englishCount >= 4 && targetCount === 0) {
        return {
          isValid: false,
          cleanedText,
          errorCode: 'wrong-language',
          errorMessage: `The local model produced an English or wrong-language response instead of translating to ${resolvedTarget}. Try rephrasing the text or try again.`,
        }
      }
    }
  }

  return {
    isValid: true,
    cleanedText,
  }
}
