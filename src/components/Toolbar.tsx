import { useState } from 'react'

type Props = {
  onAdd: (raw: string) => Promise<boolean>
  busy: boolean
  busyDetail?: string | null
  error: string | null
  clearError: () => void
  categories: string[]
  selectedCategory: string
  onSelectCategory: (c: string) => void
}

export function Toolbar({
  onAdd,
  busy,
  busyDetail,
  error,
  clearError,
  categories,
  selectedCategory,
  onSelectCategory,
}: Props) {
  const [val, setVal] = useState('')

  const submit = async () => {
    if (!val.trim()) return
    const ok = await onAdd(val.trim())
    if (ok) setVal('')
  }

  return (
    <div className="toolbar">
      <div className="url-bar">
        <textarea
          value={val}
          rows={2}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="Yksi tai useita S-kaupan tuotelinkkejä (yksi per rivi, tai pilkuilla / välilyönneillä erotettuna). Esim. https://www.s-kaupat.fi/tuote/…/EAN — Ctrl+Enter tai Cmd+Enter lisää."
        />
        <button onClick={submit} disabled={busy || !val.trim()}>
          {busy ? (
            <>
              <span className="spin" />
              {busyDetail ? `Haetaan ${busyDetail}…` : 'Haetaan…'}
            </>
          ) : (
            <>Lisää <span style={{ fontSize: 16 }}>+</span></>
          )}
        </button>
      </div>
      <div className="toolbar-cats">
        {categories.map((c) => (
          <button
            key={c}
            className={c === selectedCategory ? 'active' : ''}
            onClick={() => onSelectCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>
      {error && (
        <div className="toast err">
          <div>{error}</div>
          <button className="x" onClick={clearError}>×</button>
        </div>
      )}
    </div>
  )
}
