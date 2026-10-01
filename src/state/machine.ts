export type RadioState = {
  power: boolean
  found: Record<string, true>
  locked: string | null
  finale: boolean
}

export type RadioAction =
  | { type: 'power'; on: boolean }
  | { type: 'lock'; id: string | null }
  | { type: 'discover'; id: string }
  | { type: 'finale'; on: boolean }
  | { type: 'erase' }

const KEY = 'receiver:v1'

function loadFound(): Record<string, true> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as Record<string, true>
  } catch {
    return {}
  }
}

function saveFound(found: Record<string, true>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(found))
  } catch {
    /* private mode: discovery simply does not persist */
  }
}

export const initialState = (): RadioState => ({
  power: false,
  found: loadFound(),
  locked: null,
  finale: false,
})

export function reducer(state: RadioState, action: RadioAction): RadioState {
  switch (action.type) {
    case 'power':
      return state.power === action.on ? state : { ...state, power: action.on }
    case 'lock':
      return state.locked === action.id ? state : { ...state, locked: action.id }
    case 'discover': {
      if (state.found[action.id]) return state
      const found = { ...state.found, [action.id]: true as const }
      saveFound(found)
      return { ...state, found }
    }
    case 'finale':
      return state.finale === action.on ? state : { ...state, finale: action.on }
    case 'erase': {
      saveFound({})
      return { ...state, found: {}, finale: false }
    }
    default:
      return state
  }
}
