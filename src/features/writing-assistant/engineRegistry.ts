import type { WritingCapability, WritingEngine, LanguageSupport } from './contracts'

export type EngineLookup =
  | { status: 'supported'; engine: WritingEngine }
  | { status: 'unsupported'; reason: string }

function normalizeLanguageTag(tag: string): string | null {
  try {
    return Intl.getCanonicalLocales(tag)[0]?.toLowerCase() ?? null
  } catch {
    return null
  }
}

function supportsLanguage(declaration: LanguageSupport, requestedTag: string): boolean {
  const supportedTag = normalizeLanguageTag(declaration.tag)
  const requested = normalizeLanguageTag(requestedTag)
  if (!supportedTag || !requested || requested === 'und' || supportedTag === 'und') return false
  return requested === supportedTag || Boolean(declaration.includeSubtags && requested.startsWith(`${supportedTag}-`))
}

export class EngineRegistry {
  private readonly engines = new Map<string, WritingEngine>()

  constructor(engines: readonly WritingEngine[] = []) {
    for (const engine of engines) this.register(engine)
  }

  register(engine: WritingEngine): void {
    if (this.engines.has(engine.id)) throw new Error(`Writing engine "${engine.id}" is already registered.`)
    this.engines.set(engine.id, engine)
  }

  find(capability: WritingCapability, languageTag: string): EngineLookup {
    for (const engine of this.engines.values()) {
      const supportsRequest = engine.capabilities.supports.some((entry) =>
        entry.capability === capability && entry.languages.some((language) => supportsLanguage(language, languageTag)),
      )
      if (supportsRequest) {
        return { status: 'supported', engine }
      }
    }

    return {
      status: 'unsupported',
      reason: `No registered engine supports ${capability} for language "${languageTag}".`,
    }
  }
}
