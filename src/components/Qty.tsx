type Props = {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
}

export function Qty({ value, onChange, min = 1, max = 99 }: Props) {
  return (
    <div className="qty" onClick={(e) => e.stopPropagation()}>
      <button onClick={() => onChange(Math.max(min, value - 1))} aria-label="Vähennä">
        −
      </button>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = parseInt(e.target.value || '0', 10)
          if (!isNaN(n)) onChange(Math.max(min, Math.min(max, n)))
        }}
      />
      <button onClick={() => onChange(Math.min(max, value + 1))} aria-label="Lisää">
        +
      </button>
    </div>
  )
}
