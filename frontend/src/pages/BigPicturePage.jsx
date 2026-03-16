import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

const SYSTEM_META = {
  snes:      { label: 'Super Nintendo', color: '#7c3aed', glow: '#a855f7', emoji: '🎮' },
  n64:       { label: 'Nintendo 64',    color: '#dc2626', glow: '#ef4444', emoji: '🕹' },
  ps1:       { label: 'PlayStation',    color: '#1d4ed8', glow: '#3b82f6', emoji: '🎯' },
  psx:       { label: 'PlayStation',    color: '#1d4ed8', glow: '#3b82f6', emoji: '🎯' },
  megadrive: { label: 'Mega Drive',     color: '#0f766e', glow: '#14b8a6', emoji: '⚡' },
  genesis:   { label: 'Mega Drive',     color: '#0f766e', glow: '#14b8a6', emoji: '⚡' },
  md:        { label: 'Mega Drive',     color: '#0f766e', glow: '#14b8a6', emoji: '⚡' },
  gba:       { label: 'Game Boy Advance',color:'#b45309', glow: '#f59e0b', emoji: '🌟' },
  gbc:       { label: 'Game Boy Color', color: '#15803d', glow: '#22c55e', emoji: '🎨' },
  gb:        { label: 'Game Boy',       color: '#374151', glow: '#9ca3af', emoji: '📱' },
  nes:       { label: 'NES',            color: '#9f1239', glow: '#f43f5e', emoji: '🔴' },
}

const DEFAULT_META = { label: 'Outros', color: '#4b5563', glow: '#9ca3af', emoji: '🎮' }

export default function BigPicturePage({ onExit }) {
  const navigate  = useNavigate()
  const { logout } = useAuth()

  const [allGames, setAllGames]     = useState([])
  const [systems, setSystems]       = useState([])
  const [sysIdx, setSysIdx]         = useState(0)
  const [gameIdx, setGameIdx]       = useState(0)
  const [launching, setLaunching]   = useState(false)
  const [launchGame, setLaunchGame] = useState(null)
  const [menuOpen, setMenuOpen]     = useState(false)
  const [menuIdx, setMenuIdx]       = useState(0)
  const [introPhase, setIntroPhase] = useState('in') // 'in' | 'done'

  const animRef  = useRef(null)
  const prevBtns = useRef({})
  const prevAxes = useRef({})

  // Intro cinematográfica — dura 1.8s
  useEffect(() => {
    const t = setTimeout(() => setIntroPhase('done'), 1800)
    return () => clearTimeout(t)
  }, [])

  // Carrega jogos
  useEffect(() => {
    api.games().then(d => {
      const games = d.games || []
      setAllGames(games)
      const sysList = [...new Set(games.map(g => g.sistema?.toLowerCase()).filter(Boolean))]
      setSystems(sysList)
    })
  }, [])

  const currentSystem = systems[sysIdx]
  const filteredGames = allGames.filter(g => g.sistema?.toLowerCase() === currentSystem)
  const currentGame   = filteredGames[gameIdx]
  const meta = SYSTEM_META[currentSystem] || DEFAULT_META

  // Reseta índice de jogo ao trocar sistema
  useEffect(() => { setGameIdx(0) }, [sysIdx])

  // Lança jogo com animação
  const launchCurrent = useCallback(() => {
    if (!currentGame || launching) return
    setLaunchGame(currentGame)
    setLaunching(true)
    setTimeout(() => navigate(`/play/${currentGame.id}`), 1200)
  }, [currentGame, launching, navigate])

  // Menu rápido items
  const menuItems = [
    { icon: '▶', label: 'Jogar',         action: () => { setMenuOpen(false); launchCurrent() } },
    { icon: '🖥', label: 'Modo desktop',  action: () => onExit?.() },
    { icon: '⏻',  label: 'Sair',          action: () => { logout(); navigate('/login') } },
  ]

  // Poll gamepad
  const poll = useCallback(() => {
    const gps = navigator.getGamepads?.() || []
    for (const gp of gps) {
      if (!gp) continue
      const prev  = prevBtns.current[gp.index] || {}
      const pAxes = prevAxes.current[gp.index] || {}
      const just  = (i) => gp.buttons[i]?.pressed && !prev[i]

      if (menuOpen) {
        if (just(13) || (gp.axes[1] > 0.5 && !(pAxes[1] > 0.5)))
          setMenuIdx(i => Math.min(i + 1, menuItems.length - 1))
        if (just(12) || (gp.axes[1] < -0.5 && !(pAxes[1] < -0.5)))
          setMenuIdx(i => Math.max(i - 1, 0))
        if (just(0)) menuItems[menuIdx]?.action()
        if (just(1) || just(9)) setMenuOpen(false)
      } else {
        // LB/RB ou L/R: troca sistema
        if (just(4)) setSysIdx(i => Math.max(i - 1, 0))
        if (just(5)) setSysIdx(i => Math.min(i + 1, systems.length - 1))

        // D-pad esquerda/direita + analógico: navega jogos
        if (just(14) || (gp.axes[0] < -0.5 && !(pAxes[0] < -0.5)))
          setGameIdx(i => Math.max(i - 1, 0))
        if (just(15) || (gp.axes[0] > 0.5 && !(pAxes[0] > 0.5)))
          setGameIdx(i => Math.min(i + 1, Math.max(filteredGames.length - 1, 0)))

        // A: lança jogo
        if (just(0)) launchCurrent()

        // Guide/Start/Select: menu
        if (just(9) || just(16)) { setMenuOpen(true); setMenuIdx(0) }

        // B: volta para modo desktop
        if (just(1)) onExit?.()
      }

      prevBtns.current[gp.index] = Object.fromEntries(gp.buttons.map((b,i) => [i, b.pressed]))
      prevAxes.current[gp.index] = { 0: gp.axes[0], 1: gp.axes[1] }
    }
    animRef.current = requestAnimationFrame(poll)
  }, [menuOpen, menuIdx, systems, filteredGames, launchCurrent, menuItems, onExit])

  useEffect(() => {
    animRef.current = requestAnimationFrame(poll)
    return () => cancelAnimationFrame(animRef.current)
  }, [poll])

  if (!systems.length) return (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <p className="text-white animate-pulse text-lg">Carregando biblioteca...</p>
    </div>
  )

  // Animação de intro cinematográfica
  if (introPhase === 'in') return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center"
         style={{ animation: 'bpFadeIn 0.4s ease forwards' }}>
      <div style={{ animation: 'bpLogoIn 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.3s both' }}>
        <div style={{ fontSize: 72, textAlign: 'center', marginBottom: 16 }}>🎮</div>
        <h1 style={{
          color: '#fff', fontSize: 42, fontWeight: 800, letterSpacing: 6,
          textAlign: 'center', textTransform: 'uppercase',
          textShadow: '0 0 40px rgba(102,192,244,0.8)',
        }}>RetroCloud</h1>
        <div style={{
          height: 2, background: 'linear-gradient(to right, transparent, #66c0f4, transparent)',
          marginTop: 12, animation: 'bpLine 0.8s ease 0.8s both',
          transform: 'scaleX(0)', transformOrigin: 'center',
        }} />
        <p style={{
          color: '#66c0f4', fontSize: 13, textAlign: 'center', marginTop: 10,
          letterSpacing: 4, textTransform: 'uppercase', opacity: 0,
          animation: 'bpFadeIn 0.5s ease 1.2s forwards',
        }}>Big Picture</p>
      </div>
      <style>{`
        @keyframes bpFadeIn { from{opacity:0} to{opacity:1} }
        @keyframes bpLogoIn { from{opacity:0;transform:scale(0.8)} to{opacity:1;transform:scale(1)} }
        @keyframes bpLine   { from{transform:scaleX(0)} to{transform:scaleX(1)} }
      `}</style>
    </div>
  )

  return (
    <div className="fixed inset-0 overflow-hidden select-none"
         style={{ background: '#0a0a0f' }}>

      {/* Fundo com glow do sistema atual */}
      <div className="absolute inset-0 transition-all duration-700"
           style={{ background: `radial-gradient(ellipse 80% 60% at 50% 40%, ${meta.glow}18 0%, transparent 70%)` }} />

      {/* Capa do jogo em fundo desfocado */}
      {currentGame?.thumb && (
        <div className="absolute inset-0 transition-opacity duration-500 opacity-10"
             style={{ backgroundImage: `url(${currentGame.thumb})`,
                      backgroundSize: 'cover', backgroundPosition: 'center',
                      filter: 'blur(40px) saturate(1.5)' }} />
      )}

      {/* ── HEADER: Sistemas ── */}
      <div className="relative z-10 pt-8 pb-4">
        <div className="flex items-center justify-center gap-2 px-8">
          {systems.map((sys, i) => {
            const m = SYSTEM_META[sys] || DEFAULT_META
            const active = i === sysIdx
            return (
              <button key={sys} onClick={() => setSysIdx(i)}
                className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-300"
                style={{
                  background: active ? `${m.color}40` : 'transparent',
                  border: `1px solid ${active ? m.glow : 'transparent'}`,
                  boxShadow: active ? `0 0 20px ${m.glow}40` : 'none',
                  transform: active ? 'scale(1.1)' : 'scale(0.9)',
                }}>
                <span style={{ fontSize: active ? 28 : 20 }}>{m.emoji}</span>
                <span style={{
                  fontSize: active ? 12 : 10,
                  color: active ? '#fff' : '#ffffff60',
                  fontWeight: active ? 600 : 400,
                  whiteSpace: 'nowrap',
                }}>{m.label}</span>
              </button>
            )
          })}
        </div>
        {/* Indicador LB/RB */}
        <p className="text-center text-xs mt-2" style={{ color: '#ffffff30' }}>
          LB ◀ sistema ▶ RB
        </p>
      </div>

      {/* ── CARROSSEL DE JOGOS ── */}
      <div className="relative z-10 flex-1 flex items-center justify-center"
           style={{ height: 'calc(100vh - 200px)' }}>
        {filteredGames.length === 0 ? (
          <p className="text-white text-opacity-50">Nenhum jogo neste sistema</p>
        ) : (
          <div className="flex items-center justify-center gap-0"
               style={{ width: '100%', perspective: '1200px' }}>
            {filteredGames.map((game, i) => {
              const offset = i - gameIdx
              const abs    = Math.abs(offset)
              if (abs > 3) return null

              const isCenter  = offset === 0
              const scale     = isCenter ? 1 : Math.max(0.55, 1 - abs * 0.18)
              const translateX = offset * (isCenter ? 0 : 220)
              const translateZ = isCenter ? 0 : -abs * 120
              const rotateY   = offset * -12
              const opacity   = isCenter ? 1 : Math.max(0.25, 1 - abs * 0.28)
              const zIndex    = 10 - abs

              return (
                <div key={game.id}
                     onClick={() => { if (isCenter) launchCurrent(); else setGameIdx(i) }}
                     className="absolute cursor-pointer transition-all duration-400"
                     style={{
                       transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                       opacity,
                       zIndex,
                       transformStyle: 'preserve-3d',
                     }}>
                  <div style={{
                    width: isCenter ? 220 : 170,
                    height: isCenter ? 290 : 225,
                    borderRadius: 16,
                    overflow: 'hidden',
                    boxShadow: isCenter
                      ? `0 0 60px ${meta.glow}80, 0 30px 60px rgba(0,0,0,0.8)`
                      : '0 10px 40px rgba(0,0,0,0.6)',
                    border: isCenter ? `2px solid ${meta.glow}60` : '1px solid #ffffff10',
                    transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  }}>
                    {game.thumb ? (
                      <img src={game.thumb} alt={game.nome}
                           style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{
                        width: '100%', height: '100%',
                        background: `linear-gradient(135deg, ${meta.color}40, #000)`,
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', gap: 12, padding: 16,
                      }}>
                        <span style={{ fontSize: 48 }}>{meta.emoji}</span>
                        <span style={{ color: '#fff', fontSize: 13, textAlign: 'center',
                                       fontWeight: 600, lineHeight: 1.3 }}>{game.nome}</span>
                      </div>
                    )}
                  </div>

                  {/* Reflexo */}
                  {isCenter && (
                    <div style={{
                      width: isCenter ? 220 : 170,
                      height: 60,
                      marginTop: 4,
                      background: `linear-gradient(to bottom, rgba(255,255,255,0.08), transparent)`,
                      borderRadius: '0 0 16px 16px',
                      transform: 'scaleY(-1)',
                      opacity: 0.3,
                      overflow: 'hidden',
                      pointerEvents: 'none',
                    }}>
                      {game.thumb && (
                        <img src={game.thumb} alt=""
                             style={{ width: '100%', height: '100%', objectFit: 'cover',
                                      objectPosition: 'top', filter: 'blur(2px)' }} />
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── INFO DO JOGO ATUAL ── */}
      {currentGame && (
        <div className="absolute bottom-0 left-0 right-0 z-20 pb-8 text-center"
             style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)',
                      paddingTop: 60 }}>
          <h2 style={{ color: '#fff', fontSize: 28, fontWeight: 700, marginBottom: 4,
                       textShadow: `0 0 30px ${meta.glow}` }}>
            {currentGame.nome}
          </h2>
          <p style={{ color: '#ffffff80', fontSize: 14, marginBottom: 16 }}>
            {meta.label} · {gameIdx + 1} de {filteredGames.length}
          </p>
          {/* Botões de ação */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
            <button onClick={launchCurrent}
              style={{
                background: `linear-gradient(135deg, ${meta.color}, ${meta.glow})`,
                color: '#fff', border: 'none', borderRadius: 12,
                padding: '12px 32px', fontSize: 15, fontWeight: 700,
                cursor: 'pointer', boxShadow: `0 4px 20px ${meta.glow}60`,
              }}>
              ▶ Jogar
            </button>
            <button onClick={() => onExit?.()}
              style={{
                background: 'rgba(255,255,255,0.1)', color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)', borderRadius: 12,
                padding: '12px 24px', fontSize: 15, cursor: 'pointer',
              }}>
              🖥 Desktop
            </button>
          </div>
          {/* Dica controle */}
          <p style={{ color: '#ffffff30', fontSize: 12, marginTop: 12 }}>
            ◀▶ navegar · A jogar · LB/RB sistema · Start menu
          </p>
        </div>
      )}

      {/* ── ANIMAÇÃO DE LAUNCH ── */}
      {launching && launchGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
             style={{ background: 'rgba(0,0,0,0)', animation: 'fadeInBlack 1.2s forwards' }}>
          {launchGame.thumb && (
            <img src={launchGame.thumb} alt={launchGame.nome}
                 style={{ width: 300, height: 400, objectFit: 'cover', borderRadius: 20,
                          animation: 'scaleUp 1.2s forwards',
                          boxShadow: `0 0 100px ${meta.glow}` }} />
          )}
          <style>{`
            @keyframes fadeInBlack {
              0% { background: rgba(0,0,0,0) }
              100% { background: rgba(0,0,0,0.95) }
            }
            @keyframes scaleUp {
              0% { transform: scale(1); opacity: 1 }
              100% { transform: scale(1.3); opacity: 0 }
            }
          `}</style>
        </div>
      )}

      {/* ── MENU RÁPIDO ── */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
             style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div style={{
            background: '#13131a', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 20, overflow: 'hidden', width: 280,
            boxShadow: '0 30px 80px rgba(0,0,0,0.8)',
          }}>
            <div style={{ padding: '20px 24px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <p style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>Menu</p>
            </div>
            {menuItems.map((item, i) => (
              <button key={i} onClick={item.action} onMouseEnter={() => setMenuIdx(i)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 16,
                  padding: '14px 24px', border: 'none', cursor: 'pointer',
                  background: i === menuIdx ? `${meta.color}40` : 'transparent',
                  color: i === menuIdx ? '#fff' : '#ffffff80',
                  fontSize: 15, textAlign: 'left',
                  borderLeft: i === menuIdx ? `3px solid ${meta.glow}` : '3px solid transparent',
                  transition: 'all 0.15s',
                }}>
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
