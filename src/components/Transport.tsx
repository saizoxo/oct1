type Props = {
  power: boolean
  onPower: () => void
  holdErase: (on: boolean) => void
  erasing: number
  plate: string
}

export function Transport({ power, onPower, holdErase, erasing, plate }: Props) {
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
          data-focusable="true"
        >
          <span className="key-cap">
            <span className="pilot" />
          </span>
          <span className="key-legend">ON</span>
        </button>

        <button
          type="button"
          className="key key--reset"
          onPointerDown={() => holdErase(true)}
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
      </div>
    </div>
  )
}
