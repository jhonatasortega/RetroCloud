import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '@/lib/api'
import TouchGamepad from '@/components/TouchGamepad'

const CORE_MAP = {
  ps1: 'psx', psx: 'psx', snes: 'snes', n64: 'n64',
  gba: 'gba', gbc: 'gbc', gb: 'gb',
  megadrive: 'segaMD', genesis: 'segaMD', md: 'segaMD', nes: 'nes',
}

const MENU_BTNS = [16] // só Guide/PS

export default function PlayerPage() {
  const { id } = useParams()
  const animRef  = useRef(null)
  const prevBtns = useRef({})

  const [game, setGame]       = useState(null)
  const [playInfo, setPlay]   = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [gamepadConnected, setGamepadConnected] = useState(false)
  const [showTouch, setShowTouch] = useState(false)
  const [error, setError]     = useState('')

  // Determina se veio do RetroVision
  const fromRV = sessionStorage.getItem('from_rv') === '1'

  // Volta: para emulador, limpa flag, redireciona
  const goBack = useCallback(() => {
    try { window.EJS_emulator?.pause?.() } catch {}
    sessionStorage.removeItem('from_rv')
    window.location.href = fromRV ? '/?rv=1' : '/'
  }, [fromRV])

  // Detecta controle e touch
  useEffect(() => {
    const checkGp = () => setGamepadConnected([...(navigator.getGamepads?.() || [])].some(Boolean))
    window.addEventListener('gamepadconnected',    checkGp)
    window.addEventListener('gamepaddisconnected', checkGp)
    checkGp()
    // Touch só ativo quando: tem touch E não tem controle físico
    const updateTouch = () => {
      const hasTouch   = document.body.dataset.inputMode === 'touch'
      const hasGamepad = [...(navigator.getGamepads?.() || [])].some(Boolean)
      setShowTouch(hasTouch && !hasGamepad)
    }
    updateTouch()
    const obs = new MutationObserver(updateTouch)
    obs.observe(document.body, { attributes: true, attributeFilter: ['data-input-mode'] })
    return () => {
      window.removeEventListener('gamepadconnected', checkGp)
      window.removeEventListener('gamepaddisconnected', checkGp)
      obs.disconnect()
    }
  }, [])

  // Carrega dados
  useEffect(() => {
    Promise.all([api.game(id), api.play(id)])
      .then(([gd, pd]) => { setGame(gd.game); setPlay(pd) })
      .catch(e => setError(e.message))
  }, [id])

  // Inicia EmulatorJS após dados carregados
  useEffect(() => {
    if (!game || !playInfo) return

    const sysKey  = game.sistema?.toLowerCase()
    const core    = CORE_MAP[sysKey] || sysKey
    const romFile = playInfo.emulator_url
      ? `/roms/${sysKey}/${playInfo.emulator_url.split('/').pop()}` : ''

    // Remove script anterior
    document.getElementById('emulatorjs-script')?.remove()
    try { window.EJS_emulator?.pause?.() } catch {}
    delete window.EJS_emulator

    // Retry até container ter dimensões
    let tries = 0
    const init = () => {
      const el = document.getElementById('emulator-container')
      if (!el || el.offsetWidth === 0) {
        if (tries++ < 20) setTimeout(init, 50)
        return
      }

      window.EJS_player          = '#emulator-container'
      window.EJS_core            = core
      window.EJS_gameUrl         = romFile
      window.EJS_pathtodata      = 'https://cdn.emulatorjs.org/stable/data/'
      window.EJS_startOnLoaded   = true
      window.EJS_color           = '#66c0f4'
      window.EJS_backgroundColor = '#000000'
      window.EJS_language        = 'en-US'
      window.EJS_Buttons = {
        playPause: false, restart: false, mute: false, settings: false,
        fullscreen: false, saveState: false, loadState: false,
        screenRecord: false, gamepad: false, cheat: false,
        volume: false, saveSavFiles: true, contextMenu: false,
      }

      let st = document.getElementById('ejs-hide-ui')
      if (!st) { st = document.createElement('style'); st.id = 'ejs-hide-ui'; document.head.appendChild(st) }
      st.textContent = `
        #emulator-container .ejs_menu_bar, #emulator-container .ejs_volume_bar,
        #emulator-container [class*="menu"], #emulator-container [class*="toolbar"],
        #emulator-container [class*="controls"], #emulator-container .ejs_ctx_menu
        { display: none !important; }
        #emulator-container canvas { display: block !important; width: 100% !important; }
      `

      const script = document.createElement('script')
      script.id  = 'emulatorjs-script'
      script.src = 'https://cdn.emulatorjs.org/stable/data/loader.js'
      script.onload = () => {
        setTimeout(() => window.dispatchEvent(new Event('resize')), 500)
      }
      document.body.appendChild(script)
    }

    setTimeout(init, 100)

    return () => {
      document.getElementById('emulatorjs-script')?.remove()
      document.getElementById('ejs-hide-ui')?.remove()
      try { window.EJS_emulator?.pause?.() } catch {}
      delete window.EJS_player; delete window.EJS_core
      delete window.EJS_gameUrl; delete window.EJS_emulator
    }
  }, [game, playInfo])

  // Poll gamepad — inicializa prevBtns com estado atual para evitar B vazar
  useEffect(() => {
    const gps = navigator.getGamepads?.() || []
    for (const gp of gps) {
      if (!gp) continue
      prevBtns.current[gp.index] = Object.fromEntries(gp.buttons.map((b,i) => [i, b.pressed]))
    }
  }, [])

  const pollGamepad = useCallback(() => {
    const gps = navigator.getGamepads?.() || []
    for (const gp of gps) {
      if (!gp) continue
      const prev     = prevBtns.current[gp.index] || {}
      const newState = Object.fromEntries(gp.buttons.map((b,i) => [i, b.pressed]))
      gp.buttons.forEach((btn, i) => {
        if (btn.pressed && !prev[i] && MENU_BTNS.includes(i)) setMenuOpen(m => !m)
      })
      prevBtns.current[gp.index] = newState
    }
    animRef.current = requestAnimationFrame(pollGamepad)
  }, [])

  useEffect(() => {
    animRef.current = requestAnimationFrame(pollGamepad)
    return () => cancelAnimationFrame(animRef.current)
  }, [pollGamepad])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.getElementById('player-wrap')?.requestFullscreen?.()
      setFullscreen(true)
    } else {
      document.exitFullscreen?.()
      setFullscreen(false)
    }
  }

  if (error) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
      <p className="text-red-400">{error}</p>
      <button onClick={goBack} className="text-steam-accent hover:underline text-sm">← Voltar</button>
    </div>
  )

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {!fullscreen && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-steam-card border-b border-steam-border">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="text-steam-muted hover:text-steam-accent text-sm">← Voltar</button>
            <div className="h-4 w-px bg-steam-border" />
            <div>
              <p className="text-white font-medium text-sm">{game?.nome || 'Carregando...'}</p>
              <p className="text-steam-muted text-xs">{game?.sistema?.toUpperCase()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {gamepadConnected && (
              <span className="text-xs text-green-400 bg-green-900/30 px-2 py-1 rounded">🕹 Controle</span>
            )}
            <button onClick={() => setMenuOpen(true)}
              className="text-steam-muted hover:text-steam-accent text-xs px-3 py-1.5 border border-steam-border rounded">
              ☰ Menu
            </button>
            <button onClick={toggleFullscreen}
              className="text-steam-muted hover:text-steam-accent text-xs px-3 py-1.5 border border-steam-border rounded">
              ⊞ Fullscreen
            </button>
          </div>
        </div>
      )}

      <div id="player-wrap" className="flex-1 relative bg-black">
        <div id="emulator-container" ref={useRef(null)}
          style={{ width: '100%', height: showTouch ? 'calc(100vh - 208px)' : fullscreen ? '100vh' : 'calc(100vh - 48px)', minHeight: 480, display: 'block', background: '#000' }} />
        {gamepadConnected && <ControlHint />}
        {/* Botão flutuante em fullscreen */}
        {fullscreen && (
          <button onClick={() => setMenuOpen(true)}
            style={{ position: 'fixed', top: 12, right: 12, zIndex: 40, background: 'rgba(0,0,0,0.6)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '8px 14px', fontSize: 18, cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
            ☰
          </button>
        )}
      </div>

      <TouchGamepad visible={showTouch} />

      {menuOpen && (
        <GameMenu game={game}
          onClose={() => setMenuOpen(false)}
          onBack={() => { setMenuOpen(false); goBack() }}
          onFullscreen={() => { setMenuOpen(false); toggleFullscreen() }} />
      )}
    </div>
  )
}

function GameMenu({ game, onClose, onBack, onFullscreen }) {
  const [selected, setSelected] = useState(0)
  const prevRef = useRef({})
  const animRef = useRef(null)

  const items = [
    { icon: '▶', label: 'Continuar jogando', action: onClose },
    { icon: '⊞', label: 'Tela cheia',         action: onFullscreen },
    { icon: '💾', label: 'Salvar estado',       action: () => { window.EJS_emulator?.saveState?.(); onClose() } },
    { icon: '📂', label: 'Carregar estado',     action: () => { window.EJS_emulator?.loadState?.(); onClose() } },
    { icon: '🔄', label: 'Reiniciar',           action: () => { window.EJS_emulator?.restart?.(); onClose() } },
    { icon: '←',  label: 'Sair do jogo',        action: onBack },
  ]

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowDown')  setSelected(s => Math.min(s + 1, items.length - 1))
      if (e.key === 'ArrowUp')    setSelected(s => Math.max(s - 1, 0))
      if (e.key === 'Enter')      items[selected]?.action()
      if (e.key === 'Escape')     onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, items, onClose])

  useEffect(() => {
    const poll = () => {
      const gps = navigator.getGamepads?.() || []
      for (const gp of gps) {
        if (!gp) continue
        const prev = prevRef.current[gp.index] || {}
        const just = (i) => gp.buttons[i]?.pressed && !prev[i]
        const ay = gp.axes[1] || 0
        const prevAy = prevRef.current[`ay${gp.index}`] || 0
        if (just(12) || (ay < -0.5 && prevAy >= -0.5)) setSelected(s => Math.max(s - 1, 0))
        if (just(13) || (ay >  0.5 && prevAy <=  0.5)) setSelected(s => Math.min(s + 1, items.length - 1))
        if (just(0)) items[selected]?.action()
        if (just(1) || just(16)) onClose()
        prevRef.current[gp.index] = Object.fromEntries(gp.buttons.map((b,i) => [i, b.pressed]))
        prevRef.current[`ay${gp.index}`] = ay
      }
      animRef.current = requestAnimationFrame(poll)
    }
    animRef.current = requestAnimationFrame(poll)
    return () => cancelAnimationFrame(animRef.current)
  }, [selected, items, onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-steam-card border border-steam-border rounded-2xl overflow-hidden w-80 shadow-2xl">
        <div className="px-6 py-4 border-b border-steam-border bg-steam-panel flex items-center gap-3">
          {game?.thumb ? <img src={game.thumb} alt="" className="w-10 h-12 object-cover rounded" /> : <span className="text-2xl">🎮</span>}
          <div>
            <p className="text-white font-medium text-sm">{game?.nome}</p>
            <p className="text-steam-muted text-xs">{game?.sistema?.toUpperCase()}</p>
          </div>
        </div>
        <div className="py-2">
          {items.map((item, i) => (
            <button key={i} onClick={item.action} onMouseEnter={() => setSelected(i)}
              className={`w-full flex items-center gap-4 px-6 py-3 text-sm transition-colors text-left
                ${selected === i ? 'bg-steam-accent text-steam-bg font-medium' : 'text-steam-text hover:bg-steam-panel'}`}>
              <span className="w-5 text-center">{item.icon}</span>{item.label}
            </button>
          ))}
        </div>
        <div className="px-6 py-3 border-t border-steam-border">
          <p className="text-steam-muted text-xs text-center">↑↓ · A confirmar · B / Guide fechar</p>
        </div>
      </div>
    </div>
  )
}

function ControlHint() {
  const [visible, setVisible] = useState(true)
  useEffect(() => { const t = setTimeout(() => setVisible(false), 4000); return () => clearTimeout(t) }, [])
  if (!visible) return null
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/70 text-steam-muted
                    text-xs px-4 py-2 rounded-full border border-steam-border">
      Guide para abrir o menu
    </div>
  )
}
