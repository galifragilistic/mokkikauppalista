import type { Express, Request, Response } from 'express'

const GQL_BASE = 'https://api.s-kaupat.fi'
const PAGE_BASE = 'https://www.s-kaupat.fi'

const STATIC_HEADERS = {
  Origin: 'https://www.s-kaupat.fi',
  Referer: 'https://www.s-kaupat.fi/',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:150.0) Gecko/20100101 Firefox/150.0',
  'Accept-Language': 'fi',
}

const FORWARDED_REQUEST_HEADERS = [
  'accept',
  'content-type',
  'x-client-name',
  'x-client-version',
] as const

const HOP_BY_HOP_RESPONSE_HEADERS = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
])

function buildHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = { ...STATIC_HEADERS }
  const cookies = process.env.SKAUPAT_COOKIES
  if (cookies) headers.Cookie = cookies
  // S-kaupat authenticates GraphQL via Authorization: Bearer <accessToken>.
  // The token comes from OAuth (voikukka.fi) and lives in the browser's
  // Apollo Client cache; copy it from a logged-in browser tab into
  // SKAUPAT_BEARER_TOKEN to enable authenticated mutations like
  // createShoppingList. Access tokens typically expire in ~1 hour.
  const bearer = process.env.SKAUPAT_BEARER_TOKEN
  if (bearer) headers.Authorization = `Bearer ${bearer.replace(/^Bearer\s+/i, '')}`
  for (const h of FORWARDED_REQUEST_HEADERS) {
    const v = req.get(h)
    if (v) headers[h] = v
  }
  return headers
}

function makeHandler(base: string, prefix: string) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const remainder = req.originalUrl.slice(prefix.length) || '/'
      const target = base + remainder

      const init: RequestInit = {
        method: req.method,
        headers: buildHeaders(req),
      }
      if (!['GET', 'HEAD'].includes(req.method)) {
        init.body =
          typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {})
      }

      const upstream = await fetch(target, init)
      const buf = Buffer.from(await upstream.arrayBuffer())

      res.status(upstream.status)
      upstream.headers.forEach((value, key) => {
        if (HOP_BY_HOP_RESPONSE_HEADERS.has(key.toLowerCase())) return
        res.setHeader(key, value)
      })
      res.send(buf)
    } catch (err) {
      console.error(`[proxy] ${req.method} ${req.originalUrl} failed:`, err)
      if (!res.headersSent) {
        res.status(502).json({ error: String(err) })
      }
    }
  }
}

export function mountProxy(app: Express): void {
  app.all('/api/skaupat-gql', makeHandler(GQL_BASE, '/api/skaupat-gql'))
  app.all('/api/skaupat-gql/*', makeHandler(GQL_BASE, '/api/skaupat-gql'))
  app.all('/api/skaupat-page', makeHandler(PAGE_BASE, '/api/skaupat-page'))
  app.all('/api/skaupat-page/*', makeHandler(PAGE_BASE, '/api/skaupat-page'))
}
