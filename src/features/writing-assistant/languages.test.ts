import { describe, expect, it } from 'vitest'

import {
  getEngineLanguageTag,
  getWritingLanguageProfile,
  normalizeDocumentWritingLanguagePreference,
  WRITING_LANGUAGE_PROFILES,
} from './languages'

describe('writing language profiles', () => {
  it('registers the six supported product profiles with stable IDs and labels', () => {
    expect(WRITING_LANGUAGE_PROFILES.map(({ id, displayName }) => [id, displayName])).toEqual([
      ['en-IN', 'English (India)'],
      ['en-GB', 'English (UK)'],
      ['en-US', 'English (US)'],
      ['hi-IN', 'Hindi'],
      ['hi-Latn', 'Hindi (Roman)'],
      ['mixed-hi-en', 'Hinglish'],
    ])
    expect(new Set(WRITING_LANGUAGE_PROFILES.map(({ id }) => id)).size).toBe(6)
  })

  it('describes script, direction, base language, region, and BCP 47 tags', () => {
    expect(getWritingLanguageProfile('en-IN')).toMatchObject({
      languageTag: 'en-IN', baseLanguage: 'en', region: 'IN', script: 'Latin', direction: 'ltr', isMixedLanguage: false,
    })
    expect(getWritingLanguageProfile('hi-IN')).toMatchObject({
      languageTag: 'hi-IN', baseLanguage: 'hi', region: 'IN', script: 'Devanagari', direction: 'ltr', isMixedLanguage: false,
    })
    expect(getWritingLanguageProfile('hi-Latn')).toMatchObject({
      languageTag: 'hi-Latn', baseLanguage: 'hi', region: null, script: 'Latin', direction: 'ltr', isMixedLanguage: false,
    })
    expect(getWritingLanguageProfile('mixed-hi-en')).toMatchObject({
      languageTag: null, baseLanguage: ['hi', 'en'], region: null, script: 'Mixed', direction: 'ltr', isMixedLanguage: true,
    })
    for (const profile of WRITING_LANGUAGE_PROFILES.filter(({ languageTag }) => languageTag !== null)) {
      expect(Intl.getCanonicalLocales(profile.languageTag!)).toHaveLength(1)
    }
    expect(getWritingLanguageProfile('hi-IN')?.nativeName).toBe('हिन्दी')
  })

  it('treats missing and unknown preferences as unresolved Automatic', () => {
    expect(normalizeDocumentWritingLanguagePreference(undefined)).toEqual({ mode: 'automatic' })
    expect(normalizeDocumentWritingLanguagePreference('unknown')).toEqual({ mode: 'automatic' })
    expect(normalizeDocumentWritingLanguagePreference('automatic')).toEqual({ mode: 'automatic' })
    expect(normalizeDocumentWritingLanguagePreference({ mode: 'manual', profileId: 'hi-IN' })).toEqual({ mode: 'manual', profileId: 'hi-IN' })
    expect(normalizeDocumentWritingLanguagePreference({ mode: 'manual', profileId: 'invalid' })).toEqual({ mode: 'automatic' })
  })

  it('does not map Automatic or the product-level mixed profile to English', () => {
    expect(getEngineLanguageTag({ mode: 'automatic' })).toBe('und')
    expect(getEngineLanguageTag({ mode: 'manual', profileId: 'mixed-hi-en' })).toBe('und')
    expect(getEngineLanguageTag({ mode: 'manual', profileId: 'en-IN' })).toBe('en-IN')
  })
})
