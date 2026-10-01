import type { RefObject } from 'react'

const SIDES = 6

type Props = {
  lamp: RefObject<HTMLDivElement | null>
  locked: boolean
}

export function SignalHex({ lamp, locked }: Props) {
  return (
    <div className={'hex' + (locked ? ' is-locked' : '')}>
      <div className="hex-lamp" ref={lamp} aria-hidden="true">
        <svg viewBox="0 0 100 116" className="hex-shape">
          <defs>
            <radialGradient id="hexFill" cx="50%" cy="42%" r="62%">
              <stop offset="0%" stopColor="var(--lamp-core)" />
              <stop offset="100%" stopColor="var(--lamp-edge)" />
            </radialGradient>
          </defs>
          <polygon
            points="50,6 94,31 94,85 50,110 6,85 6,31"
            fill="url(#hexFill)"
            className="hex-glass"
          />
          {Array.from({ length: SIDES }, (_, i) => {
            const a0 = (-90 + i * 60 + 4) * (Math.PI / 180)
            const a1 = (-90 + (i + 1) * 60 - 4) * (Math.PI / 180)
            const r = 40
            return (
              <line
                key={i}
                x1={50 + Math.cos(a0) * r}
                y1={58 + Math.sin(a0) * r}
                x2={50 + Math.cos(a1) * r}
                y2={58 + Math.sin(a1) * r}
                className="hex-edge"
                style={{ '--i': i } as React.CSSProperties}
              />
            )
          })}
          <polygon
            points="50,20 81,38 81,76 50,94 19,76 19,38"
            className="hex-needle"
          />
        </svg>
      </div>
      <span className="hex-legend">SIGNAL</span>
    </div>
  )
}
