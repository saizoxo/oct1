import { BAND, FINAL_FREQ, STATIONS } from '../data/set'

export const DIAL = {
  width: 340,
  height: 186,
  cx: 170,
  cy: 274,
  r: 260,
}

const rad = (deg: number) => (deg * Math.PI) / 180

export const dialX = (deg: number) => DIAL.cx + DIAL.r * Math.sin(rad(deg))
export const dialY = (deg: number) => DIAL.cy - DIAL.r * Math.cos(rad(deg))

export const angleOf = (kHz: number) =>
  BAND.sweepMin +
  ((kHz - BAND.min) / (BAND.max - BAND.min)) * (BAND.sweepMax - BAND.sweepMin)

export type Tick = { x1: number; y1: number; x2: number; y2: number; kind: 'major' | 'mid' | 'minor'; label?: string }

function tickAt(kHz: number, length: number, kind: Tick['kind'], label?: string): Tick {
  const a = angleOf(kHz)
  const [x1, y1] = [dialX(a), dialY(a)]
  const [x2, y2] = [dialX(a), dialY(a) + length]
  return label === undefined ? { x1, y1, x2, y2, kind } : { x1, y1, x2, y2, kind, label }
}

const TICKS: Tick[] = (() => {
  const out: Tick[] = []
  for (let kHz = BAND.min + 4; kHz <= BAND.max; kHz += 20) {
    const hundreds = kHz / 100
    const isMajor = Math.abs(hundreds - Math.round(hundreds)) < 0.001
    const isMid = kHz % 100 === 50 || kHz % 100 === 0
    if (isMajor) {
      out.push(tickAt(kHz, 18, 'major', String(Math.round(hundreds))))
    } else if (isMid) {
      out.push(tickAt(kHz, 11, 'mid'))
    } else {
      out.push(tickAt(kHz, 6, 'minor'))
    }
  }
  return out
})()

export const DIAL_TICKS = TICKS

export const clampX = (x: number) => (x < 28 ? 28 : x > 312 ? 312 : x)

export type StationMark = {
  id: string
  name: string
  x: number
  y: number
  angle: number
}

export const stationMarks = (): StationMark[] =>
  STATIONS.map((s) => {
    const a = angleOf(s.kHz)
    return {
      id: s.id,
      name: s.name,
      angle: a,
      x: dialX(a),
      y: dialY(a) + 52,
    }
  })

export const finalMark = () => {
  const a = angleOf(FINAL_FREQ)
  return { angle: a, x: dialX(a), y: dialY(a) + 52 }
}
