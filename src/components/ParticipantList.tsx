import { useState, useEffect, useRef } from 'react'
import { Avatar } from './Avatar'
import { fmtPrice, pickColor, PARTICIPANT_COLORS } from '../utils'
import type { Participant, PerPersonTotals } from '../types'

type RowProps = {
  p: Participant
  editing: boolean
  setEditing: (v: boolean) => void
  onUpdate: (patch: Partial<Participant>) => void
  onDelete: () => void
  total: number
  canDelete: boolean
}

function ParticipantRow({ p, editing, setEditing, onUpdate, onDelete, total, canDelete }: RowProps) {
  const [showColors, setShowColors] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (editing && inputRef.current) inputRef.current.select() }, [editing])

  return (
    <div className={`participant ${editing ? 'editing' : ''}`}>
      <div onClick={() => setShowColors(!showColors)} style={{ cursor: 'pointer', position: 'relative' }}>
        <Avatar p={p} size={30} />
        {showColors && (
          <div className="popover" style={{ top: 36, left: 0, right: 'auto', minWidth: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="swatches">
              {PARTICIPANT_COLORS.map((c) => (
                <div
                  key={c}
                  className={`swatch ${p.color === c ? 'on' : ''}`}
                  style={{ background: c }}
                  onClick={() => { onUpdate({ color: c }); setShowColors(false) }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="participant-info" onClick={() => setEditing(true)}>
        {editing ? (
          <input
            ref={inputRef}
            className="participant-name-input"
            value={p.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditing(false) }}
          />
        ) : (
          <div className="participant-name">{p.name}</div>
        )}
        <div className="participant-total">{fmtPrice(total)}</div>
      </div>
      {canDelete && (
        <button className="participant-del" onClick={onDelete} title="Poista">
          ×
        </button>
      )}
    </div>
  )
}

type Props = {
  participants: Participant[]
  setParticipants: (ps: Participant[]) => void
  perPersonTotals: PerPersonTotals
  /** Yhteenvedon jako-osio: ei Porukka-otsikkoa, näytä osuuspalkit */
  withSplitBars?: boolean
}

export function ParticipantList({
  participants,
  setParticipants,
  perPersonTotals,
  withSplitBars = false,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)

  const maxAmount = withSplitBars
    ? Math.max(...participants.map((p) => perPersonTotals[p.id] || 0), 1)
    : 0

  const add = () => {
    const used = participants.map((p) => p.color)
    const np: Participant = {
      id: 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      name: 'Nimetön',
      color: pickColor(used),
    }
    setParticipants([...participants, np])
    setEditingId(np.id)
  }

  const update = (id: string, patch: Partial<Participant>) => {
    setParticipants(participants.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  const remove = (id: string) => {
    setParticipants(participants.filter((p) => p.id !== id))
  }

  return (
    <div>
      {!withSplitBars && <div className="eyebrow">Porukka</div>}
      <div className={withSplitBars ? 'participants participants--split-summary' : 'participants'}>
        {participants.map((p) => {
          const amt = perPersonTotals[p.id] || 0
          const pct = withSplitBars && maxAmount > 0 ? (amt / maxAmount) * 100 : 0
          const rowProps = {
            p,
            editing: editingId === p.id,
            setEditing: (v: boolean) => setEditingId(v ? p.id : null),
            onUpdate: (patch: Partial<Participant>) => update(p.id, patch),
            onDelete: () => remove(p.id),
            total: amt,
            canDelete: participants.length > 1,
          }
          if (!withSplitBars) {
            return <ParticipantRow key={p.id} {...rowProps} />
          }
          return (
            <div key={p.id} className="split-participant-block">
              <ParticipantRow {...rowProps} />
              <div className="split-bar-wrap">
                <div className="split-bar" style={{ width: pct + '%', background: p.color }} />
              </div>
            </div>
          )
        })}
        <button type="button" className="add-participant" onClick={add}>
          <span className="plus">+</span>
          <span>Lisää henkilö</span>
        </button>
      </div>
    </div>
  )
}
