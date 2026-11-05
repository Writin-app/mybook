import { describe, expect, it } from 'vitest'
import {
  classifyTextLanguage,
  detectTextScript,
  hasDevanagariScript,
  hasLatinScript,
  LANGUAGE_PAIR_CAPABILITIES,
  normalizeSourceLanguage,
  validateTranslationRequest,
} from './translationCapabilityRegistry'

describe('Stage 23.2.B.16 — Translation Capability Registry & Script Validation', () => {
  describe('1. Script Detection Utilities', () => {
    it('accurately identifies Devanagari script', () => {
      expect(hasDevanagariScript('यह एक सुरक्षित दस्तावेज़ है।')).toBe(true)
      expect(hasDevanagariScript('Plain English sentence.')).toBe(false)
      expect(detectTextScript('नमस्ते दुनिया')).toBe('Devanagari')
    })

    it('accurately identifies Latin script', () => {
      expect(hasLatinScript('Writin local offline translation')).toBe(true)
      expect(hasLatinScript('१२३४५')).toBe(false)
      expect(detectTextScript('Hello world')).toBe('Latin')
    })

    it('accurately identifies mixed script', () => {
      expect(detectTextScript('Server pe load badh raha hai')).toBe('Latin')
      expect(detectTextScript('Server पर load बढ़ रहा है')).toBe('Mixed')
    })

    it('handles whitespace or symbols as Unknown', () => {
      expect(detectTextScript('12345 67890 !@#$%^&*()')).toBe('Unknown')
    })
  })

  describe('2. Source Language Normalization', () => {
    it('normalizes English tags and subtags to English', () => {
      expect(normalizeSourceLanguage('en')).toEqual({ name: 'English', script: 'Latin' })
      expect(normalizeSourceLanguage('en-US')).toEqual({ name: 'English', script: 'Latin' })
      expect(normalizeSourceLanguage('en-IN')).toEqual({ name: 'English', script: 'Latin' })
      expect(normalizeSourceLanguage('en-GB')).toEqual({ name: 'English', script: 'Latin' })
    })

    it('normalizes Devanagari Hindi text to Hindi', () => {
      expect(normalizeSourceLanguage('hi', 'यह हिंदी पाठ है।')).toEqual({
        name: 'Hindi',
        script: 'Devanagari',
      })
      expect(normalizeSourceLanguage('hi-IN', 'दस्तावेज़')).toEqual({
        name: 'Hindi',
        script: 'Devanagari',
      })
    })

    it('detects Roman Hindi when tagged as Hindi but text is Latin script', () => {
      expect(normalizeSourceLanguage('hi', 'Yeh ek document hai jisko translate karna hai')).toEqual({
        name: 'Roman Hindi',
        script: 'Latin',
      })
      expect(normalizeSourceLanguage('hi-Latn')).toEqual({
        name: 'Roman Hindi',
        script: 'Latin',
      })
    })

    it('detects Hinglish when tagged as mixed-hi-en or text is mixed', () => {
      expect(normalizeSourceLanguage('mixed-hi-en')).toEqual({
        name: 'Hinglish',
        script: 'Mixed',
      })
      expect(normalizeSourceLanguage('hi', 'Feature request: यह बहुत important काम है')).toEqual({
        name: 'Hinglish',
        script: 'Mixed',
      })
    })
  })

  describe('3. Request Validation & Routing Logic', () => {
    it('accepts valid English to Devanagari Hindi translation', () => {
      const res = validateTranslationRequest(
        'The quick brown fox jumps over the lazy dog.',
        'en-US',
        'hi'
      )
      expect(res.isValid).toBe(true)
      if (res.isValid) {
        expect(res.direction).toBe('en-hi')
        expect(res.sourceLanguage).toBe('English')
        expect(res.targetLanguage).toBe('Hindi')
        expect(res.engine).toBe('bergamot')
      }
    })

    it('accepts valid Devanagari Hindi to English translation', () => {
      const res = validateTranslationRequest(
        'स्थानीय अनुवाद मॉडल ने इस पैराग्राफ का सफलतापूर्वक अनुवाद किया।',
        'hi-IN',
        'en'
      )
      expect(res.isValid).toBe(true)
      if (res.isValid) {
        expect(res.direction).toBe('hi-en')
        expect(res.sourceLanguage).toBe('Hindi')
        expect(res.targetLanguage).toBe('English')
        expect(res.engine).toBe('bergamot')
      }
    })

    it('rejects Roman Hindi with explicit user-friendly unsupported error', () => {
      const res = validateTranslationRequest(
        'Aap kaisa mehsoos kar rahe hain aaj?',
        'hi-Latn',
        'en'
      )
      expect(res.isValid).toBe(false)
      if (!res.isValid) {
        expect(res.errorCode).toBe('UNSUPPORTED_SCRIPT')
        expect(res.reason).toContain('Roman Hindi (Latin script) is not supported for offline translation')
        expect(res.reason).toContain('Devanagari')
      }
    })

    it('rejects Hinglish with explicit user-friendly unsupported error', () => {
      const res = validateTranslationRequest(
        'Kal hum client meeting ke liye presentation ready kar rahe the lekin network down ho gaya tha.',
        'mixed-hi-en',
        'en'
      )
      expect(res.isValid).toBe(false)
      if (!res.isValid) {
        expect(res.errorCode).toBe('UNSUPPORTED_HINGLISH')
        expect(res.reason).toContain('Hinglish (mixed Hindi-English) is not supported for offline translation')
      }
    })

    it('rejects empty or whitespace-only source text', () => {
      const res1 = validateTranslationRequest('', 'en', 'hi')
      expect(res1.isValid).toBe(false)
      if (!res1.isValid) {
        expect(res1.errorCode).toBe('EMPTY_TEXT')
      }

      const res2 = validateTranslationRequest('   \n  \t ', 'en', 'hi')
      expect(res2.isValid).toBe(false)
      if (!res2.isValid) {
        expect(res2.errorCode).toBe('EMPTY_TEXT')
      }
    })

    it('rejects missing or empty target language', () => {
      const res = validateTranslationRequest('Some source text', 'en', '')
      expect(res.isValid).toBe(false)
      if (!res.isValid) {
        expect(res.errorCode).toBe('MISSING_TARGET')
      }
    })

    it('rejects same-language translation attempt', () => {
      const res = validateTranslationRequest('This text is already English.', 'en-US', 'English')
      expect(res.isValid).toBe(false)
      if (!res.isValid) {
        expect(res.errorCode).toBe('SAME_LANGUAGE')
        expect(res.reason).toContain('already in English')
      }
    })

    it('rejects unsupported arbitrary language pairs safely', () => {
      const res = validateTranslationRequest('Bonjour tout le monde', 'fr', 'de')
      expect(res.isValid).toBe(false)
      if (!res.isValid) {
        expect(res.errorCode).toBe('UNSUPPORTED_LANGUAGE_PAIR')
        expect(res.reason).toContain('Offline translation from "French" to "German" is currently not supported')
      }
    })
  })

  describe('4. Registry Immutability & Extensibility', () => {
    it('contains declared capabilities for English and Hindi', () => {
      const enHi = LANGUAGE_PAIR_CAPABILITIES.find(
        (c) => c.sourceLanguage === 'English' && c.targetLanguage === 'Hindi'
      )
      expect(enHi).toBeDefined()
      expect(enHi?.supportedEngine).toBe('bergamot')
      expect(enHi?.offlineAvailable).toBe(true)

      const hiEn = LANGUAGE_PAIR_CAPABILITIES.find(
        (c) => c.sourceLanguage === 'Hindi' && c.targetLanguage === 'English'
      )
      expect(hiEn).toBeDefined()
      expect(hiEn?.supportedEngine).toBe('bergamot')
      expect(hiEn?.offlineAvailable).toBe(true)
    })
  })

  describe('5. Language Detection Regression Cases (Stage 23.2.B.17)', () => {
    it('classifies "Hello, how are you?" as English', () => {
      const result = classifyTextLanguage('Hello, how are you?')
      expect(result.language).toBe('English')
      expect(result.script).toBe('Latin')
      expect(result.isOfflineSupported).toBe(true)
    })

    it('classifies "नमस्ते, आप कैसे हैं?" as Hindi (Devanagari)', () => {
      const result = classifyTextLanguage('नमस्ते, आप कैसे हैं?')
      expect(result.language).toBe('Hindi')
      expect(result.script).toBe('Devanagari')
      expect(result.isOfflineSupported).toBe(true)
    })

    it('classifies "Mujhe office jana hai" as Roman Hindi', () => {
      const result = classifyTextLanguage('Mujhe office jana hai')
      expect(result.language).toBe('Roman Hindi')
      expect(result.script).toBe('Latin')
      expect(result.isOfflineSupported).toBe(false)
      expect(result.unsupportedReason).toContain('Roman Hindi')
    })

    it('classifies "Aaj meeting hai at 5 PM" as Hinglish', () => {
      const result = classifyTextLanguage('Aaj meeting hai at 5 PM')
      expect(result.language).toBe('Hinglish')
      expect(result.isOfflineSupported).toBe(false)
      expect(result.unsupportedReason).toContain('Hinglish')
    })

    it('classifies "This is an important project" as English', () => {
      const result = classifyTextLanguage('This is an important project')
      expect(result.language).toBe('English')
      expect(result.script).toBe('Latin')
      expect(result.isOfflineSupported).toBe(true)
    })

    it('classifies "Main kal office jaunga because I have a meeting" as Hinglish', () => {
      const result = classifyTextLanguage('Main kal office jaunga because I have a meeting')
      expect(result.language).toBe('Hinglish')
      expect(result.isOfflineSupported).toBe(false)
      expect(result.unsupportedReason).toContain('Hinglish')
    })

    it('prevents Roman Hindi from silently routing as English even when document languageTag is "en"', () => {
      const res = validateTranslationRequest('Mujhe office jana hai', 'en', 'Hindi')
      expect(res.isValid).toBe(false)
      if (!res.isValid) {
        expect(res.errorCode).toBe('UNSUPPORTED_SCRIPT')
        expect(res.reason).toContain('Roman Hindi (Latin script) is not supported')
      }
    })

    it('prevents Hinglish from silently routing as English even when document languageTag is "en"', () => {
      const res = validateTranslationRequest('Aaj meeting hai at 5 PM', 'en', 'Hindi')
      expect(res.isValid).toBe(false)
      if (!res.isValid) {
        expect(res.errorCode).toBe('UNSUPPORTED_HINGLISH')
        expect(res.reason).toContain('Hinglish')
      }
    })
  })
})
