import crypto from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import * as Y from 'yjs'
import { Server } from '@hocuspocus/server'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

function requiredEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

function verifyToken(token) {
  const secret = requiredEnv('COLLAB_TOKEN_SECRET')
  const [payload, signature] = String(token || '').split('.')
  if (!payload || !signature) throw new Error('Authentication required.')
  const expected = crypto.createHmac('sha256', secret).update(payload).digest()
  let actual
  try { actual = Buffer.from(signature, 'base64url') } catch { throw new Error('Invalid authentication token.') }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) throw new Error('Invalid authentication token.')
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  if (typeof claims.email !== 'string' || claims.expiresAt < Date.now()) throw new Error('Authentication token expired.')
  return claims
}

function roomOwner(documentName) {
  const match = /^([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})::([0-9a-f-]{36})$/iu.exec(documentName)
  if (!match || !uuidPattern.test(match[2])) throw new Error('Invalid document room.')
  return { email: match[1].toLowerCase(), id: match[2].toLowerCase() }
}

function documentPath(documentName) {
  const key = crypto.createHash('sha256').update(documentName).digest('hex')
  return path.join(requiredEnv('COLLAB_DATA_DIR'), `${key}.yjs`)
}

export function createCollaborationServer() {
  const allowedOrigins = new Set(requiredEnv('COLLAB_ALLOWED_ORIGINS')
    .split(',').map((origin) => origin.trim()).filter(Boolean))
  if (!allowedOrigins.size) throw new Error('COLLAB_ALLOWED_ORIGINS must contain at least one frontend origin.')
  return new Server({
    address: process.env.COLLAB_HOST || '127.0.0.1',
    port: Number(process.env.COLLAB_PORT || 1234),
    timeout: 30_000,
    debounce: 500,
    maxDebounce: 5_000,
    async onAuthenticate({ token, documentName, requestHeaders }) {
      const origin = requestHeaders.origin
      if (!origin || !allowedOrigins.has(origin)) throw new Error('Origin is not allowed.')
      const owner = roomOwner(documentName)
      const claims = verifyToken(token)
      if (claims.email.toLowerCase() !== owner.email) throw new Error('You cannot access this document.')
      return { email: owner.email }
    },
    async onLoadDocument({ document, documentName }) {
      try {
        const update = await readFile(documentPath(documentName))
        Y.applyUpdate(document, new Uint8Array(update))
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error
      }
      return document
    },
    async onStoreDocument({ document, documentName }) {
      const target = documentPath(documentName)
      await mkdir(path.dirname(target), { recursive: true })
      const temporary = `${target}.${process.pid}.${crypto.randomUUID()}.tmp`
      await writeFile(temporary, Y.encodeStateAsUpdate(document), { mode: 0o600 })
      await rename(temporary, target)
    },
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createCollaborationServer().listen()
}
