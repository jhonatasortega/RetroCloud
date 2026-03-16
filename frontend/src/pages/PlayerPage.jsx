import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import TouchGamepad from '@/components/TouchGamepad'

const EMULATOR_SYSTEM_MAP = {
  ps1: 'psx', psx: 'psx',
  snes: 'snes', n64: 'n64',
  gba: 'gba', gbc: 'gbc', gb: 'gb',
  megadrive: 'segaMD', genesis: 'segaMD', md: 'segaMD',
  nes: 'nes',
}

// Botões do gamepad que abrem o menu (Start=9, Select=8, PS/Guide=16)
const MENU_BUTTONS = [9, 8, 16]

export default function PlayerPage() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const iframeRef   = useRef(null)
  const animFrameRef = useRef(null)
  const prevBtns    = useRef({})
  const emulationMode = import.meta.env.VITE_EMULATION_MODE || 'local'

  const [game, setGame]         = useState(null)
  const [playInfo, setPlay]     = useState(null)
  const [phase, setPhase]       = useState('loading')
  const [gamepadConnected, setGamepadConnected] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [error, setError]       = useState('')
  const [showTouchGamepad, setShowTouchGamepad] = useState(false)

  // Detecta se é touch device
  useEffect(() => {
    const isTouch = navigator.maxTouchPoints > 0 ||
      document.body.dataset.inputMode === 'touch'
    setShowTouchGamepad(isTouch)
    // Reage a mudanças de modo (ex: conectar controle físico)
    const obs = new MutationObserver(() => {
      const m = document.body.dataset.inputMode
      setShowTouchGamepad(m === 'touch')
    })
    obs.observe(document.body, { attributes: true, attributeFilter: ['data-input-mode'] })
    return () => obs.disconnect()
  }, [])

  // Detecta controle
  useEffect(() => {
    const check = () => setGamepadConnected([...(navigator.getGamepads?.() || [])].some(Boolean))
    window.addEventListener('gamepadconnected',    check)
    window.addEventListener('gamepaddisconnected', check)
    check()
    return () => {
      window.removeEventListener('gamepadconnected',    check)
      window.removeEventListener('gamepaddisconnected', check)
    }
  }, [])

  // Carrega info do jogo
  useEffect(() => {
    Promise.all([api.game(id), api.play(id)])
      .then(([gd, pd]) => { setGame(gd.game); setPlay(pd) })
      .catch(e => { setError(e.message); setPhase('error') })
  }, [id])

  // Inicia transição assim que o jogo carregou
  useEffect(() => {
    if (game && playInfo && phase === 'loading') {
      setPhase('transition')
      setTimeout(() => setPhase('playing'), 3200)
    }
  }, [game, playInfo])

  // Poll do gamepad para detectar Start/Select/Guide
  const pollGamepad = useCallback(() => {
    const gps = navigator.getGamepads?.() || []
    for (const gp of gps) {
      if (!gp) continue
      gp.buttons.forEach((btn, i) => {
        const was = prevBtns.current[i] || false
        if (btn.pressed && !was && MENU_BUTTONS.includes(i)) {
          setMenuOpen(m => !m)
        }
        prevBtns.current[i] = btn.pressed
      })
    }
    animFrameRef.current = requestAnimationFrame(pollGamepad)
  }, [])

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(pollGamepad)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [pollGamepad])

  const toggleFullscreen = () => {
    const el = document.getElementById('player-container')
    if (!document.fullscreenElement) {
      el?.requestFullscreen?.()
      setFullscreen(true)
    } else {
      document.exitFullscreen?.()
      setFullscreen(false)
    }
  }

  // ── Tela de erro ──
  if (phase === 'error') return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
      <p className="text-red-400">{error}</p>
      <button onClick={() => navigate('/')} className="text-steam-accent hover:underline text-sm">
        ← Voltar à biblioteca
      </button>
    </div>
  )

  const sysKey     = game?.sistema?.toLowerCase()
  const emuCore    = EMULATOR_SYSTEM_MAP[sysKey] || sysKey
  const romUrl     = playInfo?.emulator_url || ''
  const emulatorUrl = `/emulator/?system=${emuCore}&rom=${encodeURIComponent(romUrl)}`

  return (
    <div className="min-h-screen bg-black flex flex-col">

      {/* ── TRANSIÇÃO ESTILO XBOX ── */}
      {phase === 'transition' && game && (
        <XboxTransition game={game} />
      )}

      {/* ── PLAYER ── */}
      {phase === 'playing' && (
        <>
          {/* Barra superior (some no fullscreen) */}
          {!fullscreen && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-steam-card border-b border-steam-border">
              <div className="flex items-center gap-3">
                <button onClick={() => navigate(-1)}
                  className="text-steam-muted hover:text-steam-accent transition-colors text-sm">
                  ← Voltar
                </button>
                <div className="h-4 w-px bg-steam-border" />
                <div>
                  <h1 className="text-white font-medium text-sm">{game?.nome}</h1>
                  <p className="text-steam-muted text-xs">{game?.sistema?.toUpperCase()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <GamepadBadge connected={gamepadConnected} />
                <button onClick={() => setMenuOpen(true)}
                  className="text-steam-muted hover:text-steam-accent text-xs px-3 py-1.5
                             border border-steam-border rounded transition-colors">
                  ☰ Menu
                </button>
                <button onClick={toggleFullscreen}
                  className="text-steam-muted hover:text-steam-accent text-xs px-3 py-1.5
                             border border-steam-border rounded transition-colors">
                  ⊞ Fullscreen
                </button>
              </div>
            </div>
          )}

          {/* Player */}
          <div id="player-container" className="flex-1 relative bg-black flex items-center justify-center">
            {emulationMode === 'local' ? (
              <iframe
                ref={iframeRef}
                src={emulatorUrl}
                className="w-full h-full border-0"
                style={{ minHeight: showTouchGamepad ? 'calc(100vh - 48px - 160px)' : 'calc(100vh - 48px)' }}
                allow="gamepad; fullscreen"
                title={game?.nome}
              />
            ) : (
              <StreamingStub />
            )}

            {gamepadConnected && <ControlHint />}
          </div>

          {/* Controle touch — aparece automaticamente em celular */}
          <TouchGamepad visible={showTouchGamepad} />

          {/* Menu de overlay (Start/Select ou botão Menu) */}
          {menuOpen && (
            <GameMenu
              game={game}
              onClose={() => setMenuOpen(false)}
              onBack={() => { setMenuOpen(false); navigate(-1) }}
              onFullscreen={() => { setMenuOpen(false); toggleFullscreen() }}
            />
          )}
        </>
      )}
    </div>
  )
}

/* ── Transição estilo Xbox Cloud Gaming ── */
function XboxTransition({ game }) {
  const [step, setStep] = useState(0)
  // step 0: fade in logo, 1: slide capa, 2: "a carregar", 3: fade out
  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 400)
    const t2 = setTimeout(() => setStep(2), 1200)
    const t3 = setTimeout(() => setStep(3), 2600)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  return (
    <div className={`fixed inset-0 z-50 bg-black flex flex-col items-center justify-center
      transition-opacity duration-500 ${step === 3 ? 'opacity-0' : 'opacity-100'}`}>

      {/* Brilho de fundo */}
      <div className={`absolute inset-0 transition-opacity duration-700
        ${step >= 1 ? 'opacity-100' : 'opacity-0'}`}
        style={{ background: 'radial-gradient(ellipse at center, #0a1628 0%, #000 70%)' }}
      />

      {/* Capa do jogo */}
      <div className={`relative z-10 transition-all duration-700
        ${step >= 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
        {game.thumb ? (
          <img src={game.thumb} alt={game.nome}
            className="w-48 h-64 object-cover rounded-xl shadow-2xl"
            style={{ boxShadow: '0 0 60px rgba(102,192,244,0.3)' }} />
        ) : (
          <div className="w-48 h-64 bg-steam-panel rounded-xl flex items-center justify-center text-6xl shadow-2xl">
            🎮
          </div>
        )}
      </div>

      {/* Nome do jogo */}
      <div className={`relative z-10 mt-6 text-center transition-all duration-500
        ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <h1 className="text-white text-2xl font-bold tracking-wide">{game.nome}</h1>
        <p className="text-steam-muted text-sm mt-1">{game.sistema?.toUpperCase()}</p>
      </div>

      {/* Barra de carregamento estilo Xbox */}
      <div className={`relative z-10 mt-8 w-64 transition-all duration-500
        ${step >= 2 ? 'opacity-100' : 'opacity-0'}`}>
        <div className="h-0.5 bg-steam-border rounded-full overflow-hidden">
          <div className="h-full bg-steam-accent rounded-full animate-xbox-load" />
        </div>
        <p className="text-steam-muted text-xs text-center mt-3 tracking-widest uppercase">
          A carregar...
        </p>
      </div>

      {/* Dica do controle */}
      {step >= 2 && (
        <p className="absolute bottom-8 text-steam-muted text-xs tracking-wider">
          Pressione START + SELECT para abrir o menu
        </p>
      )}

      <style>{`
        @keyframes xbox-load {
          0%   { width: 0%;   transform: translateX(0); }
          60%  { width: 100%; transform: translateX(0); }
          100% { width: 100%; transform: translateX(110%); }
        }
        .animate-xbox-load {
          animation: xbox-load 1.8s ease-in-out forwards;
        }
      `}</style>
    </div>
  )
}

/* ── Menu de overlay do controle ── */
function GameMenu({ game, onClose, onBack, onFullscreen }) {
  const items = [
    { icon: '▶', label: 'Continuar jogando', action: onClose },
    { icon: '⊞', label: 'Tela cheia',         action: onFullscreen },
    { icon: '💾', label: 'Salvar progresso',   action: onClose },  // TODO: integrar save
    { icon: '🎮', label: 'Remapear controle',  action: onClose },  // TODO
    { icon: '⚙',  label: 'Configurações',      action: onClose },  // TODO
    { icon: '←',  label: 'Sair do jogo',        action: onBack  },
  ]
  const [selected, setSelected] = useState(0)

  // Navegação por teclado/controle no menu
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
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}>

      <div className="bg-steam-card border border-steam-border rounded-2xl overflow-hidden w-80 shadow-2xl
                      animate-fadein">
        {/* Header */}
        <div className="px-6 py-4 border-b border-steam-border bg-steam-panel flex items-center gap-3">
          {game?.thumb
            ? <img src={game.thumb} alt="" className="w-10 h-12 object-cover rounded" />
            : <span className="text-2xl">🎮</span>}
          <div>
            <p className="text-white font-medium text-sm">{game?.nome}</p>
            <p className="text-steam-muted text-xs">{game?.sistema?.toUpperCase()}</p>
          </div>
        </div>

        {/* Itens do menu */}
        <div className="py-2">
          {items.map((item, i) => (
            <button
              key={i}
              onClick={item.action}
              onMouseEnter={() => setSelected(i)}
              className={`w-full flex items-center gap-4 px-6 py-3 text-sm transition-colors text-left
                ${selected === i
                  ? 'bg-steam-accent text-steam-bg font-medium'
                  : 'text-steam-text hover:bg-steam-panel'}`}
            >
              <span className="w-5 text-center">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>

        {/* Dica */}
        <div className="px-6 py-3 border-t border-steam-border">
          <p className="text-steam-muted text-xs text-center">
            ↑↓ navegar · Enter confirmar · Esc fechar
          </p>
        </div>
      </div>
    </div>
  )
}

/* ── Helpers ── */
function GamepadBadge({ connected }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded ${
      connected ? 'text-green-400 bg-green-900/30' : 'text-steam-muted bg-steam-panel'
    }`}>
      <span>🕹</span>
      <span className="hidden sm:inline">{connected ? 'Controle' : 'Sem controle'}</span>
    </div>
  )
}

function ControlHint() {
  const [visible, setVisible] = useState(true)
  useEffect(() => { const t = setTimeout(() => setVisible(false), 4000); return () => clearTimeout(t) }, [])
  if (!visible) return null
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/70 text-steam-muted
                    text-xs px-4 py-2 rounded-full border border-steam-border
                    animate-fadein transition-opacity">
      START + SELECT para abrir o menu
    </div>
  )
}

function StreamingStub() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 text-center p-8 max-w-md">
      <div className="text-6xl">☁️</div>
      <h2 className="text-white text-xl font-bold">Modo Streaming</h2>
      <p className="text-steam-muted text-sm leading-relaxed">
        Streaming via servidor ainda não implementado.
        Configure <code className="text-steam-accent">EMULATION_MODE=local</code> no .env.
      </p>
    </div>
  )
}
