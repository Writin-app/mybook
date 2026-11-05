import { describe, expect, it } from 'vitest'

import {
  getEngineLanguageTag,
  getWritingLanguageProfile,
  normalizeDocumentWritingLanguagePreference,
  resolveTargetLanguageName,
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

describe('resolveTargetLanguageName', () => {
  it('resolves supported language codes to canonical English names', () => {
    expect(resolveTargetLanguageName('hi')).toBe('Hindi')
    expect(resolveTargetLanguageName('en')).toBe('English')
    expect(resolveTargetLanguageName('es')).toBe('Spanish')
    expect(resolveTargetLanguageName('fr')).toBe('French')
    expect(resolveTargetLanguageName('de')).toBe('German')
    expect(resolveTargetLanguageName('ja')).toBe('Japanese')
  })

  it('resolves BCP-47 regional subtags and lowercase variations', () => {
    expect(resolveTargetLanguageName('hi-IN')).toBe('Hindi')
    expect(resolveTargetLanguageName('en-US')).toBe('English')
    expect(resolveTargetLanguageName('en-GB')).toBe('English')
    expect(resolveTargetLanguageName('es-ES')).toBe('Spanish')
    expect(resolveTargetLanguageName('fr-FR')).toBe('French')
    expect(resolveTargetLanguageName('de-DE')).toBe('German')
    expect(resolveTargetLanguageName('ja-JP')).toBe('Japanese')
    expect(resolveTargetLanguageName('hindi')).toBe('Hindi')
    expect(resolveTargetLanguageName('SPANISH')).toBe('Spanish')
  })

  it('preserves already resolved human-readable language names', () => {
    expect(resolveTargetLanguageName('English')).toBe('English')
    expect(resolveTargetLanguageName('Hindi')).toBe('Hindi')
    expect(resolveTargetLanguageName('Spanish')).toBe('Spanish')
    expect(resolveTargetLanguageName('French')).toBe('French')
    expect(resolveTargetLanguageName('German')).toBe('German')
    expect(resolveTargetLanguageName('Japanese')).toBe('Japanese')
    expect(resolveTargetLanguageName('Roman Hindi')).toBe('Roman Hindi')
    expect(resolveTargetLanguageName('Hinglish')).toBe('Hinglish')
  })

  it('does not silently map unknown language identifiers to Hindi or English', () => {
    expect(resolveTargetLanguageName('it')).toBe('it')
    expect(resolveTargetLanguageName('pt-BR')).toBe('pt-BR')
    expect(resolveTargetLanguageName('Esperanto')).toBe('Esperanto')
    expect(resolveTargetLanguageName('custom_dialect')).toBe('custom_dialect')
  })

  it('handles missing, empty, and invalid values safely', () => {
    expect(resolveTargetLanguageName(undefined)).toBeUndefined()
    expect(resolveTargetLanguageName(null)).toBeUndefined()
    expect(resolveTargetLanguageName('')).toBeUndefined()
    expect(resolveTargetLanguageName('   ')).toBeUndefined()
    expect(resolveTargetLanguageName(123)).toBeUndefined()
    expect(resolveTargetLanguageName({})).toBeUndefined()
  })
})
