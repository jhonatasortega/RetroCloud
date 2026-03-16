import { useEffect, useState } from 'react'

/**
 * Modos de entrada:
 * desktop  → mouse ou teclado (PC)
 * touch    → tela touch (celular/tablet)
 * gamepad  → controle físico
 */
export function useInputMode() {
  const [mode, setMode] = useState('desktop')

  useEffect(() => {
    let gamepadPollId = null
    let lastGamepadState = {}

    const set = (m) => {
      setMode(m)
      document.body.dataset.inputMode = m
    }

    // Touch
    const onTouch = () => set('touch')

    // Desktop (mouse ou teclado — tratamos igual)
    const onDesktop = (e) => {
      if (['Meta','Control','Alt','Shift'].includes(e.key)) return
      set('desktop')
    }
    const onMouse = () => {
      // Só volta para desktop se não for touch device
      if (!navigator.maxTouchPoints) set('desktop')
    }

    // Gamepad
    const pollGamepad = () => {
      const gps = navigator.getGamepads?.() || []
      for (const gp of gps) {
        if (!gp) continue
        const prev = lastGamepadState[gp.index] || {}
        const anyBtn  = gp.buttons.some((b, i) => b.pressed && !prev[i])
        const anyAxis = gp.axes.some((a, i) => Math.abs(a) > 0.3 && Math.abs(prev[`ax${i}`] || 0) <= 0.3)
        if (anyBtn || anyAxis) set('gamepad')
        const next = {}
        gp.buttons.forEach((b, i) => { next[i] = b.pressed })
        gp.axes.forEach((a, i) => { next[`ax${i}`] = a })
        lastGamepadState[gp.index] = next
      }
      gamepadPollId = requestAnimationFrame(pollGamepad)
    }

    window.addEventListener('touchstart',  onTouch,   { passive: true })
    window.addEventListener('keydown',     onDesktop, { passive: true })
    window.addEventListener('mousemove',   onMouse,   { passive: true })
    window.addEventListener('gamepadconnected', () => set('gamepad'))

    // Detecta touch na inicialização
    const initialMode = navigator.maxTouchPoints > 0 ? 'touch' : 'desktop'
    set(initialMode)

    gamepadPollId = requestAnimationFrame(pollGamepad)

    return () => {
      window.removeEventListener('touchstart',  onTouch)
      window.removeEventListener('keydown',     onDesktop)
      window.removeEventListener('mousemove',   onMouse)
      cancelAnimationFrame(gamepadPollId)
    }
  }, [])

  return mode
}
