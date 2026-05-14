import { useState, useRef } from 'react'
import { Avatar } from './Avatar'
import { Qty } from './Qty'
import { AssignPopover } from './AssignPopover'
import { fmtPrice } from '../utils'
import type { Item, Participant } from '../types'

type Props = {
  item: Item
  participants: Participant[]
  allCategories: string[]
  onChange: (patch: Partial<Item>) => void
  onDelete: () => void
  onAddCategory: (name: string) => void
}

export function ProductRow({ item, participants, allCategories, onChange, onDelete, onAddCategory }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignRect, setAssignRect] = useState<DOMRect | null>(null)
  const assignRef = useRef<HTMLDivElement>(null)
  const rowTotal = (item.price || 0) * item.qty

  const assignedPeople = item.assignment.shared
    ? participants
    : participants.filter((p) => item.assignment.people.includes(p.id))

  return (
    <>
      <div className={`row ${expanded ? 'expanded' : ''}`} onClick={() => setExpanded(!expanded)}>
        <div className="drag-handle" title="Vedä järjestääksesi">⋮⋮</div>
        <div className={`thumb ${item.image ? '' : 'placeholder'}`}>
          {item.image ? (
            <img src={item.image} alt="" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
          ) : (
            <span>EAN</span>
          )}
        </div>
        <div className="product-info">
          <div className="product-name">{item.name}</div>
          <div className="product-meta">
            <a
              className="product-link"
              href={item.url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              {item.ean} ↗
            </a>
            {item.brand && (
              <>
                <span className="sep">·</span>
                <span>{item.brand}</span>
              </>
            )}
            {item.source === 'fallback' && (
              <>
                <span className="sep">·</span>
                <span style={{ color: 'var(--wood)' }}>aseta hinta ↓</span>
              </>
            )}
          </div>
        </div>

        <div onClick={(e) => e.stopPropagation()}>
          <Qty value={item.qty} onChange={(v) => onChange({ qty: v })} />
        </div>

        <div className="price">
          {item.source === 'fallback' && item.price == null ? (
            <input
              className="price-input"
              placeholder="0,00"
              onClick={(e) => { e.stopPropagation(); (e.target as HTMLInputElement).focus() }}
              onChange={(e) => {
                const n = parseFloat(e.target.value.replace(',', '.'))
                if (!isNaN(n)) onChange({ price: n })
              }}
            />
          ) : (
            <>
              <div className="price-row">{fmtPrice(rowTotal)}</div>
              <div className="price-unit">{fmtPrice(item.price)} / kpl</div>
            </>
          )}
        </div>

        <div
          ref={assignRef}
          onClick={(e) => {
            e.stopPropagation()
            if (!assignOpen) setAssignRect(assignRef.current?.getBoundingClientRect() ?? null)
            setAssignOpen(!assignOpen)
          }}
          className="assign"
        >
          {item.assignment.shared ? (
            <span className="shared-tag">Yhteinen</span>
          ) : (
            <>
              {assignedPeople.slice(0, 4).map((p) => (
                <Avatar key={p.id} p={p} size={24} />
              ))}
              {assignedPeople.length > 4 && (
                <span className="more">+{assignedPeople.length - 4}</span>
              )}
              {assignedPeople.length === 0 && (
                <span className="muted" style={{ fontSize: 12, padding: '0 8px' }}>
                  — valitse —
                </span>
              )}
            </>
          )}
          {assignOpen && assignRect && (
            <AssignPopover
              assignment={item.assignment}
              participants={participants}
              onChange={(a) => onChange({ assignment: a })}
              onClose={() => setAssignOpen(false)}
              anchorRect={assignRect}
            />
          )}
        </div>

        <div className="row-actions">
          <button
            className={item.comment ? 'has-comment' : ''}
            title={item.comment || 'Lisää kommentti'}
            onClick={(e) => { e.stopPropagation(); setExpanded(true) }}
          >
            {item.comment ? '◉' : '○'}
          </button>
          <button
            className="del"
            title="Poista"
            onClick={(e) => { e.stopPropagation(); onDelete() }}
          >
            ×
          </button>
        </div>

        {assignOpen && (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 19 }}
            onClick={(e) => { e.stopPropagation(); setAssignOpen(false) }}
          />
        )}
      </div>

      {expanded && (
        <div className="row-expand" onClick={(e) => e.stopPropagation()}>
          <div>
            <label>Kommentti</label>
            <textarea
              value={item.comment || ''}
              placeholder="esim. mieluummin punainen variantti, tai onko korvaaja ok jos loppu…"
              onChange={(e) => onChange({ comment: e.target.value })}
            />
          </div>
          <div>
            <label>Kategoria</label>
            <div className="cat-picker">
              {allCategories.map((c) => (
                <button
                  key={c}
                  className={item.category === c ? 'active' : ''}
                  onClick={() => onChange({ category: c })}
                >
                  {c}
                </button>
              ))}
              <button
                className="new-cat"
                onClick={() => {
                  const n = prompt('Uuden kategorian nimi:')
                  if (n && n.trim()) {
                    onAddCategory(n.trim())
                    onChange({ category: n.trim() })
                  }
                }}
              >
                + Uusi kategoria
              </button>
            </div>
          </div>
          {item.source === 'fallback' && (
            <div className="toast info" style={{ maxWidth: 560, marginTop: 4 }}>
              <div>
                <strong>Hintaa ei voitu hakea automaattisesti.</strong> Selain estää suorat kutsut
                S-kaupan rajapintaan (CORS). Voit syöttää hinnan käsin tai vahvistaa lopullisen
                hinnan S-kaupan sivuilla tilausta tehdessäsi.
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
