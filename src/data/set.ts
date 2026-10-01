export type Station = {
  id: string
  kHz: number
  name: string
  audio: string
}

export const BAND = {
  min: 536,
  max: 1652,
  sweepMin: -40,
  sweepMax: 40,
}

export const REACH = 42
export const LOCK_LEVEL = 0.8
export const LOCK_HOLD_MS = 420

export const STATIONS: Station[] = [
  { id: 's1', kHz: 636, name: 'HOME', audio: 'tracks/one.mp3' },
  { id: 's2', kHz: 758, name: 'TERRACE', audio: 'tracks/two.mp3' },
  { id: 's3', kHz: 903, name: 'RAIN', audio: 'tracks/three.mp3' },
  { id: 's4', kHz: 1071, name: '3AM', audio: 'tracks/four.mp3' },
  { id: 's5', kHz: 1246, name: 'DETOUR', audio: 'tracks/five.mp3' },
  { id: 's6', kHz: 1468, name: 'QUIET', audio: 'tracks/six.mp3' },
]

export const FINAL_FREQ = 1633

export const PLATE = 'RECEIVER · 6'

export const FINALE: string[] = [
  'Six things I kept, one per frequency.',
  'You only have to find them once.',
  'The seventh is the only one that matters,',
  'and it has never been on the dial.',
]
