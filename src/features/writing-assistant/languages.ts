export type WritingLanguageProfileId = 'en-IN' | 'en-GB' | 'en-US' | 'hi-IN' | 'hi-Latn' | 'mixed-hi-en'

export type DocumentWritingLanguagePreference =
  | { mode: 'automatic' }
  | { mode: 'manual'; profileId: WritingLanguageProfileId }

export interface WritingLanguageProfile {
  id: WritingLanguageProfileId
  displayName: string
  nativeName?: string
  languageTag: string | null
  baseLanguage: string | readonly string[]
  region: string | null
  script: 'Latin' | 'Devanagari' | 'Mixed'
  direction: 'ltr' | 'rtl'
  description: string
  isMixedLanguage: boolean
}

export const WRITING_LANGUAGE_PROFILES = [
  {
    id: 'en-IN',
    displayName: 'English (India)',
    languageTag: 'en-IN',
    baseLanguage: 'en',
    region: 'IN',
    script: 'Latin',
    direction: 'ltr',
    description: 'English written for an Indian audience.',
    isMixedLanguage: false,
  },
  {
    id: 'en-GB',
    displayName: 'English (UK)',
    languageTag: 'en-GB',
    baseLanguage: 'en',
    region: 'GB',
    script: 'Latin',
    direction: 'ltr',
    description: 'English written for a UK audience.',
    isMixedLanguage: false,
  },
  {
    id: 'en-US',
    displayName: 'English (US)',
    languageTag: 'en-US',
    baseLanguage: 'en',
    region: 'US',
    script: 'Latin',
    direction: 'ltr',
    description: 'English written for a US audience.',
    isMixedLanguage: false,
  },
  {
    id: 'hi-IN',
    displayName: 'Hindi',
    nativeName: 'हिन्दी',
    languageTag: 'hi-IN',
    baseLanguage: 'hi',
    region: 'IN',
    script: 'Devanagari',
    direction: 'ltr',
    description: 'Hindi written in Devanagari script.',
    isMixedLanguage: false,
  },
  {
    id: 'hi-Latn',
    displayName: 'Hindi (Roman)',
    nativeName: 'हिन्दी (रोमन)',
    languageTag: 'hi-Latn',
    baseLanguage: 'hi',
    region: null,
    script: 'Latin',
    direction: 'ltr',
    description: 'Hindi written in Latin script.',
    isMixedLanguage: false,
  },
  {
    id: 'mixed-hi-en',
    displayName: 'Hinglish',
    nativeName: 'हिंग्लिश',
    languageTag: null,
    baseLanguage: ['hi', 'en'],
    region: null,
    script: 'Mixed',
    direction: 'ltr',
    description: 'Hindi and English used together.',
    isMixedLanguage: true,
  },
] as const satisfies readonly WritingLanguageProfile[]

const profilesById = new Map<string, WritingLanguageProfile>(WRITING_LANGUAGE_PROFILES.map((profile) => [profile.id, profile]))

export function getWritingLanguageProfile(id: unknown): WritingLanguageProfile | undefined {
  return typeof id === 'string' ? profilesById.get(id) : undefined
}

export function normalizeDocumentWritingLanguagePreference(value: unknown): DocumentWritingLanguagePreference {
  if (value === 'automatic' || (typeof value === 'object' && value !== null && 'mode' in value && value.mode === 'automatic')) {
    return { mode: 'automatic' }
  }

  const profileId = typeof value === 'string'
    ? value
    : typeof value === 'object' && value !== null && 'mode' in value && value.mode === 'manual' && 'profileId' in value
      ? value.profileId
      : undefined

  return getWritingLanguageProfile(profileId)
    ? { mode: 'manual', profileId: profileId as WritingLanguageProfileId }
    : { mode: 'automatic' }
}

export function getEngineLanguageTag(preference: DocumentWritingLanguagePreference): string {
  if (preference.mode === 'automatic') return 'und'
  return getWritingLanguageProfile(preference.profileId)?.languageTag ?? 'und'
}
