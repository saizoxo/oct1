type Voice = {
  el: HTMLAudioElement
  input: MediaElementAudioSourceNode
  filter: BiquadFilterNode
  gain: GainNode
  ready: boolean
  failed: boolean
  wanted: boolean
  graceUntil: number
}

const NOISE_SECONDS = 3
const QUIET = 0.0015
const voiceWow = new Map<string, number>()

const ramp = (p: AudioParam, v: number, tc: number, now: number) => {
  if (Math.abs(p.value - v) < QUIET) return
  p.setTargetAtTime(v, now, tc)
}

function driveCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 2048
  const curve = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    curve[i] = Math.tanh(x * amount) / Math.tanh(amount)
  }
  return curve
}

export class Receiver {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private speaker: BiquadFilterNode | null = null
  private shaper: WaveShaperNode | null = null
  private noiseGain: GainNode | null = null
  private noiseFilter: BiquadFilterNode | null = null
  private carrierGain: GainNode | null = null
  private carrierA: OscillatorNode | null = null
  private carrierB: OscillatorNode | null = null
  private humGain: GainNode | null = null
  private analyser: AnalyserNode | null = null
  private meter: Uint8Array<ArrayBuffer> | null = null
  private bassAnalyser: AnalyserNode | null = null
  private bassBins: Uint8Array<ArrayBuffer> | null = null
  private voices = new Map<string, Voice>()
  private running = false
  private disposed = false
  onVoiceFail: ((id: string) => void) | null = null
  private idleTimer: number | null = null
  private nextCrackle = 0
  private wowAt = 0

  get suspended(): boolean {
    return this.ctx !== null && this.ctx.state !== 'running'
  }

  async boot(voices: { id: string; audio: string }[]): Promise<void> {
    if (this.ctx || this.disposed) return
    const Ctor: typeof AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctor({ latencyHint: 'playback' })
    this.ctx = ctx

    const shaper = ctx.createWaveShaper()
    shaper.curve = driveCurve(1.6)
    shaper.oversample = '2x'
    this.shaper = shaper

    const speaker = ctx.createBiquadFilter()
    speaker.type = 'highpass'
    speaker.frequency.value = 255
    this.speaker = speaker

    const cone = ctx.createBiquadFilter()
    cone.type = 'lowpass'
    cone.frequency.value = 4200
    cone.Q.value = 0.6

    const cone2 = ctx.createBiquadFilter()
    cone2.type = 'lowpass'
    cone2.frequency.value = 5400
    cone2.Q.value = 0.6

    const body = ctx.createBiquadFilter()
    body.type = 'peaking'
    body.frequency.value = 1250
    body.Q.value = 0.7
    body.gain.value = 2.6

    const presence = ctx.createBiquadFilter()
    presence.type = 'peaking'
    presence.frequency.value = 3600
    presence.Q.value = 0.8
    presence.gain.value = -3.4

    const master = ctx.createGain()
    master.gain.value = 0
    this.master = master

    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -11
    limiter.knee.value = 10
    limiter.ratio.value = 9
    limiter.attack.value = 0.004
    limiter.release.value = 0.22

    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.6
    this.analyser = analyser
    this.meter = new Uint8Array(new ArrayBuffer(analyser.fftSize))

    const bassAnalyser = ctx.createAnalyser()
    bassAnalyser.fftSize = 1024
    bassAnalyser.smoothingTimeConstant = 0.4
    shaper.connect(bassAnalyser)
    this.bassAnalyser = bassAnalyser
    this.bassBins = new Uint8Array(new ArrayBuffer(bassAnalyser.frequencyBinCount))

    shaper.connect(speaker)
    speaker.connect(cone)
    cone.connect(cone2)
    cone2.connect(body)
    body.connect(presence)
    presence.connect(master)
    master.connect(limiter)
    limiter.connect(analyser)
    analyser.connect(ctx.destination)

    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * NOISE_SECONDS, ctx.sampleRate)
    const frames = noiseBuffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < frames.length; i++) {
      const white = Math.random() * 2 - 1
      last = 0.72 * last + 0.28 * white
      frames[i] = white * 0.7 + last * 0.6
    }
    const noise = ctx.createBufferSource()
    noise.buffer = noiseBuffer
    noise.loop = true

    const noiseFilter = ctx.createBiquadFilter()
    noiseFilter.type = 'bandpass'
    noiseFilter.frequency.value = 900
    noiseFilter.Q.value = 0.7
    this.noiseFilter = noiseFilter

    const noiseGain = ctx.createGain()
    noiseGain.gain.value = 0.115
    this.noiseGain = noiseGain

    noise.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(shaper)
    noise.start()

    const carrierA = ctx.createOscillator()
    carrierA.type = 'sine'
    carrierA.frequency.value = 1650
    const carrierB = ctx.createOscillator()
    carrierB.type = 'sine'
    carrierB.frequency.value = 3300
    const carrierGain = ctx.createGain()
    carrierGain.gain.value = 0
    carrierA.connect(carrierGain)
    carrierB.connect(carrierGain)
    carrierGain.connect(shaper)
    carrierA.start()
    carrierB.start()
    this.carrierA = carrierA
    this.carrierB = carrierB
    this.carrierGain = carrierGain

    const hum = ctx.createGain()
    hum.gain.value = 0
    const mains = ctx.createOscillator()
    mains.type = 'sine'
    mains.frequency.value = 50
    const mains2 = ctx.createOscillator()
    mains2.type = 'sine'
    mains2.frequency.value = 100
    const humTrim = ctx.createGain()
    humTrim.gain.value = 0.5
    mains.connect(humTrim)
    mains2.connect(humTrim)
    humTrim.connect(hum)
    hum.connect(shaper)
    mains.start()
    mains2.start()
    this.humGain = hum

    for (const v of voices) this.register(v.id, v.audio)

    if (ctx.state === 'suspended') await ctx.resume()
  }

  register(id: string, src: string): void {
    const ctx = this.ctx
    const shaper = this.shaper
    if (!ctx || !shaper) return
    if (this.voices.has(id)) return
    const el = new Audio()
    el.src = src
    el.preload = 'auto'
    el.loop = true
    voiceWow.set(id, 1)
    const voice: Voice = {
      el,
      input: ctx.createMediaElementSource(el),
      filter: ctx.createBiquadFilter(),
      gain: ctx.createGain(),
      ready: false,
      failed: false,
      wanted: false,
      graceUntil: 0,
    }
    voice.filter.type = 'bandpass'
    voice.filter.frequency.value = 1200
    voice.filter.Q.value = 0.35
    voice.gain.gain.value = 0
    voice.input.connect(voice.filter)
    voice.filter.connect(voice.gain)
    voice.gain.connect(shaper)
    const wake = () => {
      voice.ready = true
      if (voice.wanted && voice.el.paused) void this.startVoice(voice)
    }
    el.addEventListener('canplay', wake, { once: true })
    el.addEventListener('error', () => {
      voice.failed = true
      voice.ready = true
      this.onVoiceFail?.(id)
    })
    void el.load()
    this.voices.set(id, voice)
  }

  private async startVoice(voice: Voice): Promise<void> {
    if (!this.running || voice.failed) return
    try {
      await voice.el.play()
    } catch {
      voice.ready = false
    }
  }

  power(on: boolean): void {
    const ctx = this.ctx
    if (!ctx || !this.master || !this.humGain || !this.speaker) return
    const now = ctx.currentTime
    this.running = on
    if (this.idleTimer !== null) {
      window.clearTimeout(this.idleTimer)
      this.idleTimer = null
    }
    const master = this.master.gain
    if (on) {
      master.cancelScheduledValues(now)
      master.setValueAtTime(master.value, now)
      master.linearRampToValueAtTime(0.82, now + 0.55)
      this.humGain.gain.setValueAtTime(0, now)
      this.humGain.gain.linearRampToValueAtTime(0.021, now + 2.6)
      this.speaker.frequency.cancelScheduledValues(now)
      this.speaker.frequency.setValueAtTime(140, now)
      this.speaker.frequency.linearRampToValueAtTime(235, now + 1.8)
      this.thunk(on)
      for (const voice of this.voices.values()) {
        if (voice.wanted) void this.startVoice(voice)
      }
    } else {
      master.cancelScheduledValues(now)
      master.setValueAtTime(master.value, now)
      master.linearRampToValueAtTime(0, now + 0.24)
      this.humGain.gain.linearRampToValueAtTime(0, now + 0.3)
      this.speaker.frequency.cancelScheduledValues(now)
      this.speaker.frequency.setValueAtTime(this.speaker.frequency.value, now)
      this.speaker.frequency.exponentialRampToValueAtTime(90, now + 0.26)
      for (const voice of this.voices.values()) voice.el.pause()
      this.idleTimer = window.setTimeout(() => {
        this.idleTimer = null
        if (!this.running && this.ctx && this.ctx.state === 'running') void this.ctx.suspend()
      }, 340)
    }
  }

  private thunk(on: boolean): void {
    const ctx = this.ctx
    const shaper = this.shaper
    if (!ctx || !shaper) return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(on ? 120 : 90, now)
    osc.frequency.exponentialRampToValueAtTime(on ? 46 : 34, now + 0.16)
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, now)
    env.gain.exponentialRampToValueAtTime(on ? 0.3 : 0.22, now + 0.012)
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)
    osc.connect(env)
    env.connect(shaper)
    osc.start(now)
    osc.stop(now + 0.22)

    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.06), ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
    }
    const burst = ctx.createBufferSource()
    burst.buffer = buffer
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 1800
    const bg = ctx.createGain()
    bg.gain.value = 0.09
    burst.connect(hp)
    hp.connect(bg)
    bg.connect(shaper)
    burst.start(now)
  }

  tune(signal: number, miss: number, dead: boolean): void {
    const ctx = this.ctx
    const nf = this.noiseFilter
    const ng = this.noiseGain
    if (!ctx || !nf || !ng) return
    const now = ctx.currentTime
    const hiss = dead ? 0.42 : 1
    ramp(nf.frequency, 520 + 1400 * signal, 0.07, now)
    ramp(nf.Q, 0.45 + 2.2 * signal, 0.08, now)
    ramp(ng.gain, 0.115 * hiss * (1 - 0.4 * signal), 0.1, now)
    if (this.carrierA && this.carrierB && this.carrierGain) {
      const whistle = Math.sin(Math.PI * Math.min(1, Math.max(0, miss)))
      const f = 620 + 780 * miss * miss
      ramp(this.carrierA.frequency, f, 0.06, now)
      ramp(this.carrierB.frequency, f * 2.01, 0.06, now)
      ramp(this.carrierGain.gain, 0.03 * whistle * hiss, 0.09, now)
    }

    if (dead) this.nextCrackle = now + 0.5
    else if (now > this.nextCrackle) {
      this.pop(now, 0.05 + miss * 0.22)
      this.nextCrackle = now + 0.03 + Math.random() * (0.3 + miss * 0.75)
    }
  }

  private pop(now: number, size: number): void {
    const ctx = this.ctx
    const shaper = this.shaper
    if (!ctx || !shaper) return
    const length = Math.max(64, Math.floor(ctx.sampleRate * (0.004 + size * 0.02)))
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 5)
    }
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 700 + Math.random() * 2600
    bp.Q.value = 1.1
    const g = ctx.createGain()
    g.gain.value = 0.1 + Math.random() * 0.16
    src.connect(bp)
    bp.connect(g)
    g.connect(shaper)
    src.start(now)
  }

  rewind(): void {
    for (const voice of this.voices.values()) {
      if (!voice.failed) voice.el.currentTime = 0
      voice.el.pause()
    }
  }

  retune(): void {
    const ctx = this.ctx
    if (!ctx) return
    const now = ctx.currentTime
    for (const voice of this.voices.values()) {
      voice.graceUntil = 0
      voice.wanted = false
      voice.gain.gain.cancelScheduledValues(now)
      voice.gain.gain.setTargetAtTime(0, now, 0.12)
      voice.el.pause()
    }
  }

  voiceLevel(id: string, level: number): void {
    const ctx = this.ctx
    const voice = this.voices.get(id)
    if (!voice || !ctx) return
    const now = ctx.currentTime
    if (now > this.wowAt) {
      this.wowAt = now + 0.18
      const target = 0.997 + Math.random() * 0.006
      voiceWow.set(id, (voiceWow.get(id) ?? 1) * 0.86 + target * 0.14)
      voice.el.playbackRate = Math.min(1.012, Math.max(0.988, voiceWow.get(id)!))
    }
    const open = level > 0.035
    voice.wanted = open
    if (open) {
      voice.graceUntil = now + 0.4
      if (voice.ready && !voice.failed && voice.el.paused) void this.startVoice(voice)
    } else if (now > voice.graceUntil && !voice.el.paused) {
      voice.el.pause()
    }
    if (voice.failed) {
      ramp(voice.gain.gain, 0, 0.04, now)
      return
    }
    const curve = Math.pow(level, 1.3)
    ramp(voice.gain.gain, curve * 0.95, 0.1, now)
    ramp(voice.filter.frequency, 900 + 1500 * level, 0.11, now)
    ramp(voice.filter.Q, 1.05 - 0.75 * level, 0.11, now)
  }

  detent(): void {
    const ctx = this.ctx
    const shaper = this.shaper
    if (!ctx || !shaper || !this.running) return
    const now = ctx.currentTime
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.035), ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3)
    }
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 2600
    bp.Q.value = 1.4
    const g = ctx.createGain()
    g.gain.value = 0.16
    src.connect(bp)
    bp.connect(g)
    g.connect(shaper)
    src.start(now)
  }

  level(): number {
    const analyser = this.analyser
    const meter = this.meter
    if (!analyser || !meter) return 0
    analyser.getByteTimeDomainData(meter)
    let sum = 0
    for (let i = 0; i < meter.length; i++) {
      const v = (meter[i]! - 128) / 128
      sum += v * v
    }
    return Math.min(1, Math.sqrt(sum / meter.length) * 3.4)
  }

  bassLevel(): number {
    const a = this.bassAnalyser
    const bins = this.bassBins
    if (!a || !bins) return 0
    a.getByteFrequencyData(bins)
    const per = a.context.sampleRate / a.fftSize
    const lo = Math.max(1, Math.floor(26 / per))
    const hi = Math.min(bins.length - 1, Math.ceil(170 / per))
    let sum = 0
    for (let i = lo; i <= hi; i++) {
      const v = bins[i]! / 255
      sum += v * v
    }
    return Math.min(1, (Math.sqrt(sum / (hi - lo + 1)) * 1.9))
  }

  async suspend(): Promise<void> {
    if (!this.running || !this.ctx) return
    for (const voice of this.voices.values()) voice.el.pause()
    if (this.ctx.state === 'running') await this.ctx.suspend()
  }

  async resume(): Promise<void> {
    if (!this.running || !this.ctx) return
    if (this.ctx.state === 'suspended') await this.ctx.resume()
    for (const voice of this.voices.values()) {
      if (voice.wanted) void this.startVoice(voice)
    }
  }

  seek(id: string, seconds: number): void {
    const voice = this.voices.get(id)
    if (voice && Number.isFinite(voice.el.duration)) {
      voice.el.currentTime = Math.min(seconds, voice.el.duration - 0.05)
    }
  }

  position(id: string): number {
    return this.voices.get(id)?.el.currentTime ?? 0
  }

  duration(id: string): number {
    const d = this.voices.get(id)?.el.duration ?? Number.NaN
    return Number.isFinite(d) ? d : 0
  }

  available(id: string): boolean {
    const v = this.voices.get(id)
    return !!v && !v.failed
  }

  dispose(): void {
    this.disposed = true
    for (const voice of this.voices.values()) {
      voice.el.pause()
      voice.el.src = ''
      voice.gain.disconnect()
      voice.filter.disconnect()
      voice.input.disconnect()
    }
    this.voices.clear()
    void this.ctx?.close()
    this.ctx = null
  }
}
