import express from 'express'
import path from 'node:path'
import fs from 'node:fs'
import open from 'open'
import { mountProxy } from './proxy'

function loadEnvFile(file: string): void {
  if (!fs.existsSync(file)) return
  const txt = fs.readFileSync(file, 'utf8')
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

const projectRoot = path.resolve(__dirname, '../..')
loadEnvFile(path.join(projectRoot, '.env.local'))

const app = express()
app.use(express.json({ limit: '2mb' }))
app.use(express.text({ limit: '2mb', type: ['text/*'] }))

mountProxy(app)

const distDir = path.join(projectRoot, 'dist')
const distExists = fs.existsSync(path.join(distDir, 'index.html'))

if (distExists) {
  app.use(express.static(distDir))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })
} else {
  app.get('/', (_req, res) => {
    res
      .status(503)
      .type('text/plain')
      .send(
        'Frontend ei ole rakennettu. Aja "npm run build" ennen "npm start" -komentoa,\n' +
          'tai käytä "npm run dev" kehityspalvelimen kanssa (Vite porttiin 5173).\n',
      )
  })
}

const PORT = Number(process.env.PORT ?? 5179)
const HOST = '127.0.0.1'

app.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}`
  console.log(`[ruokatilaus] Palvelin käynnissä: ${url}`)
  if (!distExists) {
    console.log(
      '[ruokatilaus] Vinkki: aja "npm run build" niin sovellus tarjoillaan tästä osoitteesta.',
    )
  }

  const shouldOpen = distExists && !process.env.NO_OPEN
  if (shouldOpen) {
    open(url).catch((err) => {
      console.warn('[ruokatilaus] Selaimen avaaminen epäonnistui:', err)
    })
  }
})
