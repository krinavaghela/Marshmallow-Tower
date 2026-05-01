function clamp01(x) {
  return Math.max(0, Math.min(1, x))
}

function makeNoiseBuffer(ctx, seconds) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds))
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  return buf
}

function scheduleGainEnvelope(gainParam, now, points) {
  // points: [{ t, v, type: 'set'|'lin'|'exp' }]
  for (const p of points) {
    if (p.type === 'set') gainParam.setValueAtTime(p.v, now + p.t)
    else if (p.type === 'lin') gainParam.linearRampToValueAtTime(p.v, now + p.t)
    else gainParam.exponentialRampToValueAtTime(Math.max(0.000001, p.v), now + p.t)
  }
}

export function createAudio() {
  let enabled = true
  let started = false
  let ctx = null

  let master = null
  let ambientBus = null
  let sfxBus = null

  let roomOsc = null
  let roomGain = null
  let roomLfo = null
  let roomLfoGain = null

  let airSrc = null
  let airFilter = null
  let airGain = null
  let airLfo = null
  let airLfoGain = null
  let airNoiseBuf = null

  let creakTimer = null
  let ambientPlaying = false

  let duckTimer = null

  function ensureCtx() {
    if (ctx) return ctx
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    ctx = new Ctx()

    master = ctx.createGain()
    master.gain.value = 0.0
    master.connect(ctx.destination)

    ambientBus = ctx.createGain()
    ambientBus.gain.value = 0.0
    ambientBus.connect(master)

    sfxBus = ctx.createGain()
    sfxBus.gain.value = 1.0
    sfxBus.connect(master)

    return ctx
  }

  function setAmbientGain(target, ms) {
    if (!ctx || !ambientBus) return
    const now = ctx.currentTime
    ambientBus.gain.cancelScheduledValues(now)
    ambientBus.gain.setValueAtTime(ambientBus.gain.value, now)
    ambientBus.gain.linearRampToValueAtTime(target, now + ms / 1000)
  }

  function setMasterGain(target, ms) {
    if (!ctx || !master) return
    const now = ctx.currentTime
    master.gain.cancelScheduledValues(now)
    master.gain.setValueAtTime(master.gain.value, now)
    master.gain.linearRampToValueAtTime(target, now + ms / 1000)
  }

  function stopAmbientNodes() {
    ambientPlaying = false
    try {
      roomOsc?.stop()
      roomLfo?.stop()
    } catch {}
    try {
      airSrc?.stop()
      airLfo?.stop()
    } catch {}
    roomOsc = null
    roomGain = null
    roomLfo = null
    roomLfoGain = null
    airSrc = null
    airFilter = null
    airGain = null
    airLfo = null
    airLfoGain = null
  }

  function scheduleCreaks() {
    clearTimeout(creakTimer)
    if (!ctx || !enabled) return

    const waitMs = 8000 + Math.random() * 17000
    creakTimer = setTimeout(() => {
      if (!enabled || !ctx) return
      playWoodCreak()
      scheduleCreaks()
    }, waitMs)
  }

  function startAmbient() {
    if (!ctx || ambientPlaying) return
    ambientPlaying = true

    // Layer 1 — room tone (42Hz hum + subtle gain LFO)
    roomOsc = ctx.createOscillator()
    roomOsc.type = 'sine'
    roomOsc.frequency.value = 42
    roomGain = ctx.createGain()
    roomGain.gain.value = 0.0

    roomLfo = ctx.createOscillator()
    roomLfo.type = 'sine'
    roomLfo.frequency.value = 0.07
    roomLfoGain = ctx.createGain()
    roomLfoGain.gain.value = 0.008
    roomLfo.connect(roomLfoGain)
    roomLfoGain.connect(roomGain.gain)

    roomOsc.connect(roomGain)
    roomGain.connect(ambientBus)

    // Layer 2 — air texture (bandpassed noise + slow tremolo)
    airNoiseBuf = airNoiseBuf || makeNoiseBuffer(ctx, 2.0)
    airSrc = ctx.createBufferSource()
    airSrc.buffer = airNoiseBuf
    airSrc.loop = true
    airFilter = ctx.createBiquadFilter()
    airFilter.type = 'bandpass'
    airFilter.frequency.value = 320
    airFilter.Q.value = 0.4
    airGain = ctx.createGain()
    airGain.gain.value = 0.0

    airLfo = ctx.createOscillator()
    airLfo.type = 'sine'
    airLfo.frequency.value = 0.03
    airLfoGain = ctx.createGain()
    airLfoGain.gain.value = 0.006
    airLfo.connect(airLfoGain)
    airLfoGain.connect(airGain.gain)

    airSrc.connect(airFilter)
    airFilter.connect(airGain)
    airGain.connect(ambientBus)

    const now = ctx.currentTime
    roomGain.gain.setValueAtTime(0.0, now)
    roomGain.gain.linearRampToValueAtTime(0.018, now + 2.0)
    airGain.gain.setValueAtTime(0.0, now)
    airGain.gain.linearRampToValueAtTime(0.012, now + 2.0)

    roomOsc.start(now)
    roomLfo.start(now)
    airSrc.start(now)
    airLfo.start(now)

    setAmbientGain(1.0, 2000)
    scheduleCreaks()
  }

  function stopAmbient() {
    clearTimeout(creakTimer)
    if (!ctx) return
    setAmbientGain(0.0, 1500)
    // stop nodes after fade completes
    const t = setTimeout(() => stopAmbientNodes(), 1600)
    // keep ref so we can cancel if needed
    duckTimer = duckTimer || t
  }

  function resumeIfNeeded() {
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume?.()
  }

  function start() {
    // Installs first-gesture resume/start hook. Safe to call multiple times.
    if (started) return
    started = true

    const handler = () => {
      document.removeEventListener('pointerdown', handler, true)
      document.removeEventListener('keydown', handler, true)
      const c = ensureCtx()
      if (!c) return
      resumeIfNeeded()
      if (!enabled) return
      // Fade master in gently on first gesture; ambient fades in separately.
      setMasterGain(1.0, 400)
      startAmbient()
    }

    document.addEventListener('pointerdown', handler, true)
    document.addEventListener('keydown', handler, true)
  }

  function toggle() {
    enabled = !enabled
    const c = ensureCtx()
    if (!c) return enabled

    if (!enabled) {
      stopAmbient()
      // fade master down then suspend
      setMasterGain(0.0, 800)
      setTimeout(() => {
        try {
          c.suspend?.()
        } catch {}
      }, 850)
    } else {
      resumeIfNeeded()
      setMasterGain(1.0, 250)
      startAmbient()
    }
    return enabled
  }

  function isEnabled() {
    return enabled
  }

  function isPlaying() {
    return Boolean(enabled && ctx && ctx.state === 'running' && ambientPlaying && master?.gain?.value > 0.001)
  }

  function duckAmbient(factor, ms) {
    if (!ctx || !ambientBus) return
    const now = ctx.currentTime
    ambientBus.gain.cancelScheduledValues(now)
    ambientBus.gain.setValueAtTime(ambientBus.gain.value, now)
    ambientBus.gain.linearRampToValueAtTime(factor, now + ms / 1000)
  }

  function playWoodCreak() {
    if (!enabled || !ctx || ctx.state !== 'running') return
    const now = ctx.currentTime

    const bufSize = Math.floor(ctx.sampleRate * 0.22)
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
    const d = buf.getChannelData(0)
    const center = 200 + Math.random() * 80
    for (let i = 0; i < bufSize; i++) {
      const t = i / bufSize
      const env = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8
      d[i] = (Math.random() * 2 - 1) * env
    }

    const src = ctx.createBufferSource()
    src.buffer = buf
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.setValueAtTime(400, now)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(center, now)
    bp.Q.setValueAtTime(0.9, now)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.00001, now)
    g.gain.linearRampToValueAtTime(0.06, now + 0.04)
    g.gain.exponentialRampToValueAtTime(0.00001, now + 0.22)

    src.connect(bp)
    bp.connect(f)
    f.connect(g)
    g.connect(ambientBus)
    src.start(now)
    src.stop(now + 0.24)
  }

  function playMarshmallowPlace() {
    if (!enabled || !ctx || ctx.state !== 'running') return
    const now = ctx.currentTime

    // Thud
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(180, now)
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.12)
    gain.gain.setValueAtTime(0.35, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
    osc.connect(gain)
    gain.connect(sfxBus)
    osc.start(now)
    osc.stop(now + 0.2)

    // Squish
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(320, now + 0.02)
    osc2.frequency.exponentialRampToValueAtTime(140, now + 0.1)
    gain2.gain.setValueAtTime(0.15, now + 0.02)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.14)
    osc2.connect(gain2)
    gain2.connect(sfxBus)
    osc2.start(now + 0.02)
    osc2.stop(now + 0.16)
  }

  /** Small connector / joint placement — dryer than marshmallow */
  function playJointPlace() {
    if (!enabled || !ctx || ctx.state !== 'running') return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(220, now)
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.08)
    gain.gain.setValueAtTime(0.14, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
    osc.connect(gain)
    gain.connect(sfxBus)
    osc.start(now)
    osc.stop(now + 0.12)
  }

  function playCrownPlace() {
    if (!enabled || !ctx || ctx.state !== 'running') return
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(140, now)
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.16)
    gain.gain.setValueAtTime(0.5, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.23)
    osc.connect(gain)
    gain.connect(sfxBus)
    osc.start(now)
    osc.stop(now + 0.25)

    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(300, now + 0.02)
    osc2.frequency.exponentialRampToValueAtTime(120, now + 0.12)
    gain2.gain.setValueAtTime(0.18, now + 0.02)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
    osc2.connect(gain2)
    gain2.connect(sfxBus)
    osc2.start(now + 0.02)
    osc2.stop(now + 0.22)

    // Resonance tail
    const osc3 = ctx.createOscillator()
    const gain3 = ctx.createGain()
    osc3.type = 'sine'
    osc3.frequency.setValueAtTime(90, now + 0.02)
    gain3.gain.setValueAtTime(0.08, now + 0.02)
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.42)
    osc3.connect(gain3)
    gain3.connect(sfxBus)
    osc3.start(now + 0.02)
    osc3.stop(now + 0.45)
  }

  function playSpaghettiSnap() {
    if (!enabled || !ctx || ctx.state !== 'running') return
    const now = ctx.currentTime

    const bufferSize = Math.floor(ctx.sampleRate * 0.05)
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 8)
    }
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 2800
    filter.Q.value = 1.2
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.6, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(sfxBus)
    source.start(now)

    setTimeout(() => {
      if (!enabled || !ctx || ctx.state !== 'running') return
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(1200 + Math.random() * 400, ctx.currentTime)
      g.gain.setValueAtTime(0.04, ctx.currentTime)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)
      osc.connect(g)
      g.connect(sfxBus)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.08)
    }, 30)
  }

  function playSpaghettiHover() {
    if (!enabled || !ctx || ctx.state !== 'running') return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(440, now)
    g.gain.setValueAtTime(0.04, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.08)
    osc.connect(g)
    g.connect(sfxBus)
    osc.start(now)
    osc.stop(now + 0.09)
  }

  function playTapeApply() {
    if (!enabled || !ctx || ctx.state !== 'running') return
    const now = ctx.currentTime

    const bufSize = Math.floor(ctx.sampleRate * 0.12)
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) {
      const t = i / bufSize
      d[i] = (Math.random() * 2 - 1) * t * Math.pow(1 - t, 2) * 3
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    const f = ctx.createBiquadFilter()
    f.type = 'highpass'
    f.frequency.value = 1200
    const g = ctx.createGain()
    g.gain.value = 0.3
    src.connect(f)
    f.connect(g)
    g.connect(sfxBus)
    src.start(now)

    const osc = ctx.createOscillator()
    const g2 = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 200
    g2.gain.setValueAtTime(0.2, now + 0.1)
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.22)
    osc.connect(g2)
    g2.connect(sfxBus)
    osc.start(now + 0.1)
    osc.stop(now + 0.24)
  }

  function playStringTwang() {
    if (!enabled || !ctx || ctx.state !== 'running') return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    const baseFreq = 280 + Math.random() * 120
    osc.frequency.setValueAtTime(baseFreq, now)
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.7, now + 0.3)
    gain.gain.setValueAtTime(0.18, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)

    const lfo = ctx.createOscillator()
    const lfoGain = ctx.createGain()
    lfo.type = 'sine'
    lfo.frequency.value = 8
    lfoGain.gain.value = 6
    lfo.connect(lfoGain)
    lfoGain.connect(osc.frequency)
    lfo.start(now)
    lfo.stop(now + 0.35)

    osc.connect(gain)
    gain.connect(sfxBus)
    osc.start(now)
    osc.stop(now + 0.38)
  }

  function playInvalidAction() {
    if (!enabled || !ctx || ctx.state !== 'running') return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(180, now)
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.08)
    g.gain.setValueAtTime(0.2, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.08)
    osc.connect(g)
    g.connect(sfxBus)
    osc.start(now)
    osc.stop(now + 0.09)
  }

  let lastHoverT = 0
  function playNodeHover() {
    if (!enabled || !ctx || ctx.state !== 'running') return
    const now = ctx.currentTime
    if (now - lastHoverT < 0.12) return
    lastHoverT = now
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(600, now)
    g.gain.setValueAtTime(0.00001, now)
    g.gain.linearRampToValueAtTime(0.025, now + 0.01)
    g.gain.exponentialRampToValueAtTime(0.00001, now + 0.04)
    osc.connect(g)
    g.connect(sfxBus)
    osc.start(now)
    osc.stop(now + 0.05)
  }

  function playTestInitiate() {
    if (!enabled || !ctx || ctx.state !== 'running') return
    const now = ctx.currentTime

    const bufSize = Math.floor(ctx.sampleRate * 0.09)
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 5)
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    const gN = ctx.createGain()
    gN.gain.setValueAtTime(0.16, now)
    gN.gain.exponentialRampToValueAtTime(0.00001, now + 0.12)
    src.connect(gN)
    gN.connect(sfxBus)
    src.start(now)

    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(240, now)
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.15)
    g.gain.setValueAtTime(0.4, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
    osc.connect(g)
    g.connect(sfxBus)
    osc.start(now)
    osc.stop(now + 0.18)
  }

  function playStanding() {
    if (!enabled || !ctx || ctx.state !== 'running') return
    const now = ctx.currentTime
    duckAmbient(0.4, 0.08 * 1000)
    setTimeout(() => {
      if (!ctx || ctx.state !== 'running') return
      duckAmbient(1.0, 300)
    }, 300)

    const notes = [
      { f: 523, g: 0.3, dt: 0.0, dur: 0.6 },
      { f: 659, g: 0.28, dt: 0.08, dur: 0.6 },
      { f: 784, g: 0.25, dt: 0.16, dur: 0.8 },
    ]
    for (const n of notes) {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'sine'
      const t0 = now + n.dt
      osc.frequency.setValueAtTime(n.f, t0)
      g.gain.setValueAtTime(0.00001, t0)
      g.gain.linearRampToValueAtTime(n.g, t0 + 0.01)
      g.gain.exponentialRampToValueAtTime(0.00001, t0 + n.dur)
      osc.connect(g)
      g.connect(sfxBus)
      osc.start(t0)
      osc.stop(t0 + n.dur + 0.02)
    }
  }

  function playWobbling() {
    if (!enabled || !ctx || ctx.state !== 'running') return
    const now = ctx.currentTime
    const osc1 = ctx.createOscillator()
    const g1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(440, now)
    g1.gain.setValueAtTime(0.00001, now)
    g1.gain.linearRampToValueAtTime(0.25, now + 0.01)
    g1.gain.exponentialRampToValueAtTime(0.00001, now + 0.3)
    osc1.connect(g1)
    g1.connect(sfxBus)
    osc1.start(now)
    osc1.stop(now + 0.32)

    const osc2 = ctx.createOscillator()
    const g2 = ctx.createGain()
    osc2.type = 'sine'
    const t2 = now + 0.2
    osc2.frequency.setValueAtTime(415, t2)
    g2.gain.setValueAtTime(0.00001, t2)
    g2.gain.linearRampToValueAtTime(0.2, t2 + 0.01)
    g2.gain.exponentialRampToValueAtTime(0.00001, t2 + 0.4)

    const lfo = ctx.createOscillator()
    const lfoG = ctx.createGain()
    lfo.type = 'sine'
    lfo.frequency.value = 6
    lfoG.gain.value = 15
    lfo.connect(lfoG)
    lfoG.connect(osc2.frequency)

    osc2.connect(g2)
    g2.connect(sfxBus)
    lfo.start(t2)
    lfo.stop(t2 + 0.35)
    osc2.start(t2)
    osc2.stop(t2 + 0.42)
  }

  function playPartialCollapse() {
    if (!enabled || !ctx || ctx.state !== 'running') return
    const now = ctx.currentTime
    duckAmbient(0.2, 80)
    setTimeout(() => duckAmbient(1.0, 650), 520)

    // whoosh sweep
    const buf = makeNoiseBuffer(ctx, 0.4)
    const src = ctx.createBufferSource()
    src.buffer = buf
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(4000, now)
    lp.frequency.exponentialRampToValueAtTime(200, now + 0.4)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.25, now)
    g.gain.exponentialRampToValueAtTime(0.00001, now + 0.42)
    src.connect(lp)
    lp.connect(g)
    g.connect(sfxBus)
    src.start(now)
    src.stop(now + 0.45)

    // impact
    const osc = ctx.createOscillator()
    const g2 = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(100, now + 0.42)
    g2.gain.setValueAtTime(0.4, now + 0.42)
    g2.gain.exponentialRampToValueAtTime(0.00001, now + 0.62)
    osc.connect(g2)
    g2.connect(sfxBus)
    osc.start(now + 0.42)
    osc.stop(now + 0.66)
  }

  function playTotalCollapse() {
    if (!enabled || !ctx || ctx.state !== 'running') return
    const now = ctx.currentTime

    // Ambient out completely during collapse; resume after.
    duckAmbient(0.0, 40)
    setTimeout(() => {
      if (!enabled || !ctx) return
      duckAmbient(1.0, 2000)
    }, 900)

    // 0ms crack
    playSpaghettiSnap()

    // cascade snaps
    const snaps = 4 + Math.floor(Math.random() * 3)
    for (let i = 0; i < snaps; i++) {
      const dt = 0.05 + i * (0.12 / Math.max(1, snaps - 1))
      setTimeout(() => playSpaghettiSnap(), dt * 1000)
    }

    // whoosh down
    const buf = makeNoiseBuffer(ctx, 0.45)
    const src = ctx.createBufferSource()
    src.buffer = buf
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(4800, now + 0.2)
    lp.frequency.exponentialRampToValueAtTime(180, now + 0.6)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.32, now + 0.2)
    g.gain.exponentialRampToValueAtTime(0.00001, now + 0.68)
    src.connect(lp)
    lp.connect(g)
    g.connect(sfxBus)
    src.start(now + 0.2)
    src.stop(now + 0.7)

    // impact boom
    const osc = ctx.createOscillator()
    const g2 = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(80, now + 0.6)
    osc.frequency.exponentialRampToValueAtTime(30, now + 1.1)
    g2.gain.setValueAtTime(0.6, now + 0.6)
    g2.gain.exponentialRampToValueAtTime(0.00001, now + 1.1)
    osc.connect(g2)
    g2.connect(sfxBus)
    osc.start(now + 0.6)
    osc.stop(now + 1.15)

    // high crash
    const crashBuf = makeNoiseBuffer(ctx, 0.1)
    const crash = ctx.createBufferSource()
    crash.buffer = crashBuf
    const g3 = ctx.createGain()
    g3.gain.setValueAtTime(0.3, now + 0.6)
    g3.gain.exponentialRampToValueAtTime(0.00001, now + 0.7)
    crash.connect(g3)
    g3.connect(sfxBus)
    crash.start(now + 0.6)
    crash.stop(now + 0.72)
  }

  function playTimerWarning(minutesLeft) {
    if (!enabled || !ctx || ctx.state !== 'running') return
    const now = ctx.currentTime
    if (minutesLeft === 5) {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(220, now)
      g.gain.setValueAtTime(0.15, now)
      g.gain.exponentialRampToValueAtTime(0.00001, now + 1.0)
      osc.connect(g)
      g.connect(sfxBus)
      osc.start(now)
      osc.stop(now + 1.05)
    } else if (minutesLeft === 2) {
      // two quick ticks
      playTimerTick()
      setTimeout(() => playTimerTick(), 100)
    } else if (minutesLeft === 1) {
      playTimerTick()
    }
  }

  function playTimerTick() {
    if (!enabled || !ctx || ctx.state !== 'running') return
    const now = ctx.currentTime
    const bufSize = Math.floor(ctx.sampleRate * 0.03)
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 9)
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.25, now)
    g.gain.exponentialRampToValueAtTime(0.00001, now + 0.06)
    src.connect(g)
    g.connect(sfxBus)
    src.start(now)
    src.stop(now + 0.08)
  }

  function playTimerEnd() {
    if (!enabled || !ctx || ctx.state !== 'running') return
    playTimerWarning(5)
  }

  return {
    start,
    toggle,
    isEnabled,
    isPlaying,

    playMarshmallowPlace,
    playJointPlace,
    playCrownPlace,
    playSpaghettiSnap,
    playSpaghettiHover,
    playTapeApply,
    playStringTwang,
    playInvalidAction,
    playNodeHover,

    playTestInitiate,
    playStanding,
    playWobbling,
    playPartialCollapse,
    playTotalCollapse,

    playTimerWarning,
    playTimerTick,
    playTimerEnd,
  }
}

