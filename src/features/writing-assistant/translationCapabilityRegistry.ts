import { resolveTargetLanguageName } from './languages'

export type SupportedTranslationEngine = 'bergamot' | 'none'

export interface DetailedLanguageClassification {
  language: 'English' | 'Hindi' | 'Roman Hindi' | 'Hinglish' | 'Ambiguous'
  script: 'Latin' | 'Devanagari' | 'Mixed' | 'Unknown'
  confidence: 'high' | 'medium' | 'low'
  isOfflineSupported: boolean
  unsupportedReason?: string
}

export const HINDI_ROMAN_STOPWORDS = new Set([
  'aap', 'tum', 'mera', 'meri', 'mere', 'mujhe', 'tujhe',
  'tumhara', 'tumhari', 'tumhare', 'apna', 'apni', 'apne', 'uska', 'uski', 'uske',
  'unka', 'unki', 'unke', 'kya', 'kyun', 'kyu', 'kaise',
  'kahan', 'kaha', 'kab', 'kiska', 'kiski', 'kisko', 'sabhi',
  'hai', 'hain', 'hoon', 'hun', 'tha', 'thi', 'hoga', 'hogi', 'hoge',
  'hona', 'karna', 'karo', 'kiya', 'kiye', 'karunga', 'karenge', 'raha', 'rahi', 'rahe',
  'jana', 'jaunga', 'jao', 'jayenge', 'aana', 'aunga', 'aao', 'aayenge', 'dena',
  'dijiye', 'lena', 'sakta', 'sakti', 'sakte', 'mein', 'aur', 'ya', 'bhi', 'nahi', 'nahin', 'mat', 'kal',
  'aaj', 'subah', 'shaam', 'baje', 'baat', 'kaam', 'zaroori', 'zaruri', 'accha',
  'achha', 'theek', 'bahut', 'bohot', 'zyada', 'jyada', 'lekin', 'magar', 'isliye',
  'liya', 'diya', 'baaki', 'baki', 'shukriya', 'dhanyawad', 'namaste',
])

export const ENGLISH_SYNTAX_MARKERS = new Set([
  'the', 'is', 'are', 'am', 'was', 'were', 'have', 'has', 'had', 'do', 'does', 'did',
  'this', 'that', 'these', 'those', 'because', 'at', 'for', 'with', 'from', 'to',
  'in', 'on', 'by', 'about', 'will', 'would', 'can', 'could', 'should', 'which',
  'what', 'where', 'when', 'who', 'why', 'how', 'and', 'or', 'not', 'but', 'if',
  'an', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'under', 'since', 'without', 'until', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
])

export const COMMON_ENGLISH_WORDS = new Set([
  'hello', 'hi', 'important', 'project', 'meeting', 'office', 'work', 'today', 'tomorrow',
  'please', 'help', 'team', 'company', 'task', 'call', 'report', 'email', 'time',
  'year', 'good', 'new', 'first', 'last', 'long', 'great', 'little', 'own', 'other',
  'right', 'big', 'small', 'next', 'different', 'able', 'data', 'user', 'app', 'system',
])

/**
 * Classifies text language and script with high precision for offline translation,
 * distinguishing English, Hindi (Devanagari), Roman Hindi (Latin), and Hinglish (mixed).
 */
export function classifyTextLanguage(text: string): DetailedLanguageClassification {
  const trimmed = text.trim()
  if (!trimmed) {
    return {
      language: 'Ambiguous',
      script: 'Unknown',
      confidence: 'low',
      isOfflineSupported: false,
      unsupportedReason: 'Text is empty.',
    }
  }

  const devanagariCount = (trimmed.match(/[\u0900-\u097F]/g) || []).length
  const latinCount = (trimmed.match(/[A-Za-z]/g) || []).length

  // 1. Pure Devanagari script (or Devanagari with only numbers/punctuation)
  if (devanagariCount > 0 && latinCount === 0) {
    return {
      language: 'Hindi',
      script: 'Devanagari',
      confidence: 'high',
      isOfflineSupported: true,
    }
  }

  // 2. Mixed Devanagari and Latin script in same text -> Hinglish
  if (devanagariCount > 0 && latinCount > 0) {
    return {
      language: 'Hinglish',
      script: 'Mixed',
      confidence: 'high',
      isOfflineSupported: false,
      unsupportedReason: 'Hinglish (mixed Hindi-English) is not supported for offline translation.',
    }
  }

  // 3. Pure Latin script
  const words = trimmed.toLowerCase().match(/[a-z]{1,}/g) || []
  if (words.length === 0) {
    return {
      language: 'Ambiguous',
      script: 'Unknown',
      confidence: 'low',
      isOfflineSupported: false,
      unsupportedReason: 'No recognizable language words detected.',
    }
  }

  let hindiCount = 0
  let englishSyntaxCount = 0
  let englishWordCount = 0

  for (const w of words) {
    if (HINDI_ROMAN_STOPWORDS.has(w)) {
      hindiCount++
    }
    if (ENGLISH_SYNTAX_MARKERS.has(w)) {
      englishSyntaxCount++
    }
    if (COMMON_ENGLISH_WORDS.has(w)) {
      englishWordCount++
    }
  }

  // Pure English: No Hindi Roman words, and has English syntax or words
  if (hindiCount === 0) {
    if (englishSyntaxCount > 0 || englishWordCount > 0) {
      return {
        language: 'English',
        script: 'Latin',
        confidence: 'high',
        isOfflineSupported: true,
      }
    }
    // Ambiguous Latin (e.g. unknown Latin words with no English or Hindi markers)
    return {
      language: 'Ambiguous',
      script: 'Latin',
      confidence: 'low',
      isOfflineSupported: false,
      unsupportedReason: 'Could not reliably classify source text. Offline translation requires English or Hindi (Devanagari).',
    }
  }

  // Hindi Roman words are present!
  // If English syntax markers are also present (e.g., "because I have", "at 5 PM", "with", "and", "from", etc.)
  // OR significant English function structure -> Hinglish
  if (englishSyntaxCount > 0) {
    return {
      language: 'Hinglish',
      script: 'Latin',
      confidence: 'high',
      isOfflineSupported: false,
      unsupportedReason: 'Hinglish (mixed Hindi-English) is not supported for offline translation.',
    }
  }

  // Predominantly Hindi Roman words with only occasional English loan nouns (like "office", "meeting")
  // and ZERO English syntax markers -> Roman Hindi
  return {
    language: 'Roman Hindi',
    script: 'Latin',
    confidence: 'high',
    isOfflineSupported: false,
    unsupportedReason: 'Roman Hindi (Latin script) is not supported for offline translation. Please provide Hindi text in Devanagari script.',
  }
}

export interface LanguagePairCapability {
  sourceLanguage: string
  sourceScript?: 'Latin' | 'Devanagari' | 'Mixed'
  targetLanguage: string
  targetScript?: 'Latin' | 'Devanagari'
  supportedEngine: SupportedTranslationEngine
  offlineAvailable: boolean
  unsupportedReason?: string
}

export type TranslationValidationResult =
  | {
      isValid: true
      sourceLanguage: string
      targetLanguage: string
      direction: 'en-hi' | 'hi-en'
      engine: 'bergamot'
    }
  | {
      isValid: false
      reason: string
      errorCode:
        | 'EMPTY_TEXT'
        | 'SAME_LANGUAGE'
        | 'UNSUPPORTED_LANGUAGE_PAIR'
        | 'UNSUPPORTED_SCRIPT'
        | 'UNSUPPORTED_HINGLISH'
        | 'MISSING_TARGET'
    }

/**
 * Checks whether text contains Devanagari script characters.
 */
export function hasDevanagariScript(text: string): boolean {
  return /[\u0900-\u097F]/.test(text)
}

/**
 * Checks whether text contains Latin script characters.
 */
export function hasLatinScript(text: string): boolean {
  return /[A-Za-z]/.test(text)
}

/**
 * Detects the predominant script of a given text string.
 */
export function detectTextScript(text: string): 'Latin' | 'Devanagari' | 'Mixed' | 'Unknown' {
  const devanagariCount = (text.match(/[\u0900-\u097F]/g) || []).length
  const latinCount = (text.match(/[A-Za-z]/g) || []).length

  if (devanagariCount === 0 && latinCount === 0) return 'Unknown'
  if (devanagariCount > 0 && latinCount > 0) return 'Mixed'
  if (devanagariCount > 0) return 'Devanagari'
  return 'Latin'
}

/**
 * Central registry of language pairs and their offline translation capabilities.
 */
export const LANGUAGE_PAIR_CAPABILITIES: readonly LanguagePairCapability[] = [
  {
    sourceLanguage: 'English',
    sourceScript: 'Latin',
    targetLanguage: 'Hindi',
    targetScript: 'Devanagari',
    supportedEngine: 'bergamot',
    offlineAvailable: true,
  },
  {
    sourceLanguage: 'Hindi',
    sourceScript: 'Devanagari',
    targetLanguage: 'English',
    targetScript: 'Latin',
    supportedEngine: 'bergamot',
    offlineAvailable: true,
  },
  {
    sourceLanguage: 'Roman Hindi',
    sourceScript: 'Latin',
    targetLanguage: 'English',
    targetScript: 'Latin',
    supportedEngine: 'none',
    offlineAvailable: false,
    unsupportedReason:
      'Roman Hindi (Latin script) is not supported for offline translation. Please provide Hindi text in Devanagari script.',
  },
  {
    sourceLanguage: 'Hinglish',
    sourceScript: 'Mixed',
    targetLanguage: 'English',
    targetScript: 'Latin',
    supportedEngine: 'none',
    offlineAvailable: false,
    unsupportedReason:
      'Hinglish (mixed Hindi-English) is not supported for offline translation.',
  },
] as const

/**
 * Normalizes a source language tag or name to a canonical language name.
 */
export function normalizeSourceLanguage(
  sourceLanguageTag?: string,
  sampleText?: string
): { name: string; script?: 'Latin' | 'Devanagari' | 'Mixed' } {
  // If sample text is provided, use classifyTextLanguage to detect actual language & script,
  // preventing silent misclassification of Roman Hindi or Hinglish as English!
  if (sampleText && sampleText.trim().length > 0) {
    const classification = classifyTextLanguage(sampleText)
    if (classification.language === 'Roman Hindi') {
      return { name: 'Roman Hindi', script: 'Latin' }
    }
    if (classification.language === 'Hinglish') {
      return { name: 'Hinglish', script: classification.script === 'Devanagari' ? 'Devanagari' : 'Mixed' }
    }
    if (classification.language === 'Hindi' && classification.script === 'Devanagari') {
      return { name: 'Hindi', script: 'Devanagari' }
    }
    if (classification.language === 'English') {
      return { name: 'English', script: 'Latin' }
    }
  }

  if (!sourceLanguageTag || sourceLanguageTag === 'und') {
    return { name: 'English', script: 'Latin' }
  }

  const lower = sourceLanguageTag.toLowerCase().trim()

  if (lower === 'hi-latn' || lower === 'roman hindi') {
    return { name: 'Roman Hindi', script: 'Latin' }
  }

  if (lower === 'mixed-hi-en' || lower === 'hinglish') {
    return { name: 'Hinglish', script: 'Mixed' }
  }

  if (lower.startsWith('hi')) {
    if (sampleText) {
      const script = detectTextScript(sampleText)
      if (script === 'Latin') {
        return { name: 'Roman Hindi', script: 'Latin' }
      }
      if (script === 'Mixed') {
        return { name: 'Hinglish', script: 'Mixed' }
      }
    }
    return { name: 'Hindi', script: 'Devanagari' }
  }

  if (lower.startsWith('en')) {
    return { name: 'English', script: 'Latin' }
  }

  const resolved = resolveTargetLanguageName(sourceLanguageTag) || sourceLanguageTag
  return { name: resolved }
}

/**
 * Validates an incoming translation request against the language-pair capability registry
 * and script constraints.
 */
export function validateTranslationRequest(
  sourceText: string,
  sourceLanguageTag?: string,
  rawTargetLanguage?: string
): TranslationValidationResult {
  const trimmed = sourceText ? sourceText.trim() : ''
  if (!trimmed) {
    return {
      isValid: false,
      errorCode: 'EMPTY_TEXT',
      reason: 'Source text cannot be empty or whitespace only.',
    }
  }

  if (!rawTargetLanguage) {
    return {
      isValid: false,
      errorCode: 'MISSING_TARGET',
      reason: 'Target language must be specified for translation.',
    }
  }

  const targetName = resolveTargetLanguageName(rawTargetLanguage)
  if (!targetName) {
    return {
      isValid: false,
      errorCode: 'MISSING_TARGET',
      reason: `Unrecognized or invalid target language "${rawTargetLanguage}".`,
    }
  }

  const source = normalizeSourceLanguage(sourceLanguageTag, trimmed)

  // 0. Ambiguous or unrecognized language
  if (source.name === 'Ambiguous') {
    return {
      isValid: false,
      errorCode: 'UNSUPPORTED_LANGUAGE_PAIR',
      reason:
        'Could not reliably classify source text. Offline translation requires English or Hindi (Devanagari) text.',
    }
  }

  // 1. Explicit Roman Hindi detection
  if (source.name === 'Roman Hindi' || (source.name === 'Hindi' && source.script === 'Latin')) {
    return {
      isValid: false,
      errorCode: 'UNSUPPORTED_SCRIPT',
      reason:
        'Roman Hindi (Latin script) is not supported for offline translation. Please provide Hindi text in Devanagari script.',
    }
  }

  // 2. Explicit Hinglish detection
  if (source.name === 'Hinglish' || source.script === 'Mixed') {
    return {
      isValid: false,
      errorCode: 'UNSUPPORTED_HINGLISH',
      reason: 'Hinglish (mixed Hindi-English) is not supported for offline translation.',
    }
  }

  // 3. Same language translation attempt
  if (source.name.toLowerCase() === targetName.toLowerCase()) {
    return {
      isValid: false,
      errorCode: 'SAME_LANGUAGE',
      reason: `Source text is already in ${targetName}.`,
    }
  }

  // 4. English -> Hindi (Devanagari)
  if (source.name === 'English' && targetName === 'Hindi') {
    return {
      isValid: true,
      sourceLanguage: 'English',
      targetLanguage: 'Hindi',
      direction: 'en-hi',
      engine: 'bergamot',
    }
  }

  // 5. Hindi (Devanagari) -> English
  if (source.name === 'Hindi' && targetName === 'English') {
    if (!hasDevanagariScript(trimmed)) {
      return {
        isValid: false,
        errorCode: 'UNSUPPORTED_SCRIPT',
        reason:
          'Roman Hindi (Latin script) is not supported for offline translation. Please provide Hindi text in Devanagari script.',
      }
    }

    return {
      isValid: true,
      sourceLanguage: 'Hindi',
      targetLanguage: 'English',
      direction: 'hi-en',
      engine: 'bergamot',
    }
  }

  // 6. Unsupported pairs
  return {
    isValid: false,
    errorCode: 'UNSUPPORTED_LANGUAGE_PAIR',
    reason: `Offline translation from "${source.name}" to "${targetName}" is currently not supported. Supported offline pair is English ↔ Hindi (Devanagari).`,
  }
}
