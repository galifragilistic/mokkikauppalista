import {
  RUOKATILAUS_EXPORT_FORMAT,
  type AddressSuggestion,
  type AppState,
  type Delivery,
  type Item,
  type Participant,
  type RuokatilausExportFileV1,
  type SlotsInPickupPoint,
} from './types'

// ---- URL parsing ----
export function parseProductUrl(input: string): { ean: string; slug: string } | null {
  if (!input) return null
  const s = String(input).trim()
  if (/^\d{8,14}$/.test(s)) return { ean: s, slug: '' }
  const m = s.match(/s-kaupat\.fi\/tuote\/([^/?#]+)\/(\d{8,14})/i)
  if (m) return { slug: m[1], ean: m[2] }
  const m2 = s.match(/\/(\d{8,14})(?:\?|#|$)/)
  if (m2) {
    const segs = s.split(/[/?#]/).filter(Boolean)
    const ix = segs.indexOf(m2[1])
    const slug = ix > 0 ? segs[ix - 1] : ''
    return { slug, ean: m2[1] }
  }
  return null
}

/** Poimii kelvolliset tuotelinkit / EAN-rivit tekstistä (rivinvaihdot, välilyönnit, pilkut). */
export function extractProductUrlsFromText(input: string): string[] {
  const raw = String(input).trim()
  if (!raw) return []

  const embeddedRe = /https?:\/\/(?:www\.)?s-kaupat\.fi\/tuote\/[^/\s,;]+\/\d{8,14}/gi

  const out: string[] = []
  const pushValid = (fragment: string) => {
    const t = fragment.trim()
    if (!t) return
    if (parseProductUrl(t)) out.push(t)
  }

  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean)

  if (lines.length > 1) {
    for (const line of lines) {
      const embedded = line.match(embeddedRe)
      if (embedded?.length) {
        for (const m of embedded) pushValid(m)
      } else {
        pushValid(line)
      }
    }
    return out
  }

  const block = lines[0] ?? raw
  const embedded = block.match(embeddedRe)
  if (embedded?.length) {
    for (const m of embedded) pushValid(m)
    if (out.length) return out
  }

  for (const part of block.split(/[\s,;]+/)) {
    pushValid(part)
  }
  return out
}

export function slugToName(slug: string): string {
  if (!slug) return 'Tuntematon tuote'
  return slug
    .split('-')
    .map((tok, i) => {
      if (!tok) return tok
      if (/^\d+$/.test(tok)) return tok
      const lower = tok.toLowerCase()
      if (i > 0 && ['ja', 'tai', 'sekä', 'of', 'de', 'la', 'le'].includes(lower)) return lower
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(' ')
    .replace(/(\d+)\s+(\d+)\s+L\b/i, '$1,$2 l')
    .replace(/(\d+)\s+L\b/i, '$1 l')
    .replace(/(\d+)\s+G\b/i, '$1 g')
    .replace(/(\d+)\s+Kg\b/i, '$1 kg')
    .replace(/(\d+)\s+Ml\b/i, '$1 ml')
    .replace(/(\d+)\s+Cl\b/i, '$1 cl')
    .replace(/(\d+)\s+Kpl\b/i, '$1 kpl')
    .replace(/(\d+)\s+Pkt\b/i, '$1 pkt')
    .replace(/(\d+)\s+Prk\b/i, '$1 prk')
    .replace(/(\d+)\s+Plo\b/i, '$1 plo')
    .replace(/\bPullo\b/, 'pullo')
    .replace(/\bTölkki\b/i, 'tölkki')
}

// ---- HTML scraping ----
// Fetches product page through Vite dev proxy (which avoids CORS).
// In production a server-side proxy at /api/skaupat-page is needed.

async function fetchProductFromPage(productUrl: string, ean: string): Promise<{
  ean: string; name: string; brand: null; unit: null
  price: number | null; image: string | null; source: 'api'
}> {
  const path = productUrl.replace(/^https?:\/\/(?:www\.)?s-kaupat\.fi/, '')
  const res = await fetch('/api/skaupat-page' + path, { headers: { Accept: 'text/html' } })
  if (!res.ok) throw new Error('Sivu ' + res.status)

  const html = await res.text()
  const doc = new DOMParser().parseFromString(html, 'text/html')

  const name = doc.querySelector('[data-test-id="product-name"]')?.textContent?.trim()
  if (!name) throw new Error('Tuotteen nimeä ei löydy sivulta')

  const priceText = doc.querySelector('[data-test-id="display-price"]')?.textContent?.trim() ?? null
  const priceNum = priceText ? parseFloat(priceText.replace(',', '.').replace(/[^\d.]/g, '')) : null
  const price = priceNum != null && !isNaN(priceNum) ? priceNum : null

  const image = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? null

  return { ean, name, brand: null, unit: null, price, image, source: 'api' }
}

type ResolvedProduct = {
  ean: string
  name: string
  brand: string | null
  unit: string | null
  price: number | null
  image: string | null
  slug: string
  url: string
  source: 'api' | 'fallback'
}

export async function resolveProductWithFallback(url: string): Promise<ResolvedProduct> {
  const parsed = parseProductUrl(url)
  if (!parsed) throw new Error('Tunnistamaton URL — odotetaan s-kaupat.fi/tuote/-linkkiä')
  const { ean, slug } = parsed

  const productUrl = url.includes('s-kaupat.fi')
    ? url
    : `https://www.s-kaupat.fi/tuote/${slug || ean}/${ean}`

  try {
    const p = await fetchProductFromPage(productUrl, ean)
    return { ...p, slug, url: productUrl, source: 'api' }
  } catch {
    return {
      ean,
      name: slugToName(slug),
      brand: null,
      unit: null,
      price: null,
      image: null,
      slug,
      url: productUrl,
      source: 'fallback',
    }
  }
}

// ---- Formatting ----
export function fmtPrice(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—'
  return n.toFixed(2).replace('.', ',') + ' €'
}

export function fmtPriceParts(n: number | null | undefined): { whole: string; cents: string; cur: string } {
  if (n == null || isNaN(n)) return { whole: '—', cents: '', cur: '' }
  const s = n.toFixed(2)
  const [w, c] = s.split('.')
  return { whole: w, cents: ',' + c, cur: '€' }
}

// ---- Participant colors ----
export const PARTICIPANT_COLORS = [
  'oklch(58% 0.13 25)',
  'oklch(56% 0.115 55)',
  'oklch(58% 0.12 80)',
  'oklch(52% 0.1 140)',
  'oklch(50% 0.1 200)',
  'oklch(48% 0.12 280)',
  'oklch(55% 0.11 340)',
  'oklch(45% 0.08 110)',
  'oklch(50% 0.12 40)',
  'oklch(48% 0.09 240)',
]

export function pickColor(used: string[]): string {
  for (const c of PARTICIPANT_COLORS) if (!used.includes(c)) return c
  return PARTICIPANT_COLORS[Math.floor(Math.random() * PARTICIPANT_COLORS.length)]
}

export function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// ---- Storage ----
const STORAGE_KEY = 'ruokatilaus-v1'

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function saveState(state: object) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore quota / private mode */
  }
}

// ---- Vie / Tuo (JSON) ----

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function reqStr(obj: Record<string, unknown>, key: string, ctx: string): string {
  const v = obj[key]
  if (typeof v === 'string' && v.length > 0) return v
  throw new Error(`Tuonti (${ctx}): kenttä "${key}" puuttuu tai on tyhjä`)
}

function optStr(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'string') return v
  return null
}

function optNum(v: unknown): number | null {
  if (typeof v !== 'number' || isNaN(v)) return null
  return v
}

function parseParticipant(raw: unknown, i: number): Participant {
  if (!isRecord(raw)) throw new Error(`Tuonti: osallistuja ${i + 1} ei ole objekti`)
  return {
    id: reqStr(raw, 'id', `osallistuja ${i + 1}`),
    name: reqStr(raw, 'name', `osallistuja ${i + 1}`),
    color: reqStr(raw, 'color', `osallistuja ${i + 1}`),
  }
}

function parseEan(v: unknown, ctx: string): string {
  if (typeof v === 'number' && !isNaN(v)) return String(Math.trunc(v))
  if (typeof v === 'string' && v.trim()) return v.trim()
  throw new Error(`Tuonti (${ctx}): kenttä "ean" puuttuu tai on virheellinen`)
}

function parseItem(raw: unknown, i: number): Item {
  if (!isRecord(raw)) throw new Error(`Tuonti: tuote ${i + 1} ei ole objekti`)
  let assignment: Item['assignment'] = { shared: true, people: [] }
  if (isRecord(raw.assignment)) {
    const a = raw.assignment
    assignment = {
      shared: typeof a.shared === 'boolean' ? a.shared : true,
      people: Array.isArray(a.people)
        ? a.people.filter((id): id is string => typeof id === 'string')
        : [],
    }
  }
  const src = raw.source === 'api' || raw.source === 'fallback' ? raw.source : 'fallback'
  const qty = typeof raw.qty === 'number' && raw.qty >= 1 && !isNaN(raw.qty) ? Math.floor(raw.qty) : 1
  const name =
    typeof raw.name === 'string' && raw.name.trim()
      ? raw.name.trim()
      : reqStr(raw, 'name', `tuote ${i + 1}`)
  return {
    id: reqStr(raw, 'id', `tuote ${i + 1}`),
    ean: parseEan(raw.ean, `tuote ${i + 1}`),
    name,
    brand: optStr(raw.brand),
    unit: optStr(raw.unit),
    price: optNum(raw.price),
    image: optStr(raw.image),
    url: typeof raw.url === 'string' ? raw.url : '',
    slug: typeof raw.slug === 'string' ? raw.slug : '',
    source: src,
    qty,
    category: typeof raw.category === 'string' && raw.category ? raw.category : 'Sekalaiset',
    comment: typeof raw.comment === 'string' ? raw.comment : '',
    assignment,
  }
}

function parseDelivery(raw: unknown): Delivery {
  if (!isRecord(raw) || typeof raw.date !== 'string' || !raw.date.trim()) {
    return { date: new Date().toISOString().slice(0, 10) }
  }
  return { date: raw.date.trim().slice(0, 10) }
}

/** Lukee Vie-toiminnon tai yhteensopivan JSON-tiedoston ja palauttaa AppState. */
export function parseImportedState(jsonText: string): AppState {
  let root: unknown
  try {
    root = JSON.parse(jsonText) as unknown
  } catch {
    throw new Error('Tuonti: tiedosto ei ole kelvollista JSONia')
  }
  if (!isRecord(root)) throw new Error('Tuonti: juuren pitää olla JSON-objekti')

  let payload: Record<string, unknown>
  if (root.format === RUOKATILAUS_EXPORT_FORMAT && root.version === 1 && isRecord(root.data)) {
    payload = root.data
  } else if (Array.isArray(root.participants) && Array.isArray(root.items)) {
    payload = root
  } else {
    throw new Error(
      'Tuonti: tunnistamaton muoto. Käytä tästä sovelluksesta tallennettua JSON-tiedostoa.',
    )
  }

  if (!Array.isArray(payload.participants) || payload.participants.length === 0) {
    throw new Error('Tuonti: vähintään yksi osallistuja (participants) vaaditaan')
  }
  if (!Array.isArray(payload.items)) {
    throw new Error('Tuonti: tuotelista (items) puuttuu tai ei ole taulukko')
  }

  const participants = payload.participants.map(parseParticipant)
  const items = payload.items.map(parseItem)

  let categories: string[]
  if (Array.isArray(payload.categories) && payload.categories.length > 0) {
    categories = payload.categories.filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
  } else {
    categories = [...new Set(items.map((it) => it.category))]
  }
  if (categories.length === 0) categories = ['Sekalaiset']

  const delivery = parseDelivery(payload.delivery)

  return { participants, items, categories, delivery }
}

export function buildExportFile(state: AppState): RuokatilausExportFileV1 {
  return {
    format: RUOKATILAUS_EXPORT_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    data: state,
  }
}

// ---- Per-person totals ----
export function computePerPersonTotals(
  items: Item[],
  participants: Participant[]
): Record<string, number> {
  const totals: Record<string, number> = Object.fromEntries(participants.map((p) => [p.id, 0]))
  for (const it of items) {
    const cost = (it.price || 0) * it.qty
    if (it.assignment.shared) {
      const share = cost / Math.max(participants.length, 1)
      for (const p of participants) totals[p.id] += share
    } else {
      const ids = it.assignment.people.filter((id) => totals[id] !== undefined)
      if (ids.length > 0) {
        const share = cost / ids.length
        for (const id of ids) totals[id] += share
      }
    }
  }
  return totals
}

// ---- S-kaupat API ----
// All API calls go through the Vite dev proxy (/api/skaupat-gql/ → https://api.s-kaupat.fi/)
// to avoid CORS. The proxy adds Origin/Referer/User-Agent server-side.
const SKAUPAT_API = '/api/skaupat-gql/'
const GQL_HEADERS = {
  'content-type': 'application/json',
  'x-client-name': 'skaupat-web',
  'x-client-version': 'production-701c6d3ae099966af39189decca0f7754d77f82c',
}

const SKAUPAT_BEARER_STORAGE_KEY = 'ruokatilaus-skaupat-bearer-v1'

/** OAuth access token ilman "Bearer "-etuliitettä; ei kuulu JSON-vientiin. */
export function getStoredSkaupatBearer(): string | null {
  try {
    const raw = localStorage.getItem(SKAUPAT_BEARER_STORAGE_KEY)
    if (!raw?.trim()) return null
    return raw.trim().replace(/^Bearer\s+/i, '')
  } catch {
    return null
  }
}

export function setStoredSkaupatBearer(token: string | null): void {
  try {
    if (token == null || !String(token).trim()) {
      localStorage.removeItem(SKAUPAT_BEARER_STORAGE_KEY)
      return
    }
    const cleaned = String(token).trim().replace(/^Bearer\s+/i, '')
    if (cleaned) localStorage.setItem(SKAUPAT_BEARER_STORAGE_KEY, cleaned)
    else localStorage.removeItem(SKAUPAT_BEARER_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

function skaupatGqlHeaders(): Record<string, string> {
  const headers: Record<string, string> = { ...GQL_HEADERS }
  const t = getStoredSkaupatBearer()
  if (t) headers.Authorization = `Bearer ${t}`
  return headers
}

export async function searchAddresses(query: string): Promise<AddressSuggestion[]> {
  if (!query.trim()) return []
  const variables = { query, searchContext: 'DELIVERY_METHOD_SELECTION' }
  const extensions = { persistedQuery: { version: 1, sha256Hash: 'd212244e765be9640d8125490eb9ed0ca7a558e0247768b7b3efc4fea9348ea7' } }
  const url = SKAUPAT_API + '?operationName=GetAddressAutosuggestions' +
    '&variables=' + encodeURIComponent(JSON.stringify(variables)) +
    '&extensions=' + encodeURIComponent(JSON.stringify(extensions))
  const res = await fetch(url, { headers: skaupatGqlHeaders() })
  if (!res.ok) throw new Error('Osoitehaku epäonnistui: ' + res.status)
  const j = await res.json()
  return j.data?.addressAutosuggest ?? []
}

export async function fetchPickupSlots(lat: number, lng: number, date: string): Promise<SlotsInPickupPoint[]> {
  const variables = { startDate: date, endDate: date, location: { latitude: lat, longitude: lng }, limit: 20 }
  const extensions = { persistedQuery: { version: 1, sha256Hash: '6da249b0fd87c05275a239ed490976c851d7aff90ead0f3a3978e8283f21252d' } }
  const url = SKAUPAT_API + '?operationName=remotePickupSlots' +
    '&variables=' + encodeURIComponent(JSON.stringify(variables)) +
    '&extensions=' + encodeURIComponent(JSON.stringify(extensions))
  const res = await fetch(url, { headers: skaupatGqlHeaders() })
  if (!res.ok) throw new Error('Aikaslottihaku epäonnistui: ' + res.status)
  const j = await res.json()
  return j.data?.pickupSlotsForCoordinates?.slotsInPickupPoints ?? []
}

export type CartValidationResult = {
  isOrderingPossible: boolean
  unavailable: Array<{ ean: string; name: string }>
}

export type CartSubmitParams = {
  availabilityDate: string
  storeId: string
  areaId: string
  slotId: string
}

export async function submitCart(items: Item[], params: CartSubmitParams): Promise<CartValidationResult> {
  const { availabilityDate, storeId, areaId, slotId } = params
  const query = `query RemoteGetValidateCart(
    $partialCartItems: [PartialCartItemInput!]!
    $storeId: ID!
    $availabilityDate: String
    $slotId: ID
    $areaId: ID
  ) {
    validateCart(
      deliveryDate: $availabilityDate
      storeId: $storeId
      partialCartItems: $partialCartItems
      slotId: $slotId
      areaId: $areaId
    ) {
      isOrderingPossible
      cartValidationItems {
        ean
        validationError { __typename }
      }
    }
  }`

  const res = await fetch(SKAUPAT_API, {
    method: 'POST',
    headers: skaupatGqlHeaders(),
    body: JSON.stringify({
      operationName: 'RemoteGetValidateCart',
      variables: {
        availabilityDate,
        storeId,
        areaId,
        slotId,
        partialCartItems: items.map((it) => ({ ean: it.ean, itemCount: String(it.qty) })),
      },
      query,
    }),
  })
  if (!res.ok) throw new Error('API ' + res.status)
  const j = await res.json()
  if (j.errors) throw new Error(j.errors[0]?.message || 'GraphQL error')

  const validationItems: Array<{ ean: string; validationError: { __typename: string } | null }> =
    j.data?.validateCart?.cartValidationItems ?? []

  const unavailable = validationItems
    .filter((ci) => ci.validationError !== null)
    .map((ci) => ({
      ean: ci.ean,
      name: items.find((it) => it.ean === ci.ean)?.name ?? ci.ean,
    }))

  return {
    isOrderingPossible: j.data?.validateCart?.isOrderingPossible ?? false,
    unavailable,
  }
}

// ---- Server-side shopping list (Ostoslistat) ----
// S-kaupat does not expose a server-side cart mutation: the cart is Apollo
// Client local state in the browser. The closest authenticated automation is
// to create a shopping list ("ostoslista") with all items and open its page
// where the user clicks a single button to copy the list into the cart.
//
// Requires an authenticated OAuth access token (S-kaupat uses
// `Authorization: Bearer <token>`, not cookies). Liitä token sovelluksen
// kenttään (localStorage) tai aseta SKAUPAT_BEARER_TOKEN palvelimen .env.localiin;
// proxy välittää asiakkaan Authorization-headerin eteenpäin ensisijaisesti.

export type CreatedShoppingList = { id: string; name: string }

export type CreateShoppingListParams = {
  name: string
  items: Item[]
}

export async function createShoppingListWithProducts(
  params: CreateShoppingListParams
): Promise<CreatedShoppingList> {
  const { name, items } = params

  const query = `mutation RemoteCreateUserListWithProducts(
    $name: String!
    $items: [ShoppingListItemInput!]!
  ) {
    createShoppingList(name: $name, items: $items) {
      id
      name
    }
  }`

  const res = await fetch(SKAUPAT_API, {
    method: 'POST',
    headers: skaupatGqlHeaders(),
    body: JSON.stringify({
      operationName: 'RemoteCreateUserListWithProducts',
      variables: {
        name,
        items: items.map((it) => ({
          sokId: it.ean,
          ean: it.ean,
          quantity: it.qty,
          name: it.name,
          isReplaceable: true,
        })),
      },
      query,
    }),
  })

  const authHint =
    'Kirjaudu sisään s-kaupat.fi:ssä, kopioi DevToolsissa verkko-pyynnön Authorization: Bearer … -token ja liitä se sovelluksen authorization-kenttään (tai aseta SKAUPAT_BEARER_TOKEN palvelimen .env.localiin). Token vanhenee tyypillisesti noin tunnissa.'

  if (res.status === 401 || res.status === 403) {
    throw new Error('Tunnistautuminen S-kauppaan epäonnistui. ' + authHint)
  }
  if (!res.ok) {
    throw new Error('S-kaupan API palautti ' + res.status)
  }

  const j = await res.json()
  if (j.errors) {
    const msg: string = j.errors[0]?.message || 'GraphQL error'
    if (/auth|unauth|login|kirjau|forbidd|denied|token/i.test(msg)) {
      throw new Error('Tunnistautuminen S-kauppaan epäonnistui. ' + authHint + ' (' + msg + ')')
    }
    throw new Error(msg)
  }

  const list = j.data?.createShoppingList
  if (!list?.id) {
    throw new Error('Listan luonti epäonnistui — palvelin ei palauttanut listan id:tä')
  }
  return { id: String(list.id), name: String(list.name ?? name) }
}

// ---- Cart text ----
export function buildCartText(items: Item[], byCategory: Record<string, Item[]>, total: number): string {
  const lines = ['# Ruokatilaus — kopioi s-kaupat.fi:n ostoskoriin', '']
  for (const cat of Object.keys(byCategory)) {
    lines.push(`## ${cat}`)
    for (const it of byCategory[cat]) {
      lines.push(`- ${it.qty} × ${it.name}  (EAN ${it.ean})  ${it.url}`)
    }
    lines.push('')
  }
  lines.push(`Yhteensä: ${fmtPrice(total)} · ${items.reduce((s, it) => s + it.qty, 0)} tuotetta`)
  return lines.join('\n')
}
