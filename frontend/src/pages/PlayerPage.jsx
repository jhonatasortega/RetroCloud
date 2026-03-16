import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '@/lib/api'
import TouchGamepad from '@/components/TouchGamepad'

const CORE_MAP = {
  ps1: 'psx', psx: 'psx', snes: 'snes', n64: 'n64',
  gba: 'gba', gbc: 'gbc', gb: 'gb',
  megadrive: 'segaMD', genesis: 'segaMD', md: 'segaMD', nes: 'nes',
}
const GUIDE_BTN = 16

export default function PlayerPage() {
  const { id } = useParams()
  const animRef    = useRef(null)
  const prevBtns   = useRef({})
  const ejsStarted = useRef(false)  // guard contra duplo init

  const [game, setGame]             = useState(null)
  const [playInfo, setPlay]         = useState(null)
  const [menuOpen, setMenuOpen]     = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [gamepadConnected, setGamepadConnected] = useState(false)
  const [showTouch, setShowTouch]   = useState(false)
  const [error, setError]           = useState('')
  const fromRV = useRef(sessionStorage.getItem('from_rv') === '1')

  const goBack = useCallback(() => {
    try { window.EJS_emulator?.pause?.() } catch {}
    sessionStorage.removeItem('from_rv')
    window.location.replace(fromRV.current ? '/?rv=1' : '/')
  }, [])

  // Detecta controle, touch e fullscreen
  useEffect(() => {
    const checkGp = () => setGamepadConnected([...(navigator.getGamepads?.() || [])].some(Boolean))
    const updateTouch = () => {
      const isTouch   = document.body.dataset.inputMode === 'touch'
      const hasGamepad = [...(navigator.getGamepads?.() || [])].some(Boolean)
      setShowTouch(isTouch && !hasGamepad)
    }
    const onFs = () => setFullscreen(!!document.fullscreenElement)

    window.addEventListener('gamepadconnected',    checkGp)
    window.addEventListener('gamepaddisconnected', checkGp)
    document.addEventListener('fullscreenchange',  onFs)
    checkGp()
    updateTouch()

    const obs = new MutationObserver(updateTouch)
    obs.observe(document.body, { attributes: true, attributeFilter: ['data-input-mode'] })

    return () => {
      window.removeEventListener('gamepadconnected',    checkGp)
      window.removeEventListener('gamepaddisconnected', checkGp)
      document.removeEventListener('fullscreenchange',  onFs)
      obs.disconnect()
    }
  }, [])

  // Carrega dados — seta tudo de uma vez para evitar double render
  useEffect(() => {
    Promise.all([api.game(id), api.play(id)])
      .then(([gd, pd]) => {
        setGame(gd.game)
        setPlay(pd)
      })
      .catch(e => setError(e.message))
  }, [id])

  // Inicia EmulatorJS — uma única vez graças ao guard ejsStarted
  useEffect(() => {
    if (!game || !playInfo) return
    if (ejsStarted.current) return  // GUARD: não inicia duas vezes
    ejsStarted.current = true

    const sysKey  = game.sistema?.toLowerCase()
    const core    = CORE_MAP[sysKey] || sysKey
    const romFile = playInfo.emulator_url
      ? `/roms/${sysKey}/${playInfo.emulator_url.split('/').pop()}` : ''

    // Limpa instância anterior
    document.getElementById('emulatorjs-script')?.remove()
    document.getElementById('ejs-hide-ui')?.remove()
    try { window.EJS_emulator?.pause?.() } catch {}
    Object.keys(window).filter(k => k.startsWith('EJS_') || k === 'EJS_STORAGE')
      .forEach(k => { try { delete window[k] } catch {} })

    let tries = 0
    const init = () => {
      const el = document.getElementById('emulator-container')
      if (!el || el.offsetWidth === 0) {
        if (tries++ < 30) setTimeout(init, 100)
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

      const st = document.createElement('style')
      st.id = 'ejs-hide-ui'
      st.textContent = `
        #emulator-container .ejs_menu_bar { display: none !important; }
        #emulator-container .ejs_volume_bar { display: none !important; }
        #emulator-container .ejs_ctx_menu { display: none !important; }
        #emulator-container canvas { display: block !important; }
      `
      document.head.appendChild(st)

      const script = document.createElement('script')
      script.id  = 'emulatorjs-script'
      script.src = `https://cdn.emulatorjs.org/stable/data/loader.js?t=${Date.now()}`
      script.onload = () => setTimeout(() => window.dispatchEvent(new Event('resize')), 500)
      document.body.appendChild(script)
    }

    setTimeout(init, 200)

    return () => {
      ejsStarted.current = false
      document.getElementById('emulatorjs-script')?.remove()
      document.getElementById('ejs-hide-ui')?.remove()
      try { window.EJS_emulator?.pause?.() } catch {}
    }
  }, [game, playInfo])

  // Inicializa prevBtns com estado ATUAL — evita botões vazarem do RetroVision
  useEffect(() => {
    const snapshot = () => {
      const gps = navigator.getGamepads?.() || []
      for (const gp of gps) {
        if (!gp) continue
        prevBtns.current[gp.index] = Object.fromEntries(gp.buttons.map((b,i) => [i, b.pressed]))
      }
    }
    // Tira snapshot imediato e 300ms depois (garante capturar botão ainda pressionado)
    snapshot()
    const t = setTimeout(snapshot, 300)
    return () => clearTimeout(t)
  }, [])

  // Poll — GUIDE abre/fecha menu. Detecta só na DESCIDA (justPressed)
  const pollGamepad = useCallback(() => {
    const gps = navigator.getGamepads?.() || []
    for (const gp of gps) {
      if (!gp) continue
      const prev     = prevBtns.current[gp.index] || {}
      const newState = Object.fromEntries(gp.buttons.map((b,i) => [i, b.pressed]))
      // justPressed = estava solto, agora está pressionado
      if (newState[GUIDE_BTN] && !prev[GUIDE_BTN]) {
        setMenuOpen(m => !m)
      }
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
    } else {
      document.exitFullscreen?.()
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
              <span className="text-xs text-green-400 bg-green-900/30 px-2 py-1 rounded">🕹</span>
            )}
            <button onClick={() => setMenuOpen(true)}
              className="text-steam-muted hover:text-steam-accent text-xs px-3 py-1.5 border border-steam-border rounded">
              ☰ Menu
            </button>
            <button onClick={toggleFullscreen}
              className="text-steam-muted hover:text-steam-accent text-xs px-3 py-1.5 border border-steam-border rounded">
              ⊞
            </button>
          </div>
        </div>
      )}

      <div id="player-wrap" className="flex-1 relative bg-black">
        <div id="emulator-container"
          style={{
            width: '100%',
            height: fullscreen ? '100vh' : showTouch ? 'calc(100vh - 208px)' : 'calc(100vh - 48px)',
            minHeight: 400, display: 'block', background: '#000',
          }} />

        {/* Botões flutuantes em fullscreen — dentro do player-wrap para aparecer em fullscreen */}
        {fullscreen && (
          <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 9999, display: 'flex', gap: 8 }}>
            <button onClick={() => setMenuOpen(true)}
              style={{ background: 'rgba(0,0,0,0.7)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, padding: '8px 14px', fontSize: 18, cursor: 'pointer' }}>
              ☰
            </button>
            <button onClick={toggleFullscreen}
              style={{ background: 'rgba(0,0,0,0.7)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, padding: '8px 14px', fontSize: 16, cursor: 'pointer' }}>
              ✕
            </button>
          </div>
        )}

        {gamepadConnected && !menuOpen && <ControlHint />}

        {/* Menu dentro do player-wrap — aparece em fullscreen */}
        {menuOpen && (
          <GameMenu game={game}
            onClose={() => setMenuOpen(false)}
            onBack={() => { setMenuOpen(false); goBack() }}
            onFullscreen={() => { setMenuOpen(false); toggleFullscreen() }} />
        )}
      </div>

      <TouchGamepad visible={showTouch} />
    </div>
  )
}

function GameMenu({ game, onClose, onBack, onFullscreen }) {
  const [selected, setSelected] = useState(0)
  const prevRef = useRef({})
  const animRef = useRef(null)

  const items = [
    { icon: '▶', label: 'Continuar',       action: onClose },
    { icon: '⊞', label: 'Tela cheia',      action: onFullscreen },
    { icon: '💾', label: 'Salvar estado',   action: () => { window.EJS_emulator?.saveState?.(); onClose() } },
    { icon: '📂', label: 'Carregar estado', action: () => { window.EJS_emulator?.loadState?.(); onClose() } },
    { icon: '🔄', label: 'Reiniciar',       action: () => { window.EJS_emulator?.restart?.(); onClose() } },
    { icon: '←',  label: 'Sair do jogo',   action: onBack },
  ]

  useEffect(() => {
    const fn = (e) => {
      if (e.key === 'ArrowDown') setSelected(s => Math.min(s+1, items.length-1))
      if (e.key === 'ArrowUp')   setSelected(s => Math.max(s-1, 0))
      if (e.key === 'Enter')     items[selected]?.action()
      if (e.key === 'Escape')    onClose()
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [selected, items, onClose])

  useEffect(() => {
    // Inicializa prev com estado atual para não disparar no mount
    const gps = navigator.getGamepads?.() || []
    for (const gp of gps) {
      if (!gp) continue
      prevRef.current[gp.index] = Object.fromEntries(gp.buttons.map((b,i) => [i, b.pressed]))
    }

    const poll = () => {
      const gps2 = navigator.getGamepads?.() || []
      for (const gp of gps2) {
        if (!gp) continue
        const prev = prevRef.current[gp.index] || {}
        const just = (i) => gp.buttons[i]?.pressed && !prev[i]
        const ay   = gp.axes[1] || 0
        const pay  = prevRef.current[`ay${gp.index}`] || 0
        if (just(12) || (ay < -0.5 && pay >= -0.5)) setSelected(s => Math.max(s-1, 0))
        if (just(13) || (ay >  0.5 && pay <=  0.5)) setSelected(s => Math.min(s+1, items.length-1))
        if (just(0)) items[selected]?.action()
        if (just(1) || just(GUIDE_BTN)) onClose()
        prevRef.current[gp.index] = Object.fromEntries(gp.buttons.map((b,i) => [i, b.pressed]))
        prevRef.current[`ay${gp.index}`] = ay
      }
      animRef.current = requestAnimationFrame(poll)
    }
    animRef.current = requestAnimationFrame(poll)
    return () => cancelAnimationFrame(animRef.current)
  }, [selected, items, onClose])

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-steam-card border border-steam-border rounded-2xl overflow-hidden w-80 shadow-2xl">
        <div className="px-6 py-4 border-b border-steam-border bg-steam-panel flex items-center gap-3">
          <span className="text-2xl">🎮</span>
          <div>
            <p className="text-white font-medium text-sm">{game?.nome}</p>
            <p className="text-steam-muted text-xs">{game?.sistema?.toUpperCase()}</p>
          </div>
        </div>
        <div className="py-2">
          {items.map((item, i) => (
            <button key={i} onClick={item.action} onMouseEnter={() => setSelected(i)}
              className={`w-full flex items-center gap-4 px-6 py-3 text-sm transition-colors text-left
                ${i===selected ? 'bg-steam-accent text-steam-bg font-medium' : 'text-steam-text hover:bg-steam-panel'}`}>
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
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 4000)
    return () => clearTimeout(t)
  }, [])
  if (!visible) return null
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/70 text-steam-muted
                    text-xs px-4 py-2 rounded-full border border-steam-border pointer-events-none">
      Guide para abrir o menu
    </div>
  )
}
