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

export const REACH = 58
export const LOCK_LEVEL = 0.78
export const LOCK_HOLD_MS = 340

export const STATIONS: Station[] = [
  { id: 's1', kHz: 629, name: 'TERRACE', audio: 'tracks/one.mp3' },
  { id: 's2', kHz: 815, name: 'HOME', audio: 'tracks/two.mp3' },
  { id: 's3', kHz: 1001, name: 'DETOUR', audio: 'tracks/three.mp3' },
  { id: 's4', kHz: 1187, name: '3AM', audio: 'tracks/four.mp3' },
  { id: 's5', kHz: 1373, name: 'RAIN', audio: 'tracks/five.mp3' },
  { id: 's6', kHz: 1559, name: 'QUIET', audio: 'tracks/six.mp3' },
]

export const FINAL_FREQ = 1633

export const PLATE = 'RECEIVER · 6'

export const FINALE: string[] = [
  'You know jaana?',
  'It was never about finding the songs —',
  'the prettiest melody is our silence that burns.',
  'I just wish we solve everything together,',
  'find solutions, find paths that somehow,',
  'at the end of the day lead to us.',
  'I love you Shreya.',
]
