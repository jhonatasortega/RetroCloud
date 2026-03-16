import { useEffect, useRef, useCallback } from 'react'

export const BTN = {
  A: 0, B: 1, X: 2, Y: 3,
  LB: 4, RB: 5, LT: 6, RT: 7,
  SELECT: 8, START: 9,
  L3: 10, R3: 11,
  UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15,
  GUIDE: 16,
}

// Navegação global por controle em qualquer lista com [data-gamepad-item]
export function useGamepadNavigation({ onBack, onEnter } = {}) {
  const animRef  = useRef(null)
  const prevRef  = useRef({})
  const heldRef  = useRef({})   // para repeat ao segurar
  const heldTime = useRef({})

  const getFocusable = () =>
    Array.from(document.querySelectorAll(
      '[data-gamepad-item]:not([disabled]), [data-gamepad-item]:not([aria-disabled="true"])'
    ))

  const move = useCallback((dir) => {
    const items   = getFocusable()
    if (!items.length) return
    const current = document.activeElement
    const idx     = items.indexOf(current)

    if (idx === -1) {
      items[0]?.focus()
      return
    }

    // Tenta navegar em grade (busca item mais próximo na direção)
    const rect = current.getBoundingClientRect()
    let best = null, bestDist = Infinity

    for (const item of items) {
      if (item === current) continue
      const r = item.getBoundingClientRect()
      const dx = r.left + r.width  / 2 - (rect.left + rect.width  / 2)
      const dy = r.top  + r.height / 2 - (rect.top  + rect.height / 2)

      let inDir = false
      if (dir === 'down'  && dy >  20) inDir = true
      if (dir === 'up'    && dy < -20) inDir = true
      if (dir === 'right' && dx >  20) inDir = true
      if (dir === 'left'  && dx < -20) inDir = true

      if (!inDir) continue

      // Penaliza desvio lateral para favorecer alinhamento
      const primary   = dir === 'down' || dir === 'up' ? Math.abs(dy) : Math.abs(dx)
      const secondary = dir === 'down' || dir === 'up' ? Math.abs(dx) : Math.abs(dy)
      const dist = primary + secondary * 0.5

      if (dist < bestDist) { bestDist = dist; best = item }
    }

    if (best) {
      best.focus()
      best.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    } else {
      // Fallback linear
      const next = dir === 'down' || dir === 'right'
        ? items[Math.min(idx + 1, items.length - 1)]
        : items[Math.max(idx - 1, 0)]
      next?.focus()
      next?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [])

  const poll = useCallback(() => {
    const gps = navigator.getGamepads?.() || []
    const now = performance.now()

    for (const gp of gps) {
      if (!gp) continue
      const prev = prevRef.current[gp.index] || {}

      const pressed = (i) => gp.buttons[i]?.pressed
      const justPressed = (i) => pressed(i) && !prev[i]
      const held = (i) => {
        if (!pressed(i)) { heldRef.current[i] = false; heldTime.current[i] = 0; return false }
        if (justPressed(i)) { heldRef.current[i] = true; heldTime.current[i] = now; return false }
        return heldRef.current[i] && (now - heldTime.current[i]) > 400 &&
               (now - (heldTime.current[`last_${i}`] || 0)) > 120
      }
      const fire = (i, action) => {
        if (justPressed(i) || held(i)) { heldTime.current[`last_${i}`] = now; action() }
      }

      // Analógico como D-pad
      const ax = gp.axes[0] || 0
      const ay = gp.axes[1] || 0
      const axL = ax < -0.5, axR = ax > 0.5, ayU = ay < -0.5, ayD = ay > 0.5

      fire(BTN.DOWN,  () => move('down'))
      fire(BTN.UP,    () => move('up'))
      fire(BTN.RIGHT, () => move('right'))
      fire(BTN.LEFT,  () => move('left'))
      if ((axD || ayD) && !(prev.axD || prev.ayD)) move('down')
      if ((axU || ayU) && !(prev.axU || prev.ayU)) move('up')  // typo fix below
      if (axR && !prev.axR) move('right')
      if (axL && !prev.axL) move('left')
      if ((ay < -0.5) && !(prev.ayU)) move('up')
      if ((ay > 0.5)  && !(prev.ayD)) move('down')

      // A = Enter/clique
      if (justPressed(BTN.A)) {
        const el = document.activeElement
        if (el && el !== document.body) {
          el.click()
          onEnter?.(el)
        } else {
          getFocusable()[0]?.focus()
        }
      }

      // B = Voltar
      if (justPressed(BTN.B)) onBack?.()

      // RB/LB = scroll rápido
      if (justPressed(BTN.RB)) { for(let i=0;i<4;i++) move('down') }
      if (justPressed(BTN.LB)) { for(let i=0;i<4;i++) move('up') }

      const newPrev = {}
      gp.buttons.forEach((b, i) => { newPrev[i] = b.pressed })
      newPrev.axL = axL; newPrev.axR = axR
      newPrev.ayU = ay < -0.5; newPrev.ayD = ay > 0.5
      prevRef.current[gp.index] = newPrev
    }

    animRef.current = requestAnimationFrame(poll)
  }, [move, onBack, onEnter])

  useEffect(() => {
    animRef.current = requestAnimationFrame(poll)
    return () => cancelAnimationFrame(animRef.current)
  }, [poll])
}

// Hook simples para ações pontuais (ex: player)
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
