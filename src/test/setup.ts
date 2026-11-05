import 'fake-indexeddb/auto'
import { webcrypto } from 'node:crypto'
import { configure } from '@testing-library/react'

configure({ asyncUtilTimeout: 5000 })

if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.randomUUID) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    writable: true,
    configurable: true,
  })
}

if (typeof globalThis.CustomEvent === 'undefined') {
  class CustomEvent<T = unknown> extends Event {
    detail: T
    constructor(type: string, eventInitDict?: CustomEventInit<T>) {
      super(type, eventInitDict)
      this.detail = eventInitDict?.detail as T
    }
  }
  globalThis.CustomEvent = CustomEvent as unknown as typeof globalThis.CustomEvent
}

const stringProto = String.prototype as unknown as {
  toWellFormed?: () => string
  isWellFormed?: () => boolean
}

if (!stringProto.toWellFormed) {
  stringProto.toWellFormed = function (this: string) {
    const str = String(this)
    let result = ''
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i)
      if (code >= 0xd800 && code <= 0xdbff) {
        if (i + 1 < str.length) {
          const next = str.charCodeAt(i + 1)
          if (next >= 0xdc00 && next <= 0xdfff) {
            result += str.charAt(i) + str.charAt(i + 1)
            i++
            continue
          }
        }
        result += '\uFFFD'
      } else if (code >= 0xdc00 && code <= 0xdfff) {
        result += '\uFFFD'
      } else {
        result += str.charAt(i)
      }
    }
    return result
  }
}

if (!stringProto.isWellFormed) {
  stringProto.isWellFormed = function (this: string) {
    return (stringProto.toWellFormed?.call(this) ?? String(this)) === String(this)
  }
}



