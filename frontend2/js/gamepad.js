/**
 * Gamepad handler — poll unificado, sem conflito entre páginas.
 * Uso: import { onGamepad, startGamepad, stopGamepad } from './gamepad.js'
 * onGamepad((btn, type) => { ... })  // type: 'press' | 'hold'
 */

let _handlers = []
let _animId   = null
let _prev     = {}
let _held     = {}
const HOLD_DELAY  = 400
const HOLD_REPEAT = 130

export function onGamepad(fn) {
  _handlers.push(fn)
  return () => { _handlers = _handlers.filter(h => h !== fn) }
}

export function offGamepad(fn) {
  _handlers = _handlers.filter(h => h !== fn)
}

export function clearGamepadHandlers() {
  _handlers = []
}

function emit(btn, type) {
  _handlers.forEach(h => h(btn, type))
}

function poll() {
  const gps = navigator.getGamepads?.() || []
  const now  = performance.now()

  for (const gp of gps) {
    if (!gp) continue
    const prev = _prev[gp.index] || {}

    gp.buttons.forEach((btn, i) => {
      const down    = btn.pressed
      const wasDown = !!prev[i]

      if (down && !wasDown) {
        // Just pressed
        emit(i, 'press')
        _held[i] = { start: now, last: now }
      } else if (!down && wasDown) {
        // Released
        delete _held[i]
      } else if (down && wasDown && _held[i]) {
        // Holding
        const h = _held[i]
        if ((now - h.start) > HOLD_DELAY && (now - h.last) > HOLD_REPEAT) {
          h.last = now
          emit(i, 'hold')
        }
      }
    })

    // Axes como D-pad virtual (botões 100-103)
    const ax = gp.axes[0] || 0
    const ay = gp.axes[1] || 0
    const pax = prev._ax || 0
    const pay = prev._ay || 0

    if (ax < -0.5 && pax >= -0.5) emit(14, 'press')  // Left
    if (ax >  0.5 && pax <=  0.5) emit(15, 'press')  // Right
    if (ay < -0.5 && pay >= -0.5) emit(12, 'press')  // Up
    if (ay >  0.5 && pay <=  0.5) emit(13, 'press')  // Down

    // Axes hold
    ;[['axL', ax < -0.5, 14], ['axR', ax > 0.5, 15],
      ['axU', ay < -0.5, 12], ['axD', ay > 0.5, 13]].forEach(([k, active, btn]) => {
      if (active) {
        if (!_held[k]) _held[k] = { start: now, last: now }
        else {
          const h = _held[k]
          if ((now - h.start) > HOLD_DELAY && (now - h.last) > HOLD_REPEAT) {
            h.last = now
            emit(btn, 'hold')
          }
        }
      } else {
        delete _held[k]
      }
    })

    _prev[gp.index] = Object.fromEntries(gp.buttons.map((b,i) => [i, b.pressed]))
    _prev[gp.index]._ax = ax
    _prev[gp.index]._ay = ay
  }

  _animId = requestAnimationFrame(poll)
}

export function startGamepad() {
  if (_animId) return
  // Snapshot estado atual para evitar "just pressed" falso
  const gps = navigator.getGamepads?.() || []
  for (const gp of gps) {
    if (!gp) continue
    _prev[gp.index] = Object.fromEntries(gp.buttons.map((b,i) => [i, b.pressed]))
  }
  _animId = requestAnimationFrame(poll)
}

export function stopGamepad() {
  if (_animId) cancelAnimationFrame(_animId)
  _animId = null
  _handlers = []
  _held = {}
}

// Detecta se tem controle conectado
export function hasGamepad() {
  return [...(navigator.getGamepads?.() || [])].some(Boolean)
}

// Botões padrão
export const BTN = {
  A: 0, B: 1, X: 2, Y: 3,
  LB: 4, RB: 5, LT: 6, RT: 7,
  SELECT: 8, START: 9,
  L3: 10, R3: 11,
  UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15,
  GUIDE: 16,
}
