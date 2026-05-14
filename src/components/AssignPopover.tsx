import { createPortal } from 'react-dom'
import { Avatar } from './Avatar'
import type { Assignment, Participant } from '../types'

type Props = {
  assignment: Assignment
  participants: Participant[]
  onChange: (a: Assignment) => void
  onClose: () => void
  anchorRect: DOMRect
}

export function AssignPopover({ assignment, participants, onChange, anchorRect }: Props) {
  const isShared = assignment.shared
  const ids = assignment.people || []

  const toggleShared = () => onChange({ shared: !isShared, people: !isShared ? [] : ids })

  const toggle = (id: string) => {
    if (isShared) {
      onChange({ shared: false, people: [id] })
    } else {
      const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
      onChange({ shared: false, people: next.length ? next : [id] })
    }
  }

  const style: React.CSSProperties = {
    position: 'fixed',
    top: anchorRect.bottom + 6,
    right: window.innerWidth - anchorRect.right,
    left: 'auto',
  }

  return createPortal(
    <div className="popover" style={style} onClick={(e) => e.stopPropagation()}>
      <div className="popover-h">Kuka maksaa?</div>
      <div className={`popover-item ${isShared ? 'on' : ''}`} onClick={toggleShared}>
        <div className="check">{isShared ? '✓' : ''}</div>
        <Avatar p={{ id: 'shared' }} size={22} />
        <div className="label">
          <strong>Yhteinen</strong>{' '}
          <span className="muted" style={{ fontSize: 11 }}>
            — jaetaan tasan
          </span>
        </div>
      </div>
      <div className="popover-divider" />
      {participants.map((p) => {
        const on = !isShared && ids.includes(p.id)
        return (
          <div key={p.id} className={`popover-item ${on ? 'on' : ''}`} onClick={() => toggle(p.id)}>
            <div className="check">{on ? '✓' : ''}</div>
            <Avatar p={p} size={22} />
            <div className="label">{p.name}</div>
          </div>
        )
      })}
    </div>,
    document.body
  )
}
