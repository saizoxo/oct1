import type { RefObject } from 'react'

type Props = {
  knobRef: (el: HTMLDivElement | null) => void
  knobFace: RefObject<HTMLDivElement | null>
  onDown: (e: React.PointerEvent<HTMLDivElement>) => void
  onMove: (e: React.PointerEvent<HTMLDivElement>) => void
  onUp: (e: React.PointerEvent<HTMLDivElement>) => void
  onDoubleClick: () => void
  onWheel: (e: React.WheelEvent<HTMLDivElement>) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void
  freq: number
  armed: boolean
  live: boolean
}

export function TuningKnob({
  knobRef,
  knobFace,
  onDown,
  onMove,
  onUp,
  onDoubleClick,
  onWheel,
  onKeyDown,
  freq,
  armed,
  live,
}: Props) {
  return (
    <div className="knob-well">
      <div
        className="knob"
        ref={knobRef}
        role="slider"
        tabIndex={0}
        aria-label="Tuning"
        aria-valuemin={0}
        aria-valuemax={2000}
        aria-valuenow={Math.round(freq)}
        aria-valuetext={`${Math.round(freq)} kilohertz`}
        aria-orientation="horizontal"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onDoubleClick={onDoubleClick}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
      >
        <div className="knob-collar" />
        <div className="knob-body">
          <div className="knob-flutes" />
          <div className="knob-face" ref={knobFace}>
            <span className="knob-index" />
          </div>
          <div className="knob-dimple" />
          <div className="knob-spec" />
        </div>
      </div>
      <span className="knob-legend">TUNING</span>
      {live && !armed && <span className="knob-hint">turn it slowly</span>}
    </div>
  )
}
