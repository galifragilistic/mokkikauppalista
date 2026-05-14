import { useState } from 'react'
import { ProductRow } from './ProductRow'
import { fmtPrice } from '../utils'
import type { Item, Participant } from '../types'

type Props = {
  name: string
  items: Item[]
  participants: Participant[]
  allCategories: string[]
  isCustom: boolean
  onItemChange: (id: string, patch: Partial<Item>) => void
  onItemDelete: (id: string) => void
  onAddCategory: (name: string) => void
  onRenameCategory: (newName: string) => void
  onDeleteCategory: () => void
}

export function CategoryBlock({
  name,
  items,
  participants,
  allCategories,
  isCustom,
  onItemChange,
  onItemDelete,
  onAddCategory,
  onRenameCategory,
  onDeleteCategory,
}: Props) {
  const [editing, setEditing] = useState(false)
  const total = items.reduce((s, it) => s + (it.price || 0) * it.qty, 0)
  const count = items.reduce((s, it) => s + it.qty, 0)
  const monogram = name ? name.charAt(0).toUpperCase() : '?'

  return (
    <div className="category">
      <div className="cat-head">
        <div className="cat-icon">{monogram}</div>
        <h3>
          {editing ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => onRenameCategory(e.target.value)}
              onBlur={() => setEditing(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') setEditing(false)
              }}
            />
          ) : (
            <span
              onClick={() => isCustom && setEditing(true)}
              style={{ cursor: isCustom ? 'text' : 'default' }}
            >
              {name}
            </span>
          )}
        </h3>
        <div className="cat-meta">
          <span>{count} kpl</span>
          <span className="cat-total">{fmtPrice(total)}</span>
        </div>
        {isCustom && (
          <button
            className="cat-del"
            onClick={onDeleteCategory}
            title="Poista kategoria (tuotteet → 'Sekalaiset')"
          >
            ×
          </button>
        )}
      </div>
      <div className="row head">
        <div />
        <div>Tuote</div>
        <div style={{ textAlign: 'center' }}>Määrä</div>
        <div style={{ textAlign: 'right' }}>Hinta</div>
        <div>Kuka</div>
        <div />
      </div>
      {items.map((it) => (
        <ProductRow
          key={it.id}
          item={it}
          participants={participants}
          allCategories={allCategories}
          onChange={(patch) => onItemChange(it.id, patch)}
          onDelete={() => onItemDelete(it.id)}
          onAddCategory={onAddCategory}
        />
      ))}
    </div>
  )
}
