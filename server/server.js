import crypto from 'node:crypto'
import http from 'node:http'
import { pathToFileURL } from 'node:url'

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const IDENTITY_SCOPES = 'openid email profile'
const SESSION_COOKIE = 'mybook_session'
const STATE_COOKIE = 'mybook_oauth_state'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo'

function createCollaborationToken(email) {
  const secret = requiredEnv('COLLAB_TOKEN_SECRET')
  if (secret.length < 32) throw new Error('COLLAB_TOKEN_SECRET must be at least 32 characters.')
  const payload = Buffer.from(JSON.stringify({ email, expiresAt: Date.now() + 5 * 60_000 })).toString('base64url')
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

function requiredEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

function getOrigin(req) {
  return (process.env.APP_ORIGIN || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`).replace(/\/$/u, '')
}

function getRedirectUri(req) {
  return process.env.GOOGLE_REDIRECT_URI || `${getOrigin(req)}/api/auth/google/callback`
}

function getCookieSecret() {
  const secret = requiredEnv('AUTH_COOKIE_SECRET')
  if (secret.length < 32) throw new Error('AUTH_COOKIE_SECRET must be at least 32 characters.')
  return crypto.createHash('sha256').update(secret).digest()
}

function encryptPayload(payload) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getCookieSecret(), iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.')
}

function decryptPayload(value) {
  const [iv, tag, encrypted] = String(value || '').split('.')
  if (!iv || !tag || !encrypted) return null
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', getCookieSecret(), Buffer.from(iv, 'base64url'))
    decipher.setAuthTag(Buffer.from(tag, 'base64url'))
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()])
    return JSON.parse(decrypted.toString('utf8'))
  } catch {
    return null
  }
}

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || '')
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=')
        return index === -1
          ? [decodeURIComponent(part), '']
          : [decodeURIComponent(part.slice(0, index)), decodeURIComponent(part.slice(index + 1))]
      }),
  )
}

function cookie(req, name, value, maxAgeSeconds) {
  const secure = process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https'
  return [
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
    secure ? 'Secure' : '',
  ].filter(Boolean).join('; ')
}

function sessionFromRequest(req) {
  const session = decryptPayload(parseCookies(req)[SESSION_COOKIE])
  return session?.email && session?.refreshToken ? session : null
}

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers })
  res.end(JSON.stringify(body))
}

function redirect(res, location, headers = {}) {
  res.writeHead(302, { Location: location, ...headers })
  res.end()
}

async function tokenPost(body) {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.error_description || data?.error || 'Google token request failed.')
  return data
}

async function getUserInfo(accessToken) {
  const response = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.error_description || data?.error || 'Could not read Google profile.')
  return data
}

function normalizePath(pathname) {
  if (pathname.startsWith('/api/auth')) return pathname.slice('/api/auth'.length) || '/'
  if (pathname.startsWith('/auth')) return pathname.slice('/auth'.length) || '/'
  if (pathname === '/api/health') return '/health'
  return pathname
}

async function handleStart(req, res, url) {
  requiredEnv('GOOGLE_CLIENT_ID')
  requiredEnv('GOOGLE_CLIENT_SECRET')
  const requestedReturnTo = url.searchParams.get('returnTo') || '/home'
  const returnTo = requestedReturnTo.startsWith('/') && !requestedReturnTo.startsWith('//') ? requestedReturnTo : '/home'
  const statePayload = { nonce: crypto.randomUUID(), returnTo, createdAt: Date.now() }
  const state = encryptPayload(statePayload)
  const query = new URLSearchParams({
    client_id: requiredEnv('GOOGLE_CLIENT_ID'),
    redirect_uri: getRedirectUri(req),
    response_type: 'code',
    scope: `${IDENTITY_SCOPES} ${DRIVE_SCOPE}`,
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    state,
  })
  redirect(res, `https://accounts.google.com/o/oauth2/v2/auth?${query}`, {
    'Set-Cookie': cookie(req, STATE_COOKIE, encryptPayload(statePayload), 10 * 60),
  })
}

async function handleCallback(req, res, url) {
  const origin = getOrigin(req)
  try {
    if (url.searchParams.get('error')) throw new Error(url.searchParams.get('error'))
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    if (!code || !state) throw new Error('Google did not return an authorization code.')

    const stateFromQuery = decryptPayload(state)
    const stateFromCookie = decryptPayload(parseCookies(req)[STATE_COOKIE])
    if (!stateFromQuery?.nonce || stateFromQuery.nonce !== stateFromCookie?.nonce) {
      throw new Error('Google sign-in state could not be verified.')
    }

    const tokens = await tokenPost({
      code,
      client_id: requiredEnv('GOOGLE_CLIENT_ID'),
      client_secret: requiredEnv('GOOGLE_CLIENT_SECRET'),
      redirect_uri: getRedirectUri(req),
      grant_type: 'authorization_code',
    })
    if (!tokens.refresh_token) {
      throw new Error('Google did not return a refresh token. Revoke app access in Google Account permissions and try again.')
    }
    if (!tokens.access_token) throw new Error('Google did not return an access token.')

    const profile = await getUserInfo(tokens.access_token)
    const email = typeof profile.email === 'string' ? profile.email.toLowerCase() : ''
    if (!email || profile.email_verified === false) throw new Error('Google account email could not be verified.')

    redirect(res, `${origin}${stateFromCookie.returnTo || '/home'}`, {
      'Set-Cookie': [
        cookie(req, SESSION_COOKIE, encryptPayload({ email, refreshToken: tokens.refresh_token, createdAt: Date.now() }), 60 * 60 * 24 * 90),
        cookie(req, STATE_COOKIE, '', 0),
      ],
    })
  } catch (error) {
    redirect(res, `${origin}/login?error=${encodeURIComponent(error instanceof Error ? error.message : 'Google sign-in failed.')}`, {
      'Set-Cookie': cookie(req, STATE_COOKIE, '', 0),
    })
  }
}

async function handleToken(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed.' })
  try {
    const session = sessionFromRequest(req)
    if (!session) return sendJson(res, 401, { error: 'Please sign in again.' })
    const token = await tokenPost({
      refresh_token: session.refreshToken,
      client_id: requiredEnv('GOOGLE_CLIENT_ID'),
      client_secret: requiredEnv('GOOGLE_CLIENT_SECRET'),
      grant_type: 'refresh_token',
    })
    if (!token.access_token || typeof token.expires_in !== 'number') throw new Error('Google did not return an access token.')
    return sendJson(res, 200, { accessToken: token.access_token, expiresIn: token.expires_in, email: session.email })
  } catch (error) {
    return sendJson(res, 401, { error: error instanceof Error ? error.message : 'Google Drive needs to reconnect.' }, {
      'Set-Cookie': cookie(req, SESSION_COOKIE, '', 0),
    })
  }
}

export async function handleRequest(req, res) {
  const url = new URL(req.url || '/', 'https://placeholder.local')
  const path = normalizePath(url.pathname)

  try {
    if (path === '/health') return sendJson(res, 200, { ok: true })
    if (path === '/google/start') return await handleStart(req, res, url)
    if (path === '/google/callback') return await handleCallback(req, res, url)
    if (path === '/session') {
      const session = sessionFromRequest(req)
      return sendJson(res, 200, { authenticated: Boolean(session), email: session?.email ?? null })
    }
    if (path === '/token') return await handleToken(req, res)
    if (path === '/collab-token') {
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed.' })
      const session = sessionFromRequest(req)
      if (!session) return sendJson(res, 401, { error: 'Please sign in again.' })
      return sendJson(res, 200, { token: createCollaborationToken(session.email) })
    }
    if (path === '/logout') {
      return sendJson(res, 200, { success: true }, {
        'Set-Cookie': [cookie(req, SESSION_COOKIE, '', 0), cookie(req, STATE_COOKIE, '', 0)],
      })
    }
    return sendJson(res, 404, { error: 'Not found.' })
  } catch (error) {
    return sendJson(res, 500, { error: error instanceof Error ? error.message : 'Auth server error.' })
  }
}

export function createServer() {
  return http.createServer((req, res) => {
    void handleRequest(req, res)
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 3000)
  createServer().listen(port, '127.0.0.1')
}
