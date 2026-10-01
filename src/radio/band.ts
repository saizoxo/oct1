import { BAND, REACH } from '../data/set'

const SPAN = BAND.sweepMax - BAND.sweepMin
const RANGE = BAND.max - BAND.min

export const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export function freqToAngle(kHz: number): number {
  return BAND.sweepMin + ((kHz - BAND.min) / RANGE) * SPAN
}

export function angleToFreq(angle: number): number {
  return BAND.min + ((angle - BAND.sweepMin) / SPAN) * RANGE
}

const smooth = (t: number) => t * t * (3 - 2 * t)
const CAPTURE = 0.52

export function stationLevel(dial: number, station: number): number {
  const t = clamp(1 - Math.abs(dial - station) / REACH, 0, 1)
  return smooth(clamp(t / CAPTURE, 0, 1))
}

export type BandReading = {
  level: number
  station: string | null
  at: number
  offset: number
}

export function readBand(dial: number, stations: readonly { id: string; kHz: number }[]): BandReading {
  let level = 0
  let station: string | null = null
  let at = 0
  let offset = 0
  for (const s of stations) {
    const l = stationLevel(dial, s.kHz)
    if (l > level) {
      level = l
      station = s.id
      at = s.kHz
      offset = dial - s.kHz
    }
  }
  return { level, station, at, offset }
}

const JITTER_SEED = 20260614

export function jitter(t: number, amount: number): number {
  const a = Math.sin(t * 12.9898 + JITTER_SEED) * 43758.5453
  const b = Math.sin(t * 4.1231 + JITTER_SEED * 0.7) * 12543.1231
  return ((a - Math.floor(a)) * 2 - 1 + (b - Math.floor(b)) * 2 - 1) * 0.5 * amount
}

export const kHzLabel = (kHz: number) => Math.round(kHz).toString()

export const isTrackable = (kHz: number) =>
  kHz >= BAND.min && kHz <= BAND.max
