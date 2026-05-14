import { useCallback, useState } from 'react'
import { getStoredSkaupatBearer, setStoredSkaupatBearer } from '../utils'

const AUTH_PANEL_OPEN_KEY = 'ruokatilaus-auth-panel-open'

function readPanelOpen(): boolean {
  try {
    const v = localStorage.getItem(AUTH_PANEL_OPEN_KEY)
    if (v === '0') return false
    if (v === '1') return true
  } catch {
    /* ignore */
  }
  return false
}

function writePanelOpen(open: boolean): void {
  try {
    localStorage.setItem(AUTH_PANEL_OPEN_KEY, open ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function SkaupatAuthPanel() {
  const [open, setOpen] = useState(readPanelOpen)
  const [draft, setDraft] = useState(() => getStoredSkaupatBearer() || '')
  const [flash, setFlash] = useState<string | null>(null)

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev
      writePanelOpen(next)
      return next
    })
  }, [])

  const save = () => {
    setStoredSkaupatBearer(draft.trim() || null)
    setDraft(getStoredSkaupatBearer() || '')
    setFlash('Tallennettu tähän selaimeen.')
    window.setTimeout(() => setFlash(null), 2500)
  }

  const clear = () => {
    setStoredSkaupatBearer(null)
    setDraft('')
    setFlash('Token poistettu.')
    window.setTimeout(() => setFlash(null), 2000)
  }

  const hasToken = Boolean(getStoredSkaupatBearer())

  return (
    <div className="auth-panel">
      <button
        type="button"
        className="auth-panel-toggle"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="skaupat-auth-panel-body"
        id="skaupat-auth-panel-heading"
      >
        <span className="auth-panel-toggle-label">Authorization (S-kauppa)</span>
        {hasToken && !open && <span className="auth-panel-badge">tallennettu</span>}
        <span className="auth-panel-chevron" aria-hidden>
          {open ? '▾' : '▸'}
        </span>
      </button>

      {open && (
        <div className="auth-panel-body" id="skaupat-auth-panel-body" role="region" aria-labelledby="skaupat-auth-panel-heading">
          <p className="auth-panel-hint">
            Liitä DevToolsista kopioitu Bearer-access token (koko <code>eyJ…</code> tai{' '}
            <code>Bearer eyJ…</code>). Tarvitaan mm. ostoslistan luontiin. Säilyy vain tässä selaimessa;
            ei mukana JSON-viennissä.
          </p>
          <textarea
            className="auth-panel-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Bearer-token…"
            rows={3}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            aria-label="S-kaupan authorization-token"
          />
          <div className="auth-panel-actions">
            <button type="button" className="auth-panel-btn primary" onClick={save}>
              Tallenna
            </button>
            <button type="button" className="auth-panel-btn" onClick={clear}>
              Tyhjennä
            </button>
          </div>
          {flash && <div className="auth-panel-flash">{flash}</div>}
        </div>
      )}
    </div>
  )
}
