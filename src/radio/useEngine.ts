import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import { Receiver } from '../audio/Receiver'
import { BAND, FINAL_FREQ, LOCK_HOLD_MS, LOCK_LEVEL, STATIONS } from '../data/set'
import { initialState, reducer } from '../state/machine'
import { angleToFreq, clamp, jitter, readBand } from './band'
import { angleOf } from './layout'

const PLAY = 0.5
const SPRING = 210
const DAMP = 0.855
const FINE_AFTER = 0.42
const FINE_SENS = 0.34
const PUBLISH_MS = 66
const ERASE_MS = 900

type Drag =
  | {
      mode: 'knob'
      pointerId: number
      base: number
      last: number
      turn: number
      started: number
    }
  | { mode: 'glass'; pointerId: number; x: number; base: number; started: number }

export type Readout = {
  freq: number
  level: number
  fine: boolean
  touching: boolean
}

const shortest = (a: number, b: number) => {
  let d = (b - a) % 360
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return d
}

export function useEngine() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)
  const [readout, setReadout] = useState<Readout>({
    freq: BAND.min,
    level: 0,
    fine: false,
    touching: false,
  })
  const [erasing, setErasing] = useState(0)
  const [silent, setSilent] = useState<ReadonlySet<string>>(() => new Set<string>())

  const engine = useRef<Receiver | null>(null)

  const needle = useRef<HTMLDivElement | null>(null)
  const lamp = useRef<HTMLDivElement | null>(null)
  const cone = useRef<HTMLDivElement | null>(null)
  const knob = useRef<HTMLDivElement | null>(null)
  const knobFace = useRef<HTMLDivElement | null>(null)
  const glass = useRef<HTMLDivElement | null>(null)

  const phys = useRef({
    angle: BAND.sweepMin,
    cmd: BAND.sweepMin,
    vel: 0,
    drag: null as Drag | null,
    fineLatch: false,
    fineAmount: 1,
    candidate: '',
    lockedSince: 0,
    published: 0,
    mark: 0,
    audit: 0,
    side: STATIONS.map((s) => (BAND.min < s.kHz ? 0 : 1)),
    pump: 0,
    sway: 0,
  })

  const mirror = useRef({ found: state.found, finale: state.finale })
  mirror.current.found = state.found
  mirror.current.finale = state.finale

  const live = useRef({ power: false, locked: '', finale: false })
  const erase = useRef(0)
  const eraseShown = useRef(-1)

  useEffect(() => {
    const rec = new Receiver()
    engine.current = rec
    rec.onVoiceFail = (id: string) => {
      setSilent((prev) => {
        if (prev.has(id)) return prev
        const next = new Set(prev)
        next.add(id)
        return next
      })
    }
    let raf = 0
    let last = performance.now()
    let dead = false

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now
      const p = phys.current
      const t = now / 1000

      const held = p.drag ? now - p.drag.started : 0
      const wanted = held > FINE_AFTER ? FINE_SENS : 1
      p.fineAmount += (wanted - p.fineAmount) * (1 - Math.pow(0.0015, dt))
      const sens = p.fineLatch ? FINE_SENS : p.fineAmount

      if (Math.abs(p.cmd - p.angle) < PLAY) p.cmd = p.angle
      p.vel += (p.cmd - p.angle) * SPRING * dt
      p.vel *= Math.pow(DAMP, dt * 60)
      p.angle += p.vel * dt
      if (p.angle < BAND.sweepMin) {
        p.angle = BAND.sweepMin
        p.vel = 0
      }
      if (p.angle > BAND.sweepMax) {
        p.angle = BAND.sweepMax
        p.vel = 0
      }

      const freq = angleToFreq(p.angle)
      const reading = readBand(freq, STATIONS)
      const signal = reading.level
      const tremor = 0.04 + 0.16 * (1 - signal)
      const wobble = jitter(t, tremor) * (live.current.power ? 1 : 0.3)

      if (reading.station && signal > 0.42) {
        const home = angleOf(reading.at)
        const gap = home - p.angle
        if (Math.abs(gap) < 3.4) {
          const grip = (signal - 0.42) / 0.58
          p.cmd += gap * grip * (p.drag ? 0.05 : 0.16) * (dt * 60)
        }
      }

      const armed =
        live.current.power && Object.keys(mirror.current.found).length >= STATIONS.length
      if (armed && !mirror.current.finale) {
        if (!dead) {
          dead = true
          rec.retune()
        }
      } else if (!armed) {
        dead = false
      }

      rec.tune(signal, 1 - signal, dead)
      for (const s of STATIONS) {
        rec.voiceLevel(s.id, reading.station === s.id ? signal : 0)
      }

      if (live.current.power) {
        const mark = Math.floor(freq / 100)
        if (mark !== p.mark) {
          p.mark = mark
          rec.detent()
        }
        for (let i = 0; i < STATIONS.length; i++) {
          const side = freq >= STATIONS[i]!.kHz ? 1 : 0
          if (side !== p.side[i]) {
            if (Math.abs(freq - STATIONS[i]!.kHz) < 34) rec.detent()
            p.side[i] = side
          }
        }
      }

      if (now - p.audit > 2000) {
        p.audit = now
        if (live.current.power && rec.suspended) void rec.resume()
      }

      const settled = p.vel * p.vel < 2.5
      const finaleNow = armed && settled && Math.abs(freq - FINAL_FREQ) <= 15
      if (finaleNow !== live.current.finale) {
        live.current.finale = finaleNow
        dispatch({ type: 'finale', on: finaleNow })
      }

      const lockedId =
        live.current.power && !dead && signal >= LOCK_LEVEL ? reading.station : null
      if (lockedId !== live.current.locked) {
        live.current.locked = lockedId ?? ''
        dispatch({ type: 'lock', id: lockedId })
      }

      if (
        lockedId &&
        lockedId !== p.candidate &&
        mirror.current.found[lockedId] === undefined
      ) {
        p.candidate = lockedId
        p.lockedSince = now
      } else if (!lockedId) {
        p.candidate = ''
      } else if (
        lockedId === p.candidate &&
        mirror.current.found[lockedId] === undefined &&
        now - p.lockedSince > LOCK_HOLD_MS
      ) {
        p.candidate = ''
        dispatch({ type: 'discover', id: lockedId })
      }

      if (needle.current) {
        needle.current.style.transform = `translateX(-50%) rotate(${(
          p.angle +
          wobble * 1.4
        ).toFixed(3)}deg)`
      }
      if (knobFace.current) {
        knobFace.current.style.transform = `rotate(${(p.angle * 4.5).toFixed(2)}deg)`
      }
      if (lamp.current) lamp.current.style.setProperty('--sig', signal.toFixed(3))

      if (erase.current) {
        const pct = clamp((now - erase.current) / ERASE_MS, 0, 1)
        if (Math.abs(pct - eraseShown.current) > 0.04) {
          eraseShown.current = pct
          setErasing(pct)
        }
        if (pct >= 1) {
          erase.current = 0
          eraseShown.current = -1
          setErasing(0)
          live.current.finale = false
          dead = false
          rec.retune()
          dispatch({ type: 'erase' })
        }
      }

      if (now - p.published > PUBLISH_MS) {
        p.published = now
        const fine = sens < 0.6
        setReadout((prev) =>
          Math.abs(prev.freq - (freq + wobble * 1.8)) > 0.35 ||
          Math.abs(prev.level - signal) > 0.02 ||
          prev.fine !== fine ||
          prev.touching !== (p.drag !== null)
            ? { freq: freq + wobble * 1.8, level: signal, fine, touching: p.drag !== null }
            : prev,
        )
      }
    }

    raf = requestAnimationFrame(frame)
    const onVisibility = () => {
      if (document.hidden) void rec.suspend()
      else void rec.resume()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', onVisibility)
      engine.current = null
      rec.dispose()
    }
  }, [])

  const power = useCallback(async (on: boolean) => {
    const rec = engine.current
    if (!rec) return
    if (on) await rec.boot(STATIONS)
    rec.power(on)
    live.current.power = on
    if (!on) {
      live.current.locked = ''
      live.current.finale = false
      dispatch({ type: 'lock', id: null })
      dispatch({ type: 'finale', on: false })
    }
    dispatch({ type: 'power', on })
  }, [])

  const nudge = useCallback((delta: number) => {
    const p = phys.current
    p.cmd = clamp(p.cmd + delta, BAND.sweepMin, BAND.sweepMax)
  }, [])

  const dial = {
    onKnobDown(e: ReactPointerEvent<HTMLDivElement>) {
      const el = knob.current
      if (!el) return
      el.setPointerCapture(e.pointerId)
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      phys.current.drag = {
        mode: 'knob',
        pointerId: e.pointerId,
        last: (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI,
        base: phys.current.cmd,
        turn: 0,
        started: performance.now(),
      }
    },
    onKnobMove(e: ReactPointerEvent<HTMLDivElement>) {
      const drag = phys.current.drag
      if (!drag || drag.mode !== 'knob' || drag.pointerId !== e.pointerId) return
      const el = knob.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const here = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI
      drag.turn += shortest(drag.last, here) * phys.current.fineAmount
      drag.last = here
      phys.current.cmd = clamp(drag.base + drag.turn, BAND.sweepMin, BAND.sweepMax)
    },
    onKnobDoubleClick() {
      phys.current.fineLatch = !phys.current.fineLatch
    },
    onKnobWheel(e: ReactWheelEvent) {
      const step = (e.deltaMode === 1 ? 16 : e.deltaY) * 0.07
      nudge(step * (e.shiftKey ? 0.3 : 1))
    },
    onKnobKey(e: ReactKeyboardEvent) {
      const big = e.shiftKey ? 0.25 : 1
      let hit = true
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowDown':
          nudge(-2.4 * big)
          break
        case 'ArrowRight':
        case 'ArrowUp':
          nudge(2.4 * big)
          break
        case 'PageDown':
          nudge(-10)
          break
        case 'PageUp':
          nudge(10)
          break
        case 'Home':
          phys.current.cmd = BAND.sweepMin
          break
        case 'End':
          phys.current.cmd = BAND.sweepMax
          break
        default:
          hit = false
      }
      if (hit) e.preventDefault()
    },
    onGlassDown(e: ReactPointerEvent<HTMLDivElement>) {
      const el = glass.current
      if (!el) return
      el.setPointerCapture(e.pointerId)
      phys.current.drag = {
        mode: 'glass',
        pointerId: e.pointerId,
        x: e.clientX,
        base: phys.current.cmd,
        started: performance.now(),
      }
    },
    onGlassMove(e: ReactPointerEvent<HTMLDivElement>) {
      const drag = phys.current.drag
      if (!drag || drag.mode !== 'glass' || drag.pointerId !== e.pointerId) return
      const r = glass.current?.getBoundingClientRect()
      const width = r && r.width > 0 ? r.width : 320
      phys.current.cmd = clamp(
        drag.base + ((e.clientX - drag.x) / width) * 104 * phys.current.fineAmount,
        BAND.sweepMin,
        BAND.sweepMax,
      )
    },
    endDrag(e: ReactPointerEvent) {
      const drag = phys.current.drag
      if (drag && drag.pointerId === e.pointerId) phys.current.drag = null
    },
    knobRef(el: HTMLDivElement | null) {
      knob.current = el
    },
    glassRef(el: HTMLDivElement | null) {
      glass.current = el
    },
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.closest('button,[role="slider"]'))) {
        return
      }
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        void power(!live.current.power)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [power])

  const reset = useCallback(() => {
    phys.current.cmd = BAND.sweepMin
    engine.current?.rewind()
  }, [])

  return {
    state,
    readout,
    silent,
    reset,
    needle,
    knobFace,
    lamp,
    cone,
    erasing,
    power,
    dial,
    holdErase: (on: boolean) => {
      erase.current = on ? performance.now() : 0
      if (!on) {
        eraseShown.current = -1
        setErasing(0)
      }
    },
  }
}

export type Engine = ReturnType<typeof useEngine>
