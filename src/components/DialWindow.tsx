import { memo, useEffect, useRef, useState, type RefObject } from 'react'
import { DIAL, DIAL_TICKS, clampX, finalMark, stationMarks } from '../radio/layout'
import { FINALE, STATIONS } from '../data/set'

type Props = {
  needle: RefObject<HTMLDivElement | null>
  found: Record<string, true>
  note: boolean
  silent: Set<string>
  fine: boolean
  glassRef: (el: HTMLDivElement | null) => void
  onDown: (e: React.PointerEvent<HTMLDivElement>) => void
  onMove: (e: React.PointerEvent<HTMLDivElement>) => void
  onUp: (e: React.PointerEvent<HTMLDivElement>) => void
}

function useTyped(lines: string[], run: boolean, pace: number) {
  const [count, setCount] = useState(0)
  const timer = useRef<number | null>(null)
  useEffect(() => {
    if (!run) {
      setCount(0)
      return
    }
    const total = lines.join('').length
    timer.current = window.setTimeout(function step() {
      setCount((c) => {
        if (c >= total) return c
        const next = c + 1
        timer.current = window.setTimeout(step, next % 14 === 0 ? pace * 7 : pace)
        return next
      })
    }, 260)
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [run, lines, pace])
  return count
}

function reduceMotion() {
  return (
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export const DialWindow = memo(function DialWindow({
  needle,
  found,
  note,
  silent,
  fine,
  glassRef,
  onDown,
  onMove,
  onUp,
}: Props) {
  const pace = reduceMotion() ? 0 : 26
  const total = FINALE.join('').length
  const typed = useTyped(FINALE, note, pace)
  const done = note && (pace === 0 || typed >= total)
  let budget = pace === 0 ? total : typed
  const shown = FINALE.map((line) => {
    if (budget >= line.length) {
      budget -= line.length
      return line
    }
    const part = line.slice(0, Math.max(0, budget))
    budget = 0
    return part
  })

  const marks = stationMarks()
  const finaleMark = finalMark()
  const showFinaleMark = Object.keys(found).length >= STATIONS.length

  return (
    <div
      className="dial-glass"
      style={{ gridArea: 'dial' }}
      ref={glassRef}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <div className="dial-card" style={{ aspectRatio: `${DIAL.width}/${DIAL.height}` }}>
        <svg
          className={'dial-print' + (note ? ' is-clear' : '')}
          viewBox={`0 0 ${DIAL.width} ${DIAL.height}`}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="arcInk" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#6a563a" />
              <stop offset="1" stopColor="#4a3a26" />
            </linearGradient>
          </defs>

          <text className="dial-unit" x="18" y="20">
            kHz
          </text>
          <text className="dial-band" x="322" y="20">
            MEDIUM WAVE
          </text>

          <path
            d={`M ${clampX(dialXArc(-41))} ${dialYArc(-41)} A ${260} ${260} 0 0 1 ${clampX(
              dialXArc(41),
            )} ${dialYArc(41)}`}
            className="dial-arc"
          />

          {DIAL_TICKS.map((t, i) => (
            <line
              key={i}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              className={`tick tick--${t.kind}`}
            />
          ))}

          {DIAL_TICKS.map((t, i) =>
            t.label ? (
              <text
                key={`n${i}`}
                x={clampX(t.x1)}
                y={t.y1 + 34}
                className="tick-label"
                textAnchor="middle"
              >
                {t.label}
              </text>
            ) : null,
          )}

          {showFinaleMark && (
            <g className={note ? 'finale-mark is-lit' : 'finale-mark'}>
              <line
                x1={finaleMark.x}
                y1={finaleMark.y - 44}
                x2={finaleMark.x}
                y2={finaleMark.y - 26}
              />
            </g>
          )}

          {marks.map((m) =>
            found[m.id] ? (
              <text
                key={m.id}
                x={clampX(m.x)}
                y={m.y}
                className={silent.has(m.id) ? 'station-name is-silent' : 'station-name'}
                textAnchor="middle"
              >
                {m.name}
              </text>
            ) : null,
          )}
        </svg>

        <div className={'dial-scrim' + (note ? ' is-on' : '')} aria-hidden="true" />

        <div className="needle" ref={needle} aria-hidden="true">
          <span className="needle-tip" />
        </div>

        <div className={'fine-tag' + (fine ? ' is-on' : '')}>FINE</div>

        <div className={'dial-note' + (done ? ' is-complete' : '')} aria-live="polite">
          {shown.map((line, i) => (
            <p key={i}>{line || ' '}</p>
          ))}
        </div>

        <div className="dial-bezel" aria-hidden="true" />
        <div className="dial-sheen" aria-hidden="true" />
        <div className="dial-smudge" aria-hidden="true" />
        <div className="dial-dust" aria-hidden="true" />
      </div>
    </div>
  )
})

function dialXArc(deg: number) {
  return DIAL.cx + DIAL.r * Math.sin((deg * Math.PI) / 180)
}
function dialYArc(deg: number) {
  return DIAL.cy - DIAL.r * Math.cos((deg * Math.PI) / 180)
}
