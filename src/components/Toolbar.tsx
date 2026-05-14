import { useState } from 'react'

type Props = {
  onAdd: (url: string) => Promise<boolean>
  busy: boolean
  error: string | null
  clearError: () => void
  categories: string[]
  selectedCategory: string
  onSelectCategory: (c: string) => void
}

export function Toolbar({ onAdd, busy, error, clearError, categories, selectedCategory, onSelectCategory }: Props) {
  const [val, setVal] = useState('')

  const submit = async () => {
    if (!val.trim()) return
    const ok = await onAdd(val.trim())
    if (ok) setVal('')
  }

  return (
    <div className="toolbar">
      <div className="url-bar">
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          placeholder="Liitä S-kaupan tuotelinkki (esim. https://www.s-kaupat.fi/tuote/coop-omena-royal-gala/2003505600001)"
        />
        <button onClick={submit} disabled={busy || !val.trim()}>
          {busy ? (
            <><span className="spin" />Haetaan…</>
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
