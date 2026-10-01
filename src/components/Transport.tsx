import { useEffect, useRef, useState } from 'react'

type Props = {
  power: boolean
  onPower: () => void
  holdErase: (on: boolean) => void
  onReset: () => void
  erasing: number
  plate: string
}

const HINT_MS = 1500

export function Transport({ power, onPower, holdErase, onReset, erasing, plate }: Props) {
  const [hint, setHint] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

  const flash = () => {
    setHint(true)
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setHint(false), HINT_MS)
  }

  return (
    <div className="deck" style={{ gridArea: 'deck' }}>
      <div className="deck-plate">{plate}</div>

      <div className="deck-controls">
        <button
          type="button"
          className={'key key--power' + (power ? ' is-on' : '')}
          onClick={onPower}
          aria-pressed={power}
          aria-label={power ? 'Switch the receiver off' : 'Switch the receiver on'}
        >
          <span className="key-cap">
            <span className="pilot" />
          </span>
          <span className="key-legend">ON</span>
        </button>

        <div className="reset-well">
          <button
            type="button"
            className="key key--reset"
            onClick={flash}
            onPointerDown={() => {
              onReset()
              holdErase(true)
            }}
            onPointerUp={() => holdErase(false)}
            onPointerLeave={() => holdErase(false)}
            onPointerCancel={() => holdErase(false)}
            onContextMenu={(e) => e.preventDefault()}
            aria-label="Return the needle to the bottom of the band. Hold to clear what has been found."
          >
            <span className="key-cap">
              <span
                className="erase-ring"
                style={{ '--fill': erasing } as React.CSSProperties}
              />
              <span className="key-glyph">0</span>
            </span>
            <span className="key-legend">RESET</span>
          </button>
          <span className={'reset-hint' + (hint ? ' is-on' : '')}>hold to reset</span>
        </div>
      </div>
    </div>
  )
}
