import { createHash, randomBytes } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import { shell } from 'electron'
import log from './logger'
import { setUser, type FridayUser } from './store'

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const SCOPES = ['openid', 'email', 'profile']
const TIMEOUT_MS = 5 * 60 * 1000
const LOGIN_LOG_ENDPOINT = 'https://friday.feynmanpi.com/api/auth/log'
const LOGIN_LOG_TIMEOUT_MS = 8 * 1000

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodeIdToken(idToken: string): Record<string, unknown> {
  const payload = idToken.split('.')[1] ?? ''
  const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(
    'utf8'
  )
  return JSON.parse(json)
}

function resultPage(ok: boolean): string {
  const title = ok ? 'You’re signed in' : 'Sign-in failed'
  const body = ok
    ? 'You can close this tab and return to Friday.'
    : 'Please return to Friday and try again.'
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>html{color-scheme:dark}body{margin:0;height:100vh;display:flex;flex-direction:column;
align-items:center;justify-content:center;gap:.5rem;background:#0a0a0a;color:#ededed;
font:400 16px/1.5 -apple-system,Segoe UI,Roboto,sans-serif}h1{font-weight:500;font-size:1.25rem;margin:0}
p{margin:0;color:#a1a1a1;font-size:.9rem}</style></head>
<body><h1>${title}</h1><p>${body}</p></body></html>`
}

let activeServer: Server | null = null

function listenLoopback(): Promise<{ server: Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (addr && typeof addr === 'object') resolve({ server, port: addr.port })
      else reject(new Error('Failed to bind the loopback sign-in server.'))
    })
  })
}

function waitForCallback(server: Server): Promise<{ code: string; returnedState: string | null }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      server.removeAllListeners('request')
      reject(new Error('Timed out waiting for Google sign-in.'))
    }, TIMEOUT_MS)
    server.on('request', (req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      if (!url.searchParams.has('code') && !url.searchParams.has('error')) {
        res.writeHead(204).end()
        return
      }
      clearTimeout(timer)
      const error = url.searchParams.get('error')
      const code = url.searchParams.get('code')
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(resultPage(!error && !!code))
      if (error) return reject(new Error(`Google sign-in was cancelled (${error}).`))
      if (!code) return reject(new Error('No authorization code returned by Google.'))
      resolve({ code, returnedState: url.searchParams.get('state') })
    })
  })
}

async function exchangeCode(
  code: string,
  verifier: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
): Promise<{ user: FridayUser; idToken: string }> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier
    })
  })
  if (!res.ok) {
    throw new Error(`Token exchange failed (${res.status}): ${await res.text()}`)
  }
  const data = (await res.json()) as { id_token?: string }
  if (!data.id_token) throw new Error('Google did not return an id_token.')
  const claims = decodeIdToken(data.id_token)
  const user: FridayUser = {
    id: String(claims.sub ?? ''),
    email: String(claims.email ?? ''),
    name: String(claims.name ?? claims.email ?? 'there'),
    picture: claims.picture ? String(claims.picture) : undefined
  }
  return { user, idToken: data.id_token }
}

async function logLoginToServer(idToken: string): Promise<void> {
  try {
    const res = await fetch(LOGIN_LOG_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
      signal: AbortSignal.timeout(LOGIN_LOG_TIMEOUT_MS)
    })
    if (!res.ok) {
      log.warn(`[auth] login log returned ${res.status}: ${await res.text().catch(() => '')}`)
    }
  } catch (err) {
    log.warn(`[auth] login log failed: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export async function signInWithGoogle(): Promise<FridayUser> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error(
      'Google OAuth is not configured. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in .env.local.'
    )
  }

  const verifier = base64url(randomBytes(32))
  const challenge = base64url(createHash('sha256').update(verifier).digest())
  const state = base64url(randomBytes(16))

  if (activeServer) {
    try {
      activeServer.close()
    } catch {
      /* ignore */
    }
    activeServer = null
  }

  const { server, port } = await listenLoopback()
  activeServer = server
  const redirectUri = `http://127.0.0.1:${port}`

  try {
    const authUrl = `${AUTH_ENDPOINT}?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES.join(' '),
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state,
      prompt: 'select_account'
    })}`
    await shell.openExternal(authUrl)
    const { code, returnedState } = await waitForCallback(server)
    if (returnedState !== state) throw new Error('OAuth state mismatch — aborting sign-in.')
    const { user, idToken } = await exchangeCode(code, verifier, redirectUri, clientId, clientSecret)
    setUser(user)
    log.info(`[auth] signed in as ${user.email}`)
    void logLoginToServer(idToken)
    return user
  } finally {
    try {
      server.close()
    } catch {
      /* ignore */
    }
    if (activeServer === server) activeServer = null
  }
}
