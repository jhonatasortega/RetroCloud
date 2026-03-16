import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import TouchGamepad from '@/components/TouchGamepad'

// Mapa sistema → core do EmulatorJS
const CORE_MAP = {
  ps1: 'psx', psx: 'psx',
  snes: 'snes', n64: 'n64',
  gba: 'gba', gbc: 'gbc', gb: 'gb',
  megadrive: 'segaMD', genesis: 'segaMD', md: 'segaMD',
  nes: 'nes',
}

const MENU_BTNS = [8, 9, 16] // Select, Start, Guide

export default function PlayerPage() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const containerRef = useRef(null)
  const animRef      = useRef(null)
  const prevBtns     = useRef({})
  const emulationMode = import.meta.env.VITE_EMULATION_MODE || 'local'

  const [game, setGame]       = useState(null)
  const [playInfo, setPlay]   = useState(null)
  const [phase, setPhase]     = useState('loading')
  const [menuOpen, setMenuOpen] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [gamepadConnected, setGamepadConnected] = useState(false)
  const [showTouch, setShowTouch] = useState(false)
  const [error, setError]     = useState('')

  // Detecta controle e touch
  useEffect(() => {
    const checkGp = () => setGamepadConnected([...(navigator.getGamepads?.() || [])].some(Boolean))
    window.addEventListener('gamepadconnected',    checkGp)
    window.addEventListener('gamepaddisconnected', checkGp)
    checkGp()

    const isTouch = navigator.maxTouchPoints > 0
    setShowTouch(isTouch)
    const obs = new MutationObserver(() => {
      setShowTouch(document.body.dataset.inputMode === 'touch')
    })
    obs.observe(document.body, { attributes: true, attributeFilter: ['data-input-mode'] })

    return () => {
      window.removeEventListener('gamepadconnected',    checkGp)
      window.removeEventListener('gamepaddisconnected', checkGp)
      obs.disconnect()
    }
  }, [])

  // Carrega info do jogo
  useEffect(() => {
    Promise.all([api.game(id), api.play(id)])
      .then(([gd, pd]) => { setGame(gd.game); setPlay(pd) })
      .catch(e => { setError(e.message); setPhase('error') })
  }, [id])

  // Inicia transição quando jogo carregou
  useEffect(() => {
    if (game && playInfo && phase === 'loading') {
      setPhase('transition')
      setTimeout(() => setPhase('playing'), 3000)
    }
  }, [game, playInfo])

  // Inicia EmulatorJS quando entra em playing
  useEffect(() => {
    if (phase !== 'playing' || !game || !playInfo || !containerRef.current) return

    const sysKey  = game.sistema?.toLowerCase()
    const core    = CORE_MAP[sysKey] || sysKey
    const romFile = playInfo.emulator_url
      ? `/roms/${sysKey}/${playInfo.emulator_url.split('/').pop()}`
      : ''

    // Configura o EmulatorJS via variáveis globais
    window.EJS_player        = '#emulator-container'
    window.EJS_core          = core
    window.EJS_gameUrl       = romFile
    window.EJS_pathtodata    = 'https://cdn.emulatorjs.org/stable/data/'
    window.EJS_startOnLoaded = true
    window.EJS_fullscreenOnLoaded = false
    window.EJS_color         = '#66c0f4'
    window.EJS_backgroundColor = '#000000'

    // Carrega o script do EmulatorJS via CDN
    const existing = document.getElementById('emulatorjs-script')
    if (existing) existing.remove()

    const script = document.createElement('script')
    script.id  = 'emulatorjs-script'
    script.src = 'https://cdn.emulatorjs.org/stable/data/loader.js'
    document.body.appendChild(script)

    return () => {
      const s = document.getElementById('emulatorjs-script')
      if (s) s.remove()
    }
  }, [phase, game, playInfo])

  // Poll gamepad para abrir menu
  const pollGamepad = useCallback(() => {
    const gps = navigator.getGamepads?.() || []
    for (const gp of gps) {
      if (!gp) continue
      const prev = prevBtns.current[gp.index] || {}
      gp.buttons.forEach((btn, i) => {
        if (btn.pressed && !prev[i] && MENU_BTNS.includes(i)) {
          setMenuOpen(m => !m)
        }
        prev[i] = btn.pressed
      })
      prevBtns.current[gp.index] = prev
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

  if (phase === 'error') return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
      <p className="text-red-400">{error}</p>
      <button onClick={() => navigate('/')} className="text-steam-accent hover:underline text-sm">← Voltar</button>
    </div>
  )

  return (
    <div className="min-h-screen bg-black flex flex-col">

      {/* Transição estilo Xbox */}
      {phase === 'transition' && game && <XboxTransition game={game} />}

      {/* Player */}
      {phase === 'playing' && (
        <>
          {!fullscreen && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-steam-card border-b border-steam-border">
              <div className="flex items-center gap-3">
                <button onClick={() => navigate(-1)} className="text-steam-muted hover:text-steam-accent text-sm">← Voltar</button>
                <div className="h-4 w-px bg-steam-border" />
                <div>
                  <p className="text-white font-medium text-sm">{game?.nome}</p>
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
                style={{ width: '100%', height: showTouch ? 'calc(100vh - 208px)' : 'calc(100vh - 48px)' }}
              />
            ) : (
              <StreamingStub />
            )}
            {gamepadConnected && <ControlHint />}
          </div>

          <TouchGamepad visible={showTouch} />

          {menuOpen && (
            <GameMenu game={game} onClose={() => setMenuOpen(false)}
              onBack={() => { setMenuOpen(false); navigate(-1) }}
              onFullscreen={() => { setMenuOpen(false); toggleFullscreen() }} />
          )}
        </>
      )}
    </div>
  )
}

function XboxTransition({ game }) {
  const [step, setStep] = useState(0)
  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 400)
    const t2 = setTimeout(() => setStep(2), 1200)
    const t3 = setTimeout(() => setStep(3), 2600)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  return (
    <div className={`fixed inset-0 z-50 bg-black flex flex-col items-center justify-center
      transition-opacity duration-500 ${step === 3 ? 'opacity-0' : 'opacity-100'}`}>
      <div className={`absolute inset-0 transition-opacity duration-700 ${step >= 1 ? 'opacity-100' : 'opacity-0'}`}
        style={{ background: 'radial-gradient(ellipse at center, #0a1628 0%, #000 70%)' }} />
      <div className={`relative z-10 transition-all duration-700 ${step >= 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
        {game.thumb
          ? <img src={game.thumb} alt={game.nome} className="w-48 h-64 object-cover rounded-xl shadow-2xl"
              style={{ boxShadow: '0 0 60px rgba(102,192,244,0.3)' }} />
          : <div className="w-48 h-64 bg-steam-panel rounded-xl flex items-center justify-center text-6xl">🎮</div>}
      </div>
      <div className={`relative z-10 mt-6 text-center transition-all duration-500 ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <h1 className="text-white text-2xl font-bold">{game.nome}</h1>
        <p className="text-steam-muted text-sm mt-1">{game.sistema?.toUpperCase()}</p>
      </div>
      <div className={`relative z-10 mt-8 w-64 transition-opacity duration-500 ${step >= 2 ? 'opacity-100' : 'opacity-0'}`}>
        <div className="h-0.5 bg-steam-border rounded-full overflow-hidden">
          <div className="h-full bg-steam-accent rounded-full" style={{ animation: 'xbox-load 1.8s ease-in-out forwards' }} />
        </div>
        <p className="text-steam-muted text-xs text-center mt-3 tracking-widest uppercase">A carregar...</p>
      </div>
      {step >= 2 && <p className="absolute bottom-8 text-steam-muted text-xs">START + SELECT para abrir o menu</p>}
      <style>{`@keyframes xbox-load { 0%{width:0%} 80%{width:100%} 100%{width:100%;opacity:0} }`}</style>
    </div>
  )
}

function GameMenu({ game, onClose, onBack, onFullscreen }) {
  const [selected, setSelected] = useState(0)
  const items = [
    { icon: '▶', label: 'Continuar jogando', action: onClose },
    { icon: '⊞', label: 'Tela cheia',         action: onFullscreen },
    { icon: '←', label: 'Sair do jogo',        action: onBack },
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
  }, [selected])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fadein"
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
              <span className="w-5 text-center">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
        <div className="px-6 py-3 border-t border-steam-border">
          <p className="text-steam-muted text-xs text-center">↑↓ navegar · Enter confirmar · Esc fechar</p>
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
                    text-xs px-4 py-2 rounded-full border border-steam-border animate-fadein">
      START + SELECT para abrir o menu
    </div>
  )
}

function StreamingStub() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 text-center p-8 max-w-md mx-auto h-full">
      <div className="text-6xl">☁️</div>
      <h2 className="text-white text-xl font-bold">Modo Streaming</h2>
      <p className="text-steam-muted text-sm">Configure <code className="text-steam-accent">EMULATION_MODE=local</code> no .env.</p>
    </div>
  )
}
