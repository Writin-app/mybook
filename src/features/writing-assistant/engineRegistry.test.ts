import { describe, expect, it } from 'vitest'

import type { AnalysisEngine } from './contracts'
import { EngineRegistry } from './engineRegistry'

function engine(id: string, tag = 'en'): AnalysisEngine {
  return {
    id,
    capabilities: {
      supports: [{ capability: 'insights', languages: [{ tag }] }],
    },
    analyze: async () => ({ findings: [], data: null as never }),
  }
}

describe('EngineRegistry', () => {
  it('registers an engine and looks it up by capability and exact language', () => {
    const registry = new EngineRegistry()
    const insights = engine('insights')
    registry.register(insights)

    expect(registry.find('insights', 'en')).toEqual({ status: 'supported', engine: insights })
    expect(registry.find('grammar', 'en')).toMatchObject({ status: 'unsupported' })
  })

  it('rejects duplicate engine IDs without replacing the first engine', () => {
    const registry = new EngineRegistry()
    const first = engine('same-id')
    registry.register(first)

    expect(() => registry.register(engine('same-id', 'fr'))).toThrow(/already registered/u)
    expect(registry.find('insights', 'en')).toEqual({ status: 'supported', engine: first })
  })

  it.each(['hi-IN', 'hi-Latn', 'en-IN', 'en-GB', 'en-US', 'en-AU', 'und'])('does not silently route an undeclared language: %s', (languageTag) => {
    const registry = new EngineRegistry()
    registry.register(engine('english-only'))

    expect(registry.find('insights', languageTag)).toMatchObject({ status: 'unsupported' })
  })

  it('supports declared regional profiles without treating other English regions as equivalent', () => {
    const registry = new EngineRegistry()
    registry.register({
      ...engine('english-with-regional-coverage'),
      capabilities: {
        supports: [{ capability: 'insights', languages: [{ tag: 'en-IN' }, { tag: 'en-GB' }, { tag: 'en-US' }] }],
      },
    })

    expect(registry.find('insights', 'en-IN').status).toBe('supported')
    expect(registry.find('insights', 'en-GB').status).toBe('supported')
    expect(registry.find('insights', 'en-US').status).toBe('supported')
    expect(registry.find('insights', 'en-AU').status).toBe('unsupported')
  })

  it('checks every language declaration for a capability', () => {
    const registry = new EngineRegistry([{
      ...engine('multi-language'),
      capabilities: {
        supports: [
          { capability: 'insights', languages: [{ tag: 'en' }] },
          { capability: 'insights', languages: [{ tag: 'fr' }] },
        ],
      },
    }])

    expect(registry.find('insights', 'fr').status).toBe('supported')
  })
})
