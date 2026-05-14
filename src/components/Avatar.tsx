import { getInitials } from '../utils'
import type { Participant } from '../types'

type Props = {
  p: Participant | { id: 'shared' }
  size?: number
}

export function Avatar({ p, size = 30 }: Props) {
  if (!p || p.id === 'shared') {
    return (
      <div
        className="avatar shared"
        style={{ width: size, height: size, fontSize: size * 0.36 }}
        title="Yhteinen"
      >
        ∞
      </div>
    )
  }
  const participant = p as Participant
  return (
    <div
      className="avatar"
      style={{ background: participant.color, width: size, height: size, fontSize: size * 0.4 }}
      title={participant.name}
    >
      {getInitials(participant.name)}
    </div>
  )
}
