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

  function setHint(text) {
    if (els.hint) els.hint.textContent = text
  }

  function setActiveTool(tool) {
    for (const row of els.rows) {
      row.classList.toggle('active', row.dataset.tool === tool)
    }
    if (!tool) setHint('Click or drag a supply onto the build area.')
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

