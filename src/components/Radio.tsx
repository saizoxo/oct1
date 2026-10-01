import { useEffect, useMemo, useState } from 'react'
import { STATIONS } from '../data/set'
import type { Engine } from '../radio/useEngine'
import { DialWindow } from './DialWindow'
import { Grille, Hardware } from './Grille'
import { SignalHex } from './SignalHex'
import { Transport } from './Transport'
import { TuningKnob } from './TuningKnob'

type Props = {
  engine: Engine
  plate: string
}

export function Radio({ engine, plate }: Props) {
  const {
    state,
    readout,
    silent,
    needle,
    knobFace,
    lamp,
    cone,
    erasing,
    power,
    dial,
    holdErase,
    reset,
  } = engine

  const [firstRun, setFirstRun] = useState(true)
  useEffect(() => {
    const fade = window.setTimeout(() => setFirstRun(false), 3000)
    const drop = () => setFirstRun(false)
    window.addEventListener('pointerdown', drop, { once: true })
    return () => {
      window.clearTimeout(fade)
      window.removeEventListener('pointerdown', drop)
    }
  }, [])

  const armed = useMemo(
    () => Object.keys(state.found).length >= STATIONS.length,
    [state.found],
  )

  return (
    <div className="room">
      <div className="room-lamp" aria-hidden="true" />
      <div className="room-wall" aria-hidden="true" />

      <div className={'cabinet' + (state.power ? ' is-live' : '')}>
        <Transport
          power={state.power}
          onPower={() => void power(!state.power)}
          holdErase={holdErase}
          onReset={reset}
          erasing={erasing}
          plate={plate}
        />

        <DialWindow
          needle={needle}
          found={state.found}
          finale={state.finale}
          silent={new Set(silent)}
          fine={readout.fine}
          glassRef={dial.glassRef}
          onDown={dial.onGlassDown}
          onMove={dial.onGlassMove}
          onUp={dial.endDrag}
        />

        <div className="console" style={{ gridArea: 'console' }}>
          <TuningKnob
            knobRef={dial.knobRef}
            knobFace={knobFace}
            onDown={dial.onKnobDown}
            onMove={dial.onKnobMove}
            onUp={dial.endDrag}
            onDoubleClick={dial.onKnobDoubleClick}
            onWheel={dial.onKnobWheel}
            onKeyDown={dial.onKnobKey}
            freq={readout.freq}
            armed={armed}
            live={state.power}
          />
          <SignalHex lamp={lamp} locked={state.locked !== null} />
          <div className="readout">
            <span className="readout-value">{Math.round(readout.freq)}</span>
            <span className="readout-unit">kHz</span>
            <span className="readout-name">
              {state.locked ? (STATIONS.find((s) => s.id === state.locked)?.name ?? '') : ''}
            </span>
          </div>
        </div>

        <Grille cone={cone} />
        <Hardware />
      </div>

      <div className={'first-run' + (firstRun ? ' is-on' : '')} aria-hidden="true">
        <span>
          <i>↑</i> click to turn on
        </span>
        <span>
          <i>↑</i> hold and rotate to fine tune
        </span>
        <span>
          <i>↑</i> hold reset to wipe
        </span>
      </div>

      <div className="room-desk" aria-hidden="true" />
      <div className="room-vignette" aria-hidden="true" />
    </div>
  )
}
