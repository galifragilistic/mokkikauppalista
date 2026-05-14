import { ParticipantList } from './ParticipantList'
import { SkaupatAuthPanel } from './SkaupatAuthPanel'
import { fmtPrice, fmtPriceParts } from '../utils'
import type { Item, Participant, PerPersonTotals } from '../types'

type Props = {
  items: Item[]
  participants: Participant[]
  setParticipants: (ps: Participant[]) => void
  perPersonTotals: PerPersonTotals
  onSubmit: () => void
  onExportJson: () => void
  onImportJsonPick: () => void
}

export function Summary({
  items,
  participants,
  setParticipants,
  perPersonTotals,
  onSubmit,
  onExportJson,
  onImportJsonPick,
}: Props) {
  const total = items.reduce((s, it) => s + (it.price || 0) * it.qty, 0)
  const itemCount = items.reduce((s, it) => s + it.qty, 0)
  const sharedTotal = items
    .filter((it) => it.assignment.shared)
    .reduce((s, it) => s + (it.price || 0) * it.qty, 0)
  const personalTotal = total - sharedTotal
  const parts = fmtPriceParts(total)
  const missing = items.some((it) => it.price == null || isNaN(it.price as number))

  return (
    <div>
      <div className="brand">
        <div className="brand-name">
          Ruoka<em>tilaus</em>
        </div>
        <div className="brand-sub">Mökkikauppalista</div>
      </div>

      <div className="summary-card">
        <div className="eyebrow">Yhteensä</div>
        <div className="summary-total">
          <span>{parts.whole}</span>
          <span className="cents">{parts.cents}</span>
          <span className="currency">{parts.cur}</span>
        </div>
        <div className="summary-sub">
          <span>{itemCount} tuotetta</span>
          <span className="dot">•</span>
          <span>{participants.length} henkilöä</span>
          {missing && (
            <>
              <span className="dot">•</span>
              <span style={{ color: 'var(--wood)' }}>puuttuvia hintoja</span>
            </>
          )}
        </div>

        <div className="summary-section">
          <div className="eyebrow">Jako per henkilö</div>
          <p className="summary-split-hint">
            Muokkaa nimeä klikkaamalla riviä; avatarista väri. Lisää tai poista henkilöitä — vähintään yksi
            jää jäljelle.
          </p>
          <ParticipantList
            participants={participants}
            setParticipants={setParticipants}
            perPersonTotals={perPersonTotals}
            withSplitBars
          />
        </div>
      </div>

      <div className="summary-card">
        <div className="stat-list">
          <div className="stat-row">
            <span>Yhteiset (jaetaan tasan)</span>
            <span className="v">{fmtPrice(sharedTotal)}</span>
          </div>
          <div className="stat-row">
            <span>Henkilökohtaiset</span>
            <span className="v">{fmtPrice(personalTotal)}</span>
          </div>
          <div className="stat-row">
            <span>Per henkilö yhteisestä</span>
            <span className="v">{fmtPrice(sharedTotal / Math.max(participants.length, 1))}</span>
          </div>
        </div>
      </div>

      <button className="cta" onClick={onSubmit} disabled={items.length === 0}>
        Tilaa S-kaupasta
        <span className="arrow">→</span>
      </button>
      <div style={{ fontSize: 11, color: 'var(--ink-3)', textAlign: 'center', marginTop: 8, lineHeight: 1.4 }}>
        Valitse kauppa ja noutoaika tilausta varten.
      </div>

      <div className="summary-io summary-io--below-cta">
        <button type="button" className="summary-io-btn" onClick={onExportJson}>
          Vie JSON
        </button>
        <button type="button" className="summary-io-btn" onClick={onImportJsonPick}>
          Tuo JSON
        </button>
      </div>
      <div style={{ fontSize: 10, color: 'var(--ink-4)', textAlign: 'center', marginTop: 6, lineHeight: 1.35 }}>
        Koko lista, kategoriat, jaon asetukset ja porukka. Voit jakaa tiedoston tai palauttaa myöhemmin.
      </div>

      <SkaupatAuthPanel />
    </div>
  )
}
