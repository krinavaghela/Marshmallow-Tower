function clamp01(x) {
  return Math.max(0, Math.min(1, x))
}

function fmtTime(seconds) {
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

function bandColor(band) {
  if (band === 'STANDING') return '#2D6A4F'
  if (band === 'WOBBLING') return '#C17B5A'
  if (band === 'PARTIAL') return '#8B5E3C'
  return '#6B2D2D'
}

export function createUI(doc) {
  const els = {
    sidebar: doc.getElementById('sidebar'),
    hint: doc.getElementById('sidebar-hint'),
    rows: [...doc.querySelectorAll('.material-row[data-tool]')],
    crownRow: doc.getElementById('crown-row'),
    crownHint: doc.getElementById('crown-hint'),
    canvas: doc.getElementById('three-canvas'),

    // inventory counters/bars
    counts: {
      spaghetti: doc.getElementById('spaghetti-count'),
      stringInches: doc.getElementById('string-count'),
      tapeInches: doc.getElementById('tape-count'),
      joints: doc.getElementById('joints-count'),
      crown: doc.getElementById('crown-count'),
    },
    bars: {
      spaghetti: doc.getElementById('spaghetti-bar'),
      stringInches: doc.getElementById('string-bar'),
      tapeInches: doc.getElementById('tape-bar'),
      joints: doc.getElementById('joints-bar'),
      crown: doc.getElementById('crown-bar'),
    },

    timerBtn: doc.getElementById('timer-display'),
    timerText: doc.getElementById('timer-text'),

    soundBtn: doc.getElementById('sound-toggle'),
    soundIcon: doc.getElementById('sound-icon'),
    soundTooltip: doc.getElementById('sound-tooltip'),

    resetBtn: doc.getElementById('reset-btn'),
    undoBtn: doc.getElementById('undo-btn'),
    redoBtn: doc.getElementById('redo-btn'),
    testBtn: doc.getElementById('test-tower-btn'),

    rulerTicks: doc.getElementById('ruler-ticks'),
    rulerDot: doc.getElementById('ruler-dot'),

    resultOverlay: doc.getElementById('result-overlay'),
    resultBand: doc.getElementById('result-band'),
    resultHeight: doc.getElementById('result-height'),
    resultCompare: doc.getElementById('result-compare'),
    resultFlavor: doc.getElementById('result-flavor'),
    resultTry: doc.getElementById('result-try'),
  }

  let onToolSelect = () => {}
  let onReset = () => {}
  let onTest = () => {}
  let onTryAgain = () => {}
  let onToggleTimerPause = () => {}
  let onToggleSound = () => {}
  let onUndo = () => {}
  let onRedo = () => {}

  // Pointer-based drag fallback (works on mobile + when HTML drag fails).
  const pointerDrag = {
    active: false,
    tool: null,
    pointerId: null,
    moved: false,
    startX: 0,
    startY: 0,
    ghost: null,
  }

  function ensureDragGhost() {
    if (pointerDrag.ghost) return pointerDrag.ghost
    const el = doc.createElement('div')
    el.style.position = 'fixed'
    el.style.left = '0px'
    el.style.top = '0px'
    el.style.transform = 'translate(-9999px, -9999px)'
    el.style.zIndex = '9999'
    el.style.pointerEvents = 'none'
    el.style.padding = '10px 12px'
    el.style.borderRadius = '12px'
    el.style.background = 'rgba(255,255,255,0.85)'
    el.style.border = '1px solid rgba(0,0,0,0.12)'
    el.style.boxShadow = '0 12px 30px rgba(0,0,0,0.12)'
    el.style.backdropFilter = 'blur(12px) saturate(180%)'
    el.style.webkitBackdropFilter = 'blur(12px) saturate(180%)'
    el.style.fontSize = '13px'
    el.style.fontWeight = '600'
    el.style.color = '#1C1714'
    el.style.whiteSpace = 'nowrap'
    doc.body.appendChild(el)
    pointerDrag.ghost = el
    return el
  }

  function toolLabel(tool) {
    if (tool === 'spaghetti') return '🍝 Spaghetti'
    if (tool === 'string') return '🧵 String'
    if (tool === 'tape') return '🖊 Tape'
    if (tool === 'joint') return '◆ Joints'
    if (tool === 'crown') return '☁️ Marshmallow'
    return tool || ''
  }

  function startPointerDrag(tool, e) {
    if (!tool) return
    pointerDrag.active = true
    pointerDrag.tool = tool
    pointerDrag.pointerId = e.pointerId
    pointerDrag.moved = false
    pointerDrag.startX = e.clientX
    pointerDrag.startY = e.clientY
    const ghost = ensureDragGhost()
    ghost.textContent = toolLabel(tool)
    ghost.style.transform = `translate(${e.clientX + 12}px, ${e.clientY + 12}px)`
    try {
      e.currentTarget?.setPointerCapture?.(e.pointerId)
    } catch {}
  }

  function updatePointerDrag(e) {
    if (!pointerDrag.active || e.pointerId !== pointerDrag.pointerId) return
    const dx = e.clientX - pointerDrag.startX
    const dy = e.clientY - pointerDrag.startY
    if (!pointerDrag.moved && dx * dx + dy * dy > 36) pointerDrag.moved = true
    pointerDrag.ghost?.style && (pointerDrag.ghost.style.transform = `translate(${e.clientX + 12}px, ${e.clientY + 12}px)`)
  }

  function finishPointerDrag(e) {
    if (!pointerDrag.active || e.pointerId !== pointerDrag.pointerId) return
    pointerDrag.active = false
    pointerDrag.pointerId = null
    if (pointerDrag.ghost) pointerDrag.ghost.style.transform = 'translate(-9999px, -9999px)'

    // If it was basically a tap, let the click handler select the tool.
    if (!pointerDrag.moved) return

    // If dropped over the canvas, dispatch a synthetic drop event for builder.
    const canvas = els.canvas
    if (!canvas) return
    const r = canvas.getBoundingClientRect()
    const overCanvas = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
    if (!overCanvas) return

    doc.dispatchEvent(
      new CustomEvent('mt:tool-drop', {
        detail: { tool: pointerDrag.tool, clientX: e.clientX, clientY: e.clientY },
      }),
    )
  }

  function setHint(text) {
    if (els.hint) els.hint.textContent = text
  }

  function setActiveTool(tool) {
    for (const row of els.rows) {
      row.classList.toggle('active', row.dataset.tool === tool)
    }
    if (!tool)
      setHint('Pick a supply, tap the round pad to build. Esc clears the tool; then drag to orbit.')
  }

  function setInventory(snapshot) {
    const r = snapshot.remaining
    const m = snapshot.max

    const setRow = (key, countEl, barEl, left, max, fmt) => {
      if (countEl) countEl.textContent = fmt(left, max)
      if (barEl) barEl.style.width = `${clamp01(left / max) * 100}%`
      const row = els.rows.find((x) => x.dataset.tool === key)
      if (row) row.classList.toggle('depleted', left <= 0)
    }

    setRow('spaghetti', els.counts.spaghetti, els.bars.spaghetti, r.spaghetti, m.spaghetti, (l, mx) => `${l} / ${mx}`)
    setRow('joint', els.counts.joints, els.bars.joints, r.joints, m.joints, (l, mx) => `${l} / ${mx}`)
    setRow('crown', els.counts.crown, els.bars.crown, r.crown, m.crown, (l, mx) => `${l} / ${mx}`)
    setRow(
      'tape',
      els.counts.tapeInches,
      els.bars.tapeInches,
      r.tapeInches,
      m.tapeInches,
      (l, mx) => `${Math.round(l)}" / ${mx}"`,
    )
    setRow(
      'string',
      els.counts.stringInches,
      els.bars.stringInches,
      r.stringInches,
      m.stringInches,
      (l, mx) => `${Math.round(l)}" / ${mx}"`,
    )
  }

  function setTimer({ secondsLeft }) {
    if (els.timerText) els.timerText.textContent = fmtTime(secondsLeft)
  }

  let tooltipT = null
  function showSoundTooltip(text) {
    if (!els.soundTooltip) return
    els.soundTooltip.textContent = text
    els.soundTooltip.classList.remove('hidden')
    clearTimeout(tooltipT)
    tooltipT = setTimeout(() => {
      els.soundTooltip.classList.add('hidden')
    }, 2000)
  }

  function setSoundState({ enabled, playing }) {
    if (!els.soundBtn) return
    els.soundBtn.setAttribute('aria-pressed', enabled ? 'true' : 'false')
    els.soundBtn.dataset.playing = playing ? 'true' : 'false'
    if (els.soundIcon) els.soundIcon.textContent = enabled ? '🔊' : '🔇'
  }

  function setUndoRedoEnabled(canUndo, canRedo) {
    if (els.undoBtn) {
      els.undoBtn.disabled = !canUndo
      els.undoBtn.setAttribute('aria-disabled', canUndo ? 'false' : 'true')
    }
    if (els.redoBtn) {
      els.redoBtn.disabled = !canRedo
      els.redoBtn.setAttribute('aria-disabled', canRedo ? 'false' : 'true')
    }
  }

  /** Marshmallow must be placed before test counts; button stays clickable to show hints. */
  function setTestEnabled(ready) {
    if (!els.testBtn) return
    els.testBtn.disabled = false
    els.testBtn.setAttribute('aria-disabled', ready ? 'false' : 'true')
    els.testBtn.dataset.ready = ready ? 'true' : 'false'
    els.testBtn.classList.toggle('pulse', Boolean(ready))
    els.testBtn.classList.toggle('test-tower--locked', !ready)
  }

  function checkCrownAvailability(_placedJointCount) {
    // Single marshmallow row is always visible; no gating.
  }

  function initRuler({ maxCm = 50, stepCm = 5 } = {}) {
    els.rulerTicks.innerHTML = ''
    for (let cm = 0; cm <= maxCm; cm += stepCm) {
      const tick = doc.createElement('div')
      tick.className = 'tick'
      const y = 100 - (cm / maxCm) * 100
      tick.style.top = `${y}%`
      els.rulerTicks.appendChild(tick)

      const label = doc.createElement('div')
      label.className = 'label'
      label.style.top = `${y}%`
      label.textContent = `${cm}`
      els.rulerTicks.appendChild(label)
    }
    setRulerDot(0, maxCm)
  }

  function setRulerDot(heightCm, maxCm = 50) {
    const y = 100 - clamp01(heightCm / maxCm) * 100
    els.rulerDot.style.top = `${y}%`
  }

  function showResult(result) {
    els.resultBand.textContent = result.band
    els.resultBand.style.color = bandColor(result.band)
    els.resultHeight.textContent = `Your tower reached ${Number(result.height || 0).toFixed(1)} cm`
    els.resultCompare.textContent = 'Kindergarteners average 27cm 👀'
    els.resultFlavor.textContent = result.flavorText || ''
    els.resultOverlay.classList.remove('hidden')
    els.resultOverlay.setAttribute('aria-hidden', 'false')
  }

  function hideResult() {
    els.resultOverlay.classList.add('hidden')
    els.resultOverlay.setAttribute('aria-hidden', 'true')
  }

  function wire() {
    for (const row of els.rows) {
      row.setAttribute('draggable', 'true')
      row.style.cursor = 'grab'
      row.addEventListener('dragstart', (e) => {
        if (row.classList.contains('depleted')) {
          e.preventDefault()
          return
        }
        e.dataTransfer.setData('application/x-mt-tool', row.dataset.tool)
        e.dataTransfer.setData('text/plain', row.dataset.tool)
        e.dataTransfer.effectAllowed = 'copy'
      })
      row.addEventListener('pointerdown', (e) => {
        if (row.classList.contains('depleted')) return
        // Right/middle click: ignore.
        if (typeof e.button === 'number' && e.button !== 0) return
        // Make pointer drag reliable across browsers (avoid scroll/gesture interference).
        e.preventDefault?.()
        startPointerDrag(row.dataset.tool, e)
      })
      row.addEventListener('pointermove', (e) => {
        if (pointerDrag.active) e.preventDefault?.()
        updatePointerDrag(e)
      })
      row.addEventListener('pointerup', (e) => {
        if (pointerDrag.active) e.preventDefault?.()
        finishPointerDrag(e)
      })
      row.addEventListener('pointercancel', (e) => {
        if (pointerDrag.active) e.preventDefault?.()
        finishPointerDrag(e)
      })

      // Extra fallback for iOS Safari where Pointer Events can be flaky in some configurations.
      row.addEventListener(
        'touchstart',
        (e) => {
          if (row.classList.contains('depleted')) return
          const t = e.changedTouches?.[0]
          if (!t) return
          e.preventDefault()
          startPointerDrag(row.dataset.tool, { pointerId: 1, clientX: t.clientX, clientY: t.clientY, currentTarget: row })
        },
        { passive: false },
      )
      row.addEventListener(
        'touchmove',
        (e) => {
          if (!pointerDrag.active) return
          const t = e.changedTouches?.[0]
          if (!t) return
          e.preventDefault()
          updatePointerDrag({ pointerId: 1, clientX: t.clientX, clientY: t.clientY })
        },
        { passive: false },
      )
      row.addEventListener(
        'touchend',
        (e) => {
          if (!pointerDrag.active) return
          const t = e.changedTouches?.[0]
          if (!t) return
          e.preventDefault()
          finishPointerDrag({ pointerId: 1, clientX: t.clientX, clientY: t.clientY })
        },
        { passive: false },
      )
      row.addEventListener(
        'touchcancel',
        (e) => {
          if (!pointerDrag.active) return
          e.preventDefault()
          finishPointerDrag({ pointerId: 1, clientX: pointerDrag.startX, clientY: pointerDrag.startY })
        },
        { passive: false },
      )
      row.addEventListener('click', (e) => {
        e.stopPropagation()
        const tool = row.dataset.tool
        onToolSelect(tool)
      })
    }

    els.resetBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      onReset()
    })

    els.testBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      onTest()
    })

    els.resultTry.addEventListener('click', (e) => {
      e.stopPropagation()
      onTryAgain()
    })

    els.resultOverlay.addEventListener('click', (e) => {
      if (e.target === els.resultOverlay) hideResult()
    })

    els.timerBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      onToggleTimerPause()
    })

    els.soundBtn?.addEventListener('click', (e) => {
      e.stopPropagation()
      onToggleSound()
    })

    els.undoBtn?.addEventListener('click', (e) => {
      e.stopPropagation()
      onUndo()
    })
    els.redoBtn?.addEventListener('click', (e) => {
      e.stopPropagation()
      onRedo()
    })
  }

  wire()
  hideResult()

  return {
    setHint,
    setActiveTool,
    setInventory,
    setTimer,
    setSoundState,
    showSoundTooltip,
    setUndoRedoEnabled,
    setTestEnabled,
    checkCrownAvailability,
    initRuler,
    setRulerDot,
    showResult,
    hideResult,
    onToolSelect(fn) {
      onToolSelect = fn
    },
    onReset(fn) {
      onReset = fn
    },
    onTest(fn) {
      onTest = fn
    },
    onTryAgain(fn) {
      onTryAgain = fn
    },
    onToggleTimerPause(fn) {
      onToggleTimerPause = fn
    },
    onToggleSound(fn) {
      onToggleSound = fn
    },
    onUndo(fn) {
      onUndo = fn
    },
    onRedo(fn) {
      onRedo = fn
    },
  }
}

