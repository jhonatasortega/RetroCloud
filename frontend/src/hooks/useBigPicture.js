import { useEffect, useState } from 'react'

/**
 * Detecta se deve ativar o Big Picture mode.
 * Ativa quando: controle conectado E nenhum mouse/toque recente.
 * Desativa quando: mouse movido ou tela tocada.
 */
export function useBigPicture() {
  const [active, setActive] = useState(false)

  useEffect(() => {
    let mouseTimer = null

    const activate = () => {
      setActive(true)
      document.body.dataset.bigPicture = 'true'
    }
    const deactivate = () => {
      setActive(false)
      document.body.dataset.bigPicture = 'false'
    }

    const onGamepad = () => activate()
    const onMouse   = () => {
      // Debounce — só desativa se mouse ficar ativo por 500ms
      clearTimeout(mouseTimer)
      mouseTimer = setTimeout(deactivate, 500)
    }
    const onTouch = () => deactivate()

    // Detecta controle via poll
    let rafId
    const poll = () => {
      const gps = navigator.getGamepads?.() || []
      if ([...gps].some(Boolean)) activate()
      rafId = requestAnimationFrame(poll)
    }

    window.addEventListener('gamepadconnected',    onGamepad)
    window.addEventListener('gamepaddisconnected', () => {
      const gps = navigator.getGamepads?.() || []
      if (![...gps].some(Boolean)) deactivate()
    })
    window.addEventListener('mousemove', onMouse, { passive: true })
    window.addEventListener('touchstart', onTouch, { passive: true })

    rafId = requestAnimationFrame(poll)

    return () => {
      window.removeEventListener('gamepadconnected',    onGamepad)
      window.removeEventListener('mousemove', onMouse)
      window.removeEventListener('touchstart', onTouch)
      cancelAnimationFrame(rafId)
      clearTimeout(mouseTimer)
    }
  }, [])

  return active
}
