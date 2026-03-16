import { useEffect, useRef, useCallback } from 'react'

// Mapeamento de botões padrão (PS/Xbox)
const BTN = {
  A: 0,        // X (PS) / A (Xbox)
  B: 1,        // Circle / B
  X: 2,        // Square / X
  Y: 3,        // Triangle / Y
  LB: 4,       // L1 / LB
  RB: 5,       // R1 / RB
  LT: 6,       // L2 / LT
  RT: 7,       // R2 / RT
  SELECT: 8,
  START: 9,
  UP: 12,
  DOWN: 13,
  LEFT: 14,
  RIGHT: 15,
}

export function useGamepad({ onAction } = {}) {
  const animRef = useRef(null)
  const prevRef = useRef({})
  const connectedRef = useRef(false)

  const poll = useCallback(() => {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : []
    for (const gp of gamepads) {
      if (!gp) continue
      connectedRef.current = true
      const prev = prevRef.current[gp.index] || {}

      // Detectar botões que acabaram de ser pressionados (edge trigger)
      gp.buttons.forEach((btn, i) => {
        const wasPressed = prev[i] || false
        const isPressed  = btn.pressed
        if (isPressed && !wasPressed && onAction) {
          onAction(i, gp)
        }
        if (prev[i] !== undefined) prev[i] = isPressed
        else prev[i] = isPressed
      })

      // Analógico esquerdo como D-pad (threshold 0.5)
      const ax = gp.axes[0] || 0
      const ay = gp.axes[1] || 0
      if (ax < -0.5 && !prev['axLeft'])  { prev['axLeft'] = true;  onAction?.(BTN.LEFT,  gp) }
      if (ax >  0.5 && !prev['axRight']) { prev['axRight'] = true; onAction?.(BTN.RIGHT, gp) }
      if (ay < -0.5 && !prev['axUp'])    { prev['axUp'] = true;    onAction?.(BTN.UP,    gp) }
      if (ay >  0.5 && !prev['axDown'])  { prev['axDown'] = true;  onAction?.(BTN.DOWN,  gp) }
      if (ax >= -0.5) prev['axLeft']  = false
      if (ax <=  0.5) prev['axRight'] = false
      if (ay >= -0.5) prev['axUp']    = false
      if (ay <=  0.5) prev['axDown']  = false

      prevRef.current[gp.index] = prev
    }
    animRef.current = requestAnimationFrame(poll)
  }, [onAction])

  useEffect(() => {
    const onConnect    = (e) => { connectedRef.current = true; console.log('[Gamepad] conectado:', e.gamepad.id) }
    const onDisconnect = (e) => { console.log('[Gamepad] desconectado:', e.gamepad.id) }
    window.addEventListener('gamepadconnected',    onConnect)
    window.addEventListener('gamepaddisconnected', onDisconnect)
    animRef.current = requestAnimationFrame(poll)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('gamepadconnected',    onConnect)
      window.removeEventListener('gamepaddisconnected', onDisconnect)
    }
  }, [poll])

  return { BTN, isConnected: () => connectedRef.current }
}

// Hook para navegar em listas com o controle (D-pad + A para selecionar)
export function useGamepadNavigation({ items, onSelect, onBack }) {
  const indexRef = useRef(0)

  const onAction = useCallback((btn) => {
    const max = items?.length || 0
    if (btn === BTN.DOWN || btn === BTN.RIGHT) {
      indexRef.current = Math.min(indexRef.current + 1, max - 1)
      document.querySelectorAll('[data-gamepad-item]')[indexRef.current]?.focus()
    }
    if (btn === BTN.UP || btn === BTN.LEFT) {
      indexRef.current = Math.max(indexRef.current - 1, 0)
      document.querySelectorAll('[data-gamepad-item]')[indexRef.current]?.focus()
    }
    if (btn === BTN.A) onSelect?.(indexRef.current)
    if (btn === BTN.B) onBack?.()
  }, [items, onSelect, onBack])

  useGamepad({ onAction })
}
