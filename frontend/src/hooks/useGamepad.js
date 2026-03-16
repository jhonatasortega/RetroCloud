import { useEffect, useRef, useCallback } from 'react'

export const BTN = {
  A: 0, B: 1, X: 2, Y: 3,
  LB: 4, RB: 5, LT: 6, RT: 7,
  SELECT: 8, START: 9,
  L3: 10, R3: 11,
  UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15,
  GUIDE: 16,
}

const DEADZONE = 0.4
const REPEAT_DELAY = 400   // ms antes de começar repeat
const REPEAT_RATE  = 130   // ms entre repeats

function getFocusable() {
  return Array.from(document.querySelectorAll('[data-gamepad-item]:not([disabled])'))
}

function movefocus(dir) {
  const items = getFocusable()
  if (!items.length) { return }

  const current = document.activeElement
  const idx = items.indexOf(current)

  // Nenhum item focado — foca o primeiro
  if (idx === -1) {
    items[0]?.focus()
    items[0]?.scrollIntoView({ block: 'nearest' })
    return
  }

  const rect = current.getBoundingClientRect()
  let best = null, bestScore = Infinity

  for (const item of items) {
    if (item === current) continue
    const r = item.getBoundingClientRect()
    const cx = r.left + r.width  / 2
    const cy = r.top  + r.height / 2
    const ex = rect.left + rect.width  / 2
    const ey = rect.top  + rect.height / 2
    const dx = cx - ex
    const dy = cy - ey

    // Verifica se está na direção correta
    const inDir =
      (dir === 'down'  && dy >  30) ||
      (dir === 'up'    && dy < -30) ||
      (dir === 'right' && dx >  30) ||
      (dir === 'left'  && dx < -30)

    if (!inDir) continue

    // Score: distância primária + penalidade por desvio lateral
    const primary   = (dir === 'down' || dir === 'up') ? Math.abs(dy) : Math.abs(dx)
    const secondary = (dir === 'down' || dir === 'up') ? Math.abs(dx) : Math.abs(dy)
    const score = primary + secondary * 0.6

    if (score < bestScore) { bestScore = score; best = item }
  }

  // Fallback linear se não encontrou nada na direção
  if (!best) {
    const next = (dir === 'down' || dir === 'right')
      ? items[Math.min(idx + 1, items.length - 1)]
      : items[Math.max(idx - 1, 0)]
    best = next
  }

  best?.focus()
  best?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}

// ── Hook principal de navegação global ────────────────────────────────────────
export function useGamepadNavigation({ onBack, onEnter } = {}) {
  const animRef  = useRef(null)
  const prevBtns = useRef({})
  const prevAxes = useRef({})
  const heldDir  = useRef(null)
  const heldAt   = useRef(0)
  const lastRepeat = useRef(0)

  const poll = useCallback(() => {
    const gps = navigator.getGamepads?.() || []
    const now = performance.now()

    for (const gp of gps) {
      if (!gp) continue
      const prev = prevBtns.current[gp.index] || {}
      const pax  = prevAxes.current[gp.index] || {}

      const pressed   = (i) => gp.buttons[i]?.pressed || false
      const wasPressed = (i) => prev[i] || false
      const justPressed = (i) => pressed(i) && !wasPressed(i)

      // D-pad direcional
      const dirs = {
        down:  pressed(BTN.DOWN)  || (gp.axes[1] || 0) >  DEADZONE,
        up:    pressed(BTN.UP)    || (gp.axes[1] || 0) < -DEADZONE,
        right: pressed(BTN.RIGHT) || (gp.axes[0] || 0) >  DEADZONE,
        left:  pressed(BTN.LEFT)  || (gp.axes[0] || 0) < -DEADZONE,
      }
      const prevDirs = {
        down:  wasPressed(BTN.DOWN)  || (pax.ay || 0) >  DEADZONE,
        up:    wasPressed(BTN.UP)    || (pax.ay || 0) < -DEADZONE,
        right: wasPressed(BTN.RIGHT) || (pax.ax || 0) >  DEADZONE,
        left:  wasPressed(BTN.LEFT)  || (pax.ax || 0) < -DEADZONE,
      }

      // Navegação com repeat ao segurar
      for (const dir of ['down', 'up', 'right', 'left']) {
        if (dirs[dir] && !prevDirs[dir]) {
          // Pressionou agora
          movefocus(dir)
          heldDir.current = dir
          heldAt.current  = now
          lastRepeat.current = now
        } else if (dirs[dir] && heldDir.current === dir) {
          // Segurando — repeat após delay
          if (now - heldAt.current > REPEAT_DELAY &&
              now - lastRepeat.current > REPEAT_RATE) {
            movefocus(dir)
            lastRepeat.current = now
          }
        } else if (!dirs[dir] && heldDir.current === dir) {
          heldDir.current = null
        }
      }

      // A / Cross = confirmar
      if (justPressed(BTN.A)) {
        const el = document.activeElement
        if (el && el !== document.body) {
          el.click()
          onEnter?.(el)
        } else {
          const first = getFocusable()[0]
          first?.focus()
        }
      }

      // B / Circle = voltar
      if (justPressed(BTN.B)) onBack?.()

      // RB / LB = pular 4 itens
      if (justPressed(BTN.RB)) { for (let i = 0; i < 4; i++) movefocus('down') }
      if (justPressed(BTN.LB)) { for (let i = 0; i < 4; i++) movefocus('up') }

      // Salva estado
      const newPrev = {}
      gp.buttons.forEach((b, i) => { newPrev[i] = b.pressed })
      prevBtns.current[gp.index] = newPrev
      prevAxes.current[gp.index] = { ax: gp.axes[0] || 0, ay: gp.axes[1] || 0 }
    }

    animRef.current = requestAnimationFrame(poll)
  }, [onBack, onEnter])

  useEffect(() => {
    animRef.current = requestAnimationFrame(poll)
    return () => cancelAnimationFrame(animRef.current)
  }, [poll])
}

// ── Hook simples para ações pontuais (player, menu) ───────────────────────────
export function useGamepad({ onAction } = {}) {
  const animRef = useRef(null)
  const prevRef = useRef({})

  const poll = useCallback(() => {
    const gps = navigator.getGamepads?.() || []
    for (const gp of gps) {
      if (!gp) continue
      const prev = prevRef.current[gp.index] || {}
      gp.buttons.forEach((btn, i) => {
        if (btn.pressed && !prev[i]) onAction?.(i, gp)
        prev[i] = btn.pressed
      })
      prevRef.current[gp.index] = prev
    }
    animRef.current = requestAnimationFrame(poll)
  }, [onAction])

  useEffect(() => {
    animRef.current = requestAnimationFrame(poll)
    return () => cancelAnimationFrame(animRef.current)
  }, [poll])
}
