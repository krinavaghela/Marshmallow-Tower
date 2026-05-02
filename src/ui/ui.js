import '../styles/main.css'
import '../styles/ui.css'

function el(html) {
  const t = document.createElement('template')
  t.innerHTML = html.trim()
  return t.content.firstElementChild
}

export function createUI(mountEl, state) {
  const root = el(`
    <div class="mtl-portfolio">
      <header class="mtl-brand">
        <div class="mtl-kicker">A TINY BUILDING EXPERIMENT</div>
        <h1 class="mtl-title">Marshmallow Tower Lab</h1>
        <p class="mtl-tag">Build. Test. Iterate.</p>
      </header>
      <div class="mtl-stage-wrap">
        <div class="mtl-canvas-host" id="mtl-canvas-host"></div>
        <aside class="mtl-panel">
          <div class="mtl-stat"><span>Score</span><strong id="mtl-score">0</strong></div>
          <div class="mtl-stat"><span>Height</span><strong id="mtl-height">0 cm</strong></div>
          <div class="mtl-stat"><span>Sticks</span><strong id="mtl-sticks">0 / 12</strong></div>
          <div class="mtl-stat"><span>Joints</span><strong id="mtl-joints">0 / 10</strong></div>
          <p class="mtl-hint" id="mtl-hint"></p>
          <div class="mtl-actions">
            <button type="button" class="mtl-btn primary" id="mtl-place-top">Place top</button>
            <button type="button" class="mtl-btn" id="mtl-test">Test stability</button>
            <button type="button" class="mtl-btn ghost" id="mtl-reset">Reset</button>
          </div>
        </aside>
      </div>
      <div class="mtl-overlay" id="mtl-overlay">
        <div class="mtl-overlay-card">
          <h2>Welcome</h2>
          <p>Click a faint snap dot, then another — that places a noodle stick between marshmallow joints.</p>
          <p>When ready, <strong>Place top</strong>, then <strong>Test stability</strong>.</p>
          <button type="button" class="mtl-btn primary" id="mtl-overlay-close">Let’s build</button>
        </div>
      </div>
    </div>
  `)
  mountEl.appendChild(root)

  const host = root.querySelector('#mtl-canvas-host')
  const overlay = root.querySelector('#mtl-overlay')
  const hintEl = root.querySelector('#mtl-hint')
  const listeners = new Map()

  function on(name, fn) {
    if (!listeners.has(name)) listeners.set(name, new Set())
    listeners.get(name).add(fn)
  }

  function emit(name, payload) {
    for (const fn of listeners.get(name) ?? []) fn(payload)
  }

  root.querySelector('#mtl-overlay-close').addEventListener('click', () => emit('closeOverlay'))
  root.querySelector('#mtl-reset').addEventListener('click', () => emit('reset'))
  root.querySelector('#mtl-test').addEventListener('click', () => emit('test'))
  root.querySelector('#mtl-place-top').addEventListener('click', () => emit('placeTopMode'))

  function update(st) {
    root.querySelector('#mtl-score').textContent = String(Math.round(st.score ?? 0))
    root.querySelector('#mtl-height').textContent = `${(st.height ?? 0).toFixed(1)} cm`
    root.querySelector('#mtl-sticks').textContent = `${st.inventory?.sticksUsed ?? 0} / ${st.inventory?.maxSticks ?? 12}`
    root.querySelector('#mtl-joints').textContent = `${st.inventory?.marshmallowsUsed ?? 0} / ${st.inventory?.maxMarshmallows ?? 10}`
    hintEl.textContent = st.hint ?? ''
  }

  function setOverlayVisible(v) {
    overlay.classList.toggle('hidden', !v)
    overlay.setAttribute('aria-hidden', v ? 'false' : 'true')
  }

  update(state)

  return {
    root,
    canvasHost: host,
    update,
    setOverlayVisible,
    on,
  }
}
