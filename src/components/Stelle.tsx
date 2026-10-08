import { Star } from 'lucide-react'

/** Stelle in sola lettura, con mezze stelle (per la media). */
export function StelleDisplay({
  valore,
  numeroVoti,
  size = 16,
}: {
  valore: number
  numeroVoti?: number
  size?: number
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <StellaSingola key={i} riempimento={Math.max(0, Math.min(1, valore - (i - 1)))} size={size} />
        ))}
      </span>
      {typeof numeroVoti === 'number' && (
        <span className="text-xs text-text-muted">({numeroVoti})</span>
      )}
    </span>
  )
}

/** Stelle interattive, intere da 0 a 5, per esprimere il proprio voto. */
export function StelleInput({
  valore,
  onChange,
  size = 26,
}: {
  valore: number
  onChange: (v: number) => void
  size?: number
}) {
  return (
    <span className="inline-flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i === valore ? 0 : i)}
          className="p-0.5 -m-0.5 active:scale-90 transition-transform duration-150"
          aria-label={`${i} stelle`}
        >
          <Star
            size={size}
            className={i <= valore ? 'fill-accent text-accent' : 'text-border'}
            strokeWidth={1.5}
          />
        </button>
      ))}
    </span>
  )
}

function StellaSingola({ riempimento, size }: { riempimento: number; size: number }) {
  const id = `stella-${Math.round(riempimento * 100)}-${size}`
  if (riempimento <= 0) return <Star size={size} className="text-border" strokeWidth={1.5} />
  if (riempimento >= 1) return <Star size={size} className="fill-accent text-accent" strokeWidth={1.5} />
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <defs>
        <linearGradient id={id}>
          <stop offset={`${riempimento * 100}%`} stopColor="#E4FF3A" />
          <stop offset={`${riempimento * 100}%`} stopColor="transparent" />
        </linearGradient>
      </defs>
      <path
        d="M12 2.5l2.9 6.3 6.6.6-5 4.5 1.5 6.6L12 17l-5.9 3.5L7.5 14l-5-4.5 6.6-.6z"
        fill={`url(#${id})`}
        stroke="#27272A"
        strokeWidth="1.5"
      />
    </svg>
  )
}
