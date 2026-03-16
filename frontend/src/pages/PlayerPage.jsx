import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import TouchGamepad from '@/components/TouchGamepad'

const CORE_MAP = {
  ps1: 'psx', psx: 'psx',
  snes: 'snes', n64: 'n64',
  gba: 'gba', gbc: 'gbc', gb: 'gb',
  megadrive: 'segaMD', genesis: 'segaMD', md: 'segaMD',
  nes: 'nes',
}

// Apenas Guide/PS abre o menu — Start e Select ficam livres pro jogo
const MENU_BTNS = [16]

export default function PlayerPage() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const containerRef = useRef(null)
  const animRef      = useRef(null)
  const prevBtns     = useRef({})
  const mountTime    = useRef(Date.now())
  const emulationMode = import.meta.env.VITE_EMULATION_MODE || 'local'

  const [game, setGame]         = useState(null)
  const [playInfo, setPlay]     = useState(null)
  const [ready, setReady]       = useState(false)  // true quando dados carregados
  const [ejsLoaded, setEjsLoaded] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [gamepadConnected, setGamepadConnected] = useState(false)
  const [showTouch, setShowTouch] = useState(false)
  const [error, setError]       = useState('')

  // Detecta controle e touch
  useEffect(() => {
    const checkGp = () => setGamepadConnected([...(navigator.getGamepads?.() || [])].some(Boolean))
    window.addEventListener('gamepadconnected',    checkGp)
    window.addEventListener('gamepaddisconnected', checkGp)
    checkGp()
    setShowTouch(navigator.maxTouchPoints > 0)
    const obs = new MutationObserver(() => setShowTouch(document.body.dataset.inputMode === 'touch'))
    obs.observe(document.body, { attributes: true, attributeFilter: ['data-input-mode'] })
    return () => {
      window.removeEventListener('gamepadconnected', checkGp)
      window.removeEventListener('gamepaddisconnected', checkGp)
      obs.disconnect()
    }
  }, [])

  // Carrega dados do jogo
  useEffect(() => {
    Promise.all([api.game(id), api.play(id)])
      .then(([gd, pd]) => { setGame(gd.game); setPlay(pd); setReady(true) })
      .catch(e => setError(e.message))
  }, [id])

  // Inicia EmulatorJS quando pronto E container montado
  useEffect(() => {
    if (!ready || !game || !playInfo) return

    const sysKey  = game.sistema?.toLowerCase()
    const core    = CORE_MAP[sysKey] || sysKey
    const romFile = playInfo.emulator_url
      ? `/roms/${sysKey}/${playInfo.emulator_url.split('/').pop()}`
      : ''

    // Retry até o container estar no DOM (vindo do RetroVision pode demorar um frame)
    let retries = 0
    const init = () => {
      const container = document.getElementById('emulator-container')
      if (!container) {
        if (retries++ < 20) setTimeout(init, 50)
        return
      }

      // Limpa instância anterior
      const existing = document.getElementById('emulatorjs-script')
      if (existing) existing.remove()
      try { window.EJS_emulator?.pause?.() } catch {}
      delete window.EJS_emulator

      // Configura
      window.EJS_player           = '#emulator-container'
      window.EJS_core             = core
      window.EJS_gameUrl          = romFile
      window.EJS_pathtodata       = 'https://cdn.emulatorjs.org/stable/data/'
      window.EJS_startOnLoaded    = true
      window.EJS_color            = '#66c0f4'
      window.EJS_backgroundColor  = '#000000'
      window.EJS_language         = 'en-US'
      window.EJS_Buttons = {
        playPause: false, restart: false, mute: false,
        settings: false, fullscreen: false, saveState: false,
        loadState: false, screenRecord: false, gamepad: false,
        cheat: false, volume: false, saveSavFiles: true, contextMenu: false,
      }

      // Esconde UI do EmulatorJS
      let styleEl = document.getElementById('ejs-hide-ui')
      if (!styleEl) {
        styleEl = document.createElement('style')
        styleEl.id = 'ejs-hide-ui'
        document.head.appendChild(styleEl)
      }
      styleEl.textContent = `
        #emulator-container .ejs_menu_bar,
        #emulator-container .ejs_volume_bar,
        #emulator-container [class*="menu"],
        #emulator-container [class*="toolbar"],
        #emulator-container [class*="controls"],
        #emulator-container .ejs_ctx_menu { display: none !important; }
        #emulator-container canvas { display: block !important; width: 100% !important; }
      `

      // Carrega script
      const script = document.createElement('script')
      script.id  = 'emulatorjs-script'
      script.src = 'https://cdn.emulatorjs.org/stable/data/loader.js'
      document.body.appendChild(script)
      setEjsLoaded(true)
    }

    init()

    return () => {
      const s = document.getElementById('emulatorjs-script')
      if (s) s.remove()
      const st = document.getElementById('ejs-hide-ui')
      if (st) st.remove()
      try { window.EJS_emulator?.pause?.() } catch {}
      delete window.EJS_player
      delete window.EJS_core
      delete window.EJS_gameUrl
      delete window.EJS_emulator
    }
  }, [ready, game, playInfo])

  // Poll gamepad — ignora primeiros 1200ms (flush do B do RetroVision)
  const pollGamepad = useCallback(() => {
    const sinceMount = Date.now() - mountTime.current
    const gps = navigator.getGamepads?.() || []

    for (const gp of gps) {
      if (!gp) continue
      const newState = Object.fromEntries(gp.buttons.map((b, i) => [i, b.pressed]))

      if (sinceMount >= 1200) {
        const prev = prevBtns.current[gp.index] || {}
        gp.buttons.forEach((btn, i) => {
          if (btn.pressed && !prev[i] && MENU_BTNS.includes(i)) {
            setMenuOpen(m => !m)
          }
        })
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
    const el = document.getElementById('player-wrap')
    if (!document.fullscreenElement) {
      el?.requestFullscreen?.()
      setFullscreen(true)
    } else {
      document.exitFullscreen?.()
      setFullscreen(false)
    }
  }

  // Volta sempre para a biblioteca — não usa navigate(-1) pois quebra vindo do RetroVision
  const goBack = () => navigate('/')

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
        {emulationMode === 'local' ? (
          <div
            id="emulator-container"
            ref={containerRef}
            style={{
              width: '100%',
              height: showTouch ? 'calc(100vh - 208px)' : 'calc(100vh - 48px)',
              minHeight: 480,
              display: 'block',
              background: '#000',
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
            <div className="text-6xl">☁️</div>
            <p className="text-steam-muted text-sm">Configure <code className="text-steam-accent">EMULATION_MODE=local</code> no .env.</p>
          </div>
        )}
        {gamepadConnected && <ControlHint />}
      </div>

      <TouchGamepad visible={showTouch} />

      {menuOpen && (
        <GameMenu
          game={game}
          onClose={() => setMenuOpen(false)}
          onBack={() => { setMenuOpen(false); goBack() }}
          onFullscreen={() => { setMenuOpen(false); toggleFullscreen() }}
        />
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
    { icon: '🔄', label: 'Reiniciar jogo',      action: () => { window.EJS_emulator?.restart?.(); onClose() } },
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

  // Poll do controle no menu
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
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fadein"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-steam-card border border-steam-border rounded-2xl overflow-hidden w-80 shadow-2xl">
        <div className="px-6 py-4 border-b border-steam-border bg-steam-panel flex items-center gap-3">
          {game?.thumb
            ? <img src={game.thumb} alt="" className="w-10 h-12 object-cover rounded" />
            : <span className="text-2xl">🎮</span>}
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
              <span className="w-5 text-center">{item.icon}</span>
              {item.label}
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
                    text-xs px-4 py-2 rounded-full border border-steam-border animate-fadein">
      Guide para abrir o menu
    </div>
  )
}
