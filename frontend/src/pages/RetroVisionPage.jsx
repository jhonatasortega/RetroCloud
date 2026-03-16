import { useState, useEffect, useRef, useCallback, memo } from 'react'
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

// Botões que abrem o menu RetroVision (Guide=16 apenas — NÃO Start/Select que são usados no jogo)
const MENU_BTNS = [16]


// Card memoizado — só re-renderiza quando offset ou dados do jogo mudam
const CarouselCard = memo(function CarouselCard({ game, offset, meta, isCenter, onClick }) {
  const scale      = isCenter ? 1 : Math.max(0.5, 1 - Math.abs(offset) * 0.2)
  const translateX = offset * 230
  const translateZ = isCenter ? 50 : -Math.abs(offset) * 100
  const rotateY    = offset * -14
  const opacity    = isCenter ? 1 : Math.max(0.2, 1 - Math.abs(offset) * 0.3)

  return (
    <div
      onClick={onClick}
      style={{
        position: 'absolute',
        cursor: 'pointer',
        transition: 'all 0.35s cubic-bezier(0.34,1.2,0.64,1)',
        transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
        opacity,
        zIndex: 10 - Math.abs(offset),
        transformStyle: 'preserve-3d',
      }}>
      <div style={{
        width: isCenter ? 210 : 160,
        height: isCenter ? 280 : 210,
        borderRadius: 14,
        overflow: 'hidden',
        transition: 'all 0.35s ease',
        boxShadow: isCenter
          ? `0 0 50px ${meta.glow}60, 0 20px 50px rgba(0,0,0,0.9)`
          : '0 8px 30px rgba(0,0,0,0.7)',
        border: isCenter ? `2px solid ${meta.glow}50` : '1px solid #ffffff08',
      }}>
        {game.thumb && Math.abs(offset) <= 2 ? (
          <img src={game.thumb} alt={game.nome} loading="lazy" decoding="async"
               style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: `linear-gradient(135deg, ${meta.color}30, #000)`,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 10, padding: 12,
          }}>
            <span style={{ fontSize: 40 }}>{meta.emoji}</span>
            <span style={{ color: '#fff', fontSize: 12, textAlign: 'center',
                           fontWeight: 600, lineHeight: 1.3 }}>{game.nome}</span>
          </div>
        )}
      </div>
    </div>
  )
})

export default function RetroVisionPage({ onExit }) {
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
  const [introPhase, setIntroPhase] = useState('in')

  const animRef  = useRef(null)
  const prevBtns = useRef({})
  const prevAxes = useRef({})
  const heldTime = useRef({})

  // Intro cinematográfica — 1.8s
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

  // Confirmação de saída — declarado antes do useEffect que o usa
  const [confirmExit, setConfirmExit] = useState(false)

  const tryExit = useCallback(() => {
    setConfirmExit(true)
    setTimeout(() => setConfirmExit(false), 3000)
  }, [])

  const confirmExitNow = useCallback(() => {
    setConfirmExit(false)
    onExit?.()
  }, [onExit])

  // ESC pede confirmação para sair
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (confirmExit) confirmExitNow()
        else tryExit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tryExit, confirmExit, confirmExitNow])

  const currentSystem = systems[sysIdx]
  const filteredGames = allGames.filter(g => g.sistema?.toLowerCase() === currentSystem)
  const currentGame   = filteredGames[gameIdx]
  const meta = SYSTEM_META[currentSystem] || DEFAULT_META

  useEffect(() => { setGameIdx(0) }, [sysIdx])

  // Lança jogo — abre direto, sem precisar de botão extra
  const currentGameRef = useRef(null)
  useEffect(() => { currentGameRef.current = currentGame }, [currentGame])

  const launchCurrent = useCallback(() => {
    const game = currentGameRef.current
    if (!game || launching) return
    setLaunchGame(game)
    setLaunching(true)
    // Navega imediatamente — a animação acontece por cima
    setTimeout(() => navigate(`/play/${game.id}`), 600)
  }, [launching, navigate])

  const menuItems = [
    { icon: '▶', label: 'Continuar jogando', action: () => setMenuOpen(false) },
    { icon: '🖥', label: 'Modo Desktop',      action: () => { setMenuOpen(false); tryExit() } },
    { icon: '⏻',  label: 'Sair da conta',     action: () => { logout(); navigate('/login') } },
  ]

  // Poll gamepad com repeat correto ao segurar
  const poll = useCallback(() => {
    const gps = navigator.getGamepads?.() || []
    const now  = performance.now()

    for (const gp of gps) {
      if (!gp) continue
      const prev  = prevBtns.current[gp.index] || {}
      const pAxes = prevAxes.current[gp.index] || {}

      const isDown   = (i) => !!gp.buttons[i]?.pressed
      const wasDown  = (i) => !!prev[i]
      const justDown = (i) => isDown(i) && !wasDown(i)
      const justUp   = (i) => !isDown(i) && wasDown(i)

      // Repeat: primeiro disparo imediato, depois 400ms delay, depois 130ms repeat
      const repeatFire = (i) => {
        if (!isDown(i)) {
          if (heldTime.current[i]) heldTime.current[i] = 0
          return false
        }
        if (justDown(i)) {
          heldTime.current[i] = now
          heldTime.current[`r${i}`] = now
          return true  // disparo imediato
        }
        const held = now - heldTime.current[i]
        const sinceRepeat = now - (heldTime.current[`r${i}`] || 0)
        if (held > 400 && sinceRepeat > 130) {
          heldTime.current[`r${i}`] = now
          return true
        }
        return false
      }

      const ax = gp.axes[0] || 0
      const ay = gp.axes[1] || 0

      // Repeat para analógico
      const axRepeatL = ax < -0.5
      const axRepeatR = ax >  0.5
      const axKey = axRepeatL ? 'axL' : axRepeatR ? 'axR' : null
      const axFire = (dir) => {
        const k = dir === 'L' ? 'axL' : 'axR'
        const active = dir === 'L' ? axRepeatL : axRepeatR
        if (!active) { heldTime.current[k] = 0; return false }
        if (!(dir === 'L' ? (pAxes.ax < -0.5) : (pAxes.ax > 0.5))) {
          heldTime.current[k] = now; heldTime.current[`r${k}`] = now; return true
        }
        const held = now - (heldTime.current[k] || 0)
        const sinceRepeat = now - (heldTime.current[`r${k}`] || 0)
        if (held > 400 && sinceRepeat > 130) { heldTime.current[`r${k}`] = now; return true }
        return false
      }

      if (menuOpen) {
        if (repeatFire(13)) setMenuIdx(i => Math.min(i + 1, menuItems.length - 1))
        if (repeatFire(12)) setMenuIdx(i => Math.max(i - 1, 0))
        if (justDown(0)) menuItems[menuIdx]?.action()
        if (justDown(1)) setMenuOpen(false)
        if (MENU_BTNS.some(justDown)) setMenuOpen(false)
      } else {
        // LB/RB: troca sistema com repeat
        if (repeatFire(4)) setSysIdx(i => Math.max(i - 1, 0))
        if (repeatFire(5)) setSysIdx(i => Math.min(i + 1, systems.length - 1))

        // D-pad esq/dir + analógico: navega jogos
        // Ao segurar por mais de 1.5s, pula para a próxima letra
        const goL = repeatFire(14) || axFire('L')
        const goR = repeatFire(15) || axFire('R')

        if (goL) {
          setGameIdx(cur => {
            // Segurado > 1.5s: pula para primeira letra anterior
            const held = now - (heldTime.current._navStart || now)
            if (held > 1500 && cur > 0) {
              const curLetter = filteredGames[cur]?.nome?.[0]?.toUpperCase() || ''
              // Acha primeira ocorrência da letra anterior
              for (let i = cur - 1; i >= 0; i--) {
                const l = filteredGames[i]?.nome?.[0]?.toUpperCase()
                if (l < curLetter) {
                  const first = filteredGames.findIndex(g => g.nome?.[0]?.toUpperCase() === l)
                  heldTime.current._navStart = now
                  return first >= 0 ? first : i
                }
              }
              heldTime.current._navStart = now
              return 0
            }
            return Math.max(0, cur - 1)
          })
        }
        if (goR) {
          setGameIdx(cur => {
            const held = now - (heldTime.current._navStart || now)
            if (held > 1500 && cur < filteredGames.length - 1) {
              const curLetter = filteredGames[cur]?.nome?.[0]?.toUpperCase() || ''
              const jumpIdx = filteredGames.findIndex((g, i) =>
                i > cur && (g.nome?.[0]?.toUpperCase() || '') > curLetter
              )
              heldTime.current._navStart = now
              return jumpIdx >= 0 ? jumpIdx : filteredGames.length - 1
            }
            return Math.min(cur + 1, filteredGames.length - 1)
          })
        }
        if (goL || goR) {
          if (!heldTime.current._navStart) heldTime.current._navStart = now
        } else {
          heldTime.current._navStart = 0
        }

        // D-pad cima/baixo: troca sistema
        if (justDown(12) || (ay < -0.5 && !(pAxes.ay < -0.5))) setSysIdx(i => Math.max(i - 1, 0))
        if (justDown(13) || (ay >  0.5 && !(pAxes.ay >  0.5))) setSysIdx(i => Math.min(i + 1, systems.length - 1))

        // A: lança jogo
        if (justDown(0)) launchCurrent()

        // Guide: abre menu
        if (MENU_BTNS.some(justDown)) { setMenuOpen(true); setMenuIdx(0) }

        // B: confirmação de saída
        if (justDown(1)) {
          if (confirmExit) confirmExitNow()
          else tryExit()
        }
      }

      prevBtns.current[gp.index] = Object.fromEntries(gp.buttons.map((b,i) => [i, b.pressed]))
      prevAxes.current[gp.index] = { ax, ay }
    }
    animRef.current = requestAnimationFrame(poll)
  }, [menuOpen, menuIdx, systems, filteredGames, launchCurrent, menuItems, confirmExit, confirmExitNow, tryExit])

  useEffect(() => {
    animRef.current = requestAnimationFrame(poll)
    return () => cancelAnimationFrame(animRef.current)
  }, [poll])

  // ── Intro ──────────────────────────────────────────────────────────────────
  if (introPhase === 'in') return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center"
         style={{ animation: 'rvFadeIn 0.4s ease forwards' }}>
      <div style={{ animation: 'rvLogoIn 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.2s both' }}>
        <div style={{ fontSize: 72, textAlign: 'center', marginBottom: 16 }}>🎮</div>
        <h1 style={{
          color: '#fff', fontSize: 40, fontWeight: 800, letterSpacing: 8,
          textAlign: 'center', textTransform: 'uppercase',
          textShadow: '0 0 40px rgba(102,192,244,0.8)',
        }}>RetroCloud</h1>
        <div style={{
          height: 2, background: 'linear-gradient(to right, transparent, #66c0f4, transparent)',
          marginTop: 12, animation: 'rvLine 0.8s ease 0.7s both',
          transform: 'scaleX(0)', transformOrigin: 'center',
        }} />
        <p style={{
          color: '#66c0f4', fontSize: 12, textAlign: 'center', marginTop: 10,
          letterSpacing: 6, textTransform: 'uppercase', opacity: 0,
          animation: 'rvFadeIn 0.5s ease 1.1s forwards',
        }}>RetroVision</p>
      </div>
      <style>{`
        @keyframes rvFadeIn { from{opacity:0} to{opacity:1} }
        @keyframes rvLogoIn { from{opacity:0;transform:scale(0.8)} to{opacity:1;transform:scale(1)} }
        @keyframes rvLine   { from{transform:scaleX(0)} to{transform:scaleX(1)} }
      `}</style>
    </div>
  )

  if (!systems.length) return (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <p className="text-white animate-pulse">Carregando...</p>
    </div>
  )

  // ── Main ───────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 overflow-hidden select-none" style={{ background: '#0a0a0f' }}>

      {/* Glow do sistema */}
      <div className="absolute inset-0 transition-all duration-700 pointer-events-none"
           style={{ background: `radial-gradient(ellipse 80% 60% at 50% 35%, ${meta.glow}18 0%, transparent 70%)` }} />

      {/* Capa em fundo desfocado */}
      {currentGame?.thumb && (
        <div className="absolute inset-0 pointer-events-none"
             style={{ backgroundImage: `url(${currentGame.thumb})`,
                      backgroundSize: 'cover', backgroundPosition: 'center',
                      filter: 'blur(60px) saturate(1.5)', opacity: 0.08,
                      transition: 'opacity 0.5s' }} />
      )}

      {/* Sistemas no topo */}
      <div className="relative z-10 pt-6 pb-2">
        <div className="flex items-end justify-center gap-1 px-4 flex-wrap">
          {systems.map((sys, i) => {
            const m = SYSTEM_META[sys] || DEFAULT_META
            const active = i === sysIdx
            return (
              <button key={sys} onClick={() => setSysIdx(i)}
                className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200"
                style={{
                  background: active ? `${m.color}35` : 'transparent',
                  border: `1px solid ${active ? m.glow : 'transparent'}`,
                  boxShadow: active ? `0 0 16px ${m.glow}30` : 'none',
                  transform: active ? 'scale(1.08)' : 'scale(0.88)',
                }}>
                <span style={{ fontSize: active ? 24 : 18 }}>{m.emoji}</span>
                <span style={{ fontSize: 10, color: active ? '#fff' : '#ffffff50',
                               fontWeight: active ? 700 : 400, whiteSpace: 'nowrap' }}>
                  {m.label}
                </span>
              </button>
            )
          })}
        </div>
        <p className="text-center text-xs mt-1" style={{ color: '#ffffff25', fontSize: 10 }}>
          LB ◀ sistema ▶ RB · ↑↓ D-pad
        </p>
      </div>

      {/* Carrossel 3D */}
      <div className="relative z-10 flex items-center justify-center"
           style={{ height: 'calc(100vh - 220px)', perspective: '1200px' }}>
        {filteredGames.length === 0 ? (
          <p style={{ color: '#ffffff40' }}>Nenhum jogo neste sistema</p>
        ) : (
          <div style={{ position: 'relative', width: '100%', height: '100%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {filteredGames.map((game, i) => {
              const offset = i - gameIdx
              const abs    = Math.abs(offset)
              if (abs > 3) return null

              const isCenter   = offset === 0
              const scale      = isCenter ? 1 : Math.max(0.5, 1 - abs * 0.2)
              const translateX = offset * 230
              const translateZ = isCenter ? 50 : -abs * 100
              const rotateY    = offset * -14
              const opacity    = isCenter ? 1 : Math.max(0.2, 1 - abs * 0.3)

              return (
                <div key={game.id}
                     onClick={() => isCenter ? launchCurrent() : setGameIdx(i)}
                     style={{
                       position: 'absolute',
                       cursor: 'pointer',
                       transition: 'all 0.35s cubic-bezier(0.34,1.2,0.64,1)',
                       transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                       opacity,
                       zIndex: 10 - abs,
                       transformStyle: 'preserve-3d',
                     }}>
                  <div style={{
                    width: isCenter ? 210 : 160,
                    height: isCenter ? 280 : 210,
                    borderRadius: 14,
                    overflow: 'hidden',
                    transition: 'all 0.35s ease',
                    boxShadow: isCenter
                      ? `0 0 50px ${meta.glow}60, 0 20px 50px rgba(0,0,0,0.9)`
                      : '0 8px 30px rgba(0,0,0,0.7)',
                    border: isCenter ? `2px solid ${meta.glow}50` : '1px solid #ffffff08',
                  }}>
                    {game.thumb && Math.abs(offset) <= 2 ? (
                      <img
                        src={game.thumb}
                        alt={game.nome}
                        loading="lazy"
                        decoding="async"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{
                        width: '100%', height: '100%',
                        background: `linear-gradient(135deg, ${meta.color}30, #000)`,
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', gap: 10, padding: 12,
                      }}>
                        <span style={{ fontSize: 40 }}>{meta.emoji}</span>
                        <span style={{ color: '#fff', fontSize: 12, textAlign: 'center',
                                       fontWeight: 600, lineHeight: 1.3 }}>{game.nome}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Info rodapé */}
      {currentGame && (
        <div className="absolute bottom-0 left-0 right-0 z-20"
             style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, transparent 100%)',
                      paddingTop: 60, paddingBottom: 24, textAlign: 'center' }}>
          <h2 style={{ color: '#fff', fontSize: 26, fontWeight: 700, marginBottom: 4,
                       textShadow: `0 0 20px ${meta.glow}` }}>
            {currentGame.nome}
          </h2>
          <p style={{ color: '#ffffff60', fontSize: 13, marginBottom: 16 }}>
            {meta.label} · {gameIdx + 1} / {filteredGames.length}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
            <button onClick={launchCurrent}
              style={{
                background: `linear-gradient(135deg, ${meta.color}, ${meta.glow})`,
                color: '#fff', border: 'none', borderRadius: 10,
                padding: '11px 28px', fontSize: 14, fontWeight: 700,
                cursor: 'pointer', boxShadow: `0 4px 16px ${meta.glow}50`,
              }}>▶ Jogar</button>
          </div>
          <p style={{ color: '#ffffff25', fontSize: 11, marginTop: 10 }}>
            ◀▶ navegar · A jogar · Guide menu · B / Esc sair
          </p>
        </div>
      )}

      {/* Launch animation */}
      {launching && launchGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
             style={{ animation: 'rvBlackIn 0.9s forwards',
                      background: 'rgba(0,0,0,0)' }}>
          {launchGame.thumb && (
            <img src={launchGame.thumb} alt=""
                 style={{ width: 260, height: 340, objectFit: 'cover', borderRadius: 18,
                          animation: 'rvCardOut 0.9s forwards',
                          boxShadow: `0 0 80px ${meta.glow}` }} />
          )}
          <style>{`
            @keyframes rvBlackIn { 0%{background:rgba(0,0,0,0)} 100%{background:rgba(0,0,0,0.98)} }
            @keyframes rvCardOut { 0%{transform:scale(1);opacity:1} 100%{transform:scale(1.25);opacity:0} }
          `}</style>
        </div>
      )}

      {/* Toast de confirmação de saída */}
      {confirmExit && (
        <div className="fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2"
             style={{ animation: 'rvFadeIn 0.2s ease' }}>
          <div style={{
            background: '#0f0f18', border: `1px solid ${meta.glow}60`,
            borderRadius: 16, padding: '28px 40px', textAlign: 'center',
            boxShadow: `0 0 40px ${meta.glow}30, 0 20px 60px rgba(0,0,0,0.9)`,
          }}>
            <p style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              Sair do RetroVision?
            </p>
            <p style={{ color: '#ffffff60', fontSize: 13, marginBottom: 20 }}>
              Pressione B / Esc novamente para confirmar
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={confirmExitNow}
                style={{
                  background: `${meta.color}`, color: '#fff', border: 'none',
                  borderRadius: 10, padding: '10px 24px', fontSize: 14,
                  fontWeight: 700, cursor: 'pointer',
                }}>Sair</button>
              <button onClick={() => setConfirmExit(false)}
                style={{
                  background: 'rgba(255,255,255,0.08)', color: '#ffffff80',
                  border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10,
                  padding: '10px 24px', fontSize: 14, cursor: 'pointer',
                }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Menu Guide */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
             style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)' }}>
          <div style={{
            background: '#0f0f18', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 18, overflow: 'hidden', width: 260,
            boxShadow: '0 30px 80px rgba(0,0,0,0.9)',
          }}>
            <div style={{ padding: '18px 22px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>RetroVision</p>
            </div>
            {menuItems.map((item, i) => (
              <button key={i} onClick={item.action} onMouseEnter={() => setMenuIdx(i)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                  padding: '13px 22px', border: 'none', cursor: 'pointer',
                  background: i === menuIdx ? `${meta.color}35` : 'transparent',
                  color: i === menuIdx ? '#fff' : '#ffffff70',
                  fontSize: 14, textAlign: 'left',
                  borderLeft: `3px solid ${i === menuIdx ? meta.glow : 'transparent'}`,
                  transition: 'all 0.15s',
                }}>
                <span>{item.icon}</span><span>{item.label}</span>
              </button>
            ))}
            <div style={{ padding: '10px 22px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ color: '#ffffff30', fontSize: 11, textAlign: 'center' }}>
                A confirmar · B / Guide fechar
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}              {filteredGames.map((game, i) => {
              const offset = i - gameIdx
              if (Math.abs(offset) > 3) return null
              return (
                <CarouselCard
                  key={game.id}
                  game={game}
                  offset={offset}
                  meta={meta}
                  isCenter={offset === 0}
                  onClick={() => offset === 0 ? launchCurrent() : setGameIdx(i)}
                />
              )
            })}ate, useEffect, useRef, useCallback, memo } from 'react'
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

// Botões que abrem o menu RetroVision (Guide=16 apenas — NÃO Start/Select que são usados no jogo)
const MENU_BTNS = [16]


// Card memoizado — só re-renderiza quando offset ou dados do jogo mudam
const CarouselCard = memo(function CarouselCard({ game, offset, meta, isCenter, onClick }) {
  const scale      = isCenter ? 1 : Math.max(0.5, 1 - Math.abs(offset) * 0.2)
  const translateX = offset * 230
  const translateZ = isCenter ? 50 : -Math.abs(offset) * 100
  const rotateY    = offset * -14
  const opacity    = isCenter ? 1 : Math.max(0.2, 1 - Math.abs(offset) * 0.3)

  return (
    <div
      onClick={onClick}
      style={{
        position: 'absolute',
        cursor: 'pointer',
        transition: 'all 0.35s cubic-bezier(0.34,1.2,0.64,1)',
        transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
        opacity,
        zIndex: 10 - Math.abs(offset),
        transformStyle: 'preserve-3d',
      }}>
      <div style={{
        width: isCenter ? 210 : 160,
        height: isCenter ? 280 : 210,
        borderRadius: 14,
        overflow: 'hidden',
        transition: 'all 0.35s ease',
        boxShadow: isCenter
          ? `0 0 50px ${meta.glow}60, 0 20px 50px rgba(0,0,0,0.9)`
          : '0 8px 30px rgba(0,0,0,0.7)',
        border: isCenter ? `2px solid ${meta.glow}50` : '1px solid #ffffff08',
      }}>
        {game.thumb && Math.abs(offset) <= 2 ? (
          <img src={game.thumb} alt={game.nome} loading="lazy" decoding="async"
               style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: `linear-gradient(135deg, ${meta.color}30, #000)`,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 10, padding: 12,
          }}>
            <span style={{ fontSize: 40 }}>{meta.emoji}</span>
            <span style={{ color: '#fff', fontSize: 12, textAlign: 'center',
                           fontWeight: 600, lineHeight: 1.3 }}>{game.nome}</span>
          </div>
        )}
      </div>
    </div>
  )
})

export default function RetroVisionPage({ onExit }) {
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
  const [introPhase, setIntroPhase] = useState('in')

  const animRef  = useRef(null)
  const prevBtns = useRef({})
  const prevAxes = useRef({})
  const heldTime = useRef({})

  // Intro cinematográfica — 1.8s
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

  // Confirmação de saída — declarado antes do useEffect que o usa
  const [confirmExit, setConfirmExit] = useState(false)

  const tryExit = useCallback(() => {
    setConfirmExit(true)
    setTimeout(() => setConfirmExit(false), 3000)
  }, [])

  const confirmExitNow = useCallback(() => {
    setConfirmExit(false)
    onExit?.()
  }, [onExit])

  // ESC pede confirmação para sair
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (confirmExit) confirmExitNow()
        else tryExit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tryExit, confirmExit, confirmExitNow])

  const currentSystem = systems[sysIdx]
  const filteredGames = allGames.filter(g => g.sistema?.toLowerCase() === currentSystem)
  const currentGame   = filteredGames[gameIdx]
  const meta = SYSTEM_META[currentSystem] || DEFAULT_META

  useEffect(() => { setGameIdx(0) }, [sysIdx])

  // Lança jogo — abre direto, sem precisar de botão extra
  const currentGameRef = useRef(null)
  useEffect(() => { currentGameRef.current = currentGame }, [currentGame])

  const launchCurrent = useCallback(() => {
    const game = currentGameRef.current
    if (!game || launching) return
    setLaunchGame(game)
    setLaunching(true)
    // Navega imediatamente — a animação acontece por cima
    setTimeout(() => navigate(`/play/${game.id}`), 600)
  }, [launching, navigate])

  const menuItems = [
    { icon: '▶', label: 'Continuar jogando', action: () => setMenuOpen(false) },
    { icon: '🖥', label: 'Modo Desktop',      action: () => { setMenuOpen(false); tryExit() } },
    { icon: '⏻',  label: 'Sair da conta',     action: () => { logout(); navigate('/login') } },
  ]

  // Poll gamepad com repeat correto ao segurar
  const poll = useCallback(() => {
    const gps = navigator.getGamepads?.() || []
    const now  = performance.now()

    for (const gp of gps) {
      if (!gp) continue
      const prev  = prevBtns.current[gp.index] || {}
      const pAxes = prevAxes.current[gp.index] || {}

      const isDown   = (i) => !!gp.buttons[i]?.pressed
      const wasDown  = (i) => !!prev[i]
      const justDown = (i) => isDown(i) && !wasDown(i)
      const justUp   = (i) => !isDown(i) && wasDown(i)

      // Repeat: primeiro disparo imediato, depois 400ms delay, depois 130ms repeat
      const repeatFire = (i) => {
        if (!isDown(i)) {
          if (heldTime.current[i]) heldTime.current[i] = 0
          return false
        }
        if (justDown(i)) {
          heldTime.current[i] = now
          heldTime.current[`r${i}`] = now
          return true  // disparo imediato
        }
        const held = now - heldTime.current[i]
        const sinceRepeat = now - (heldTime.current[`r${i}`] || 0)
        if (held > 400 && sinceRepeat > 130) {
          heldTime.current[`r${i}`] = now
          return true
        }
        return false
      }

      const ax = gp.axes[0] || 0
      const ay = gp.axes[1] || 0

      // Repeat para analógico
      const axRepeatL = ax < -0.5
      const axRepeatR = ax >  0.5
      const axKey = axRepeatL ? 'axL' : axRepeatR ? 'axR' : null
      const axFire = (dir) => {
        const k = dir === 'L' ? 'axL' : 'axR'
        const active = dir === 'L' ? axRepeatL : axRepeatR
        if (!active) { heldTime.current[k] = 0; return false }
        if (!(dir === 'L' ? (pAxes.ax < -0.5) : (pAxes.ax > 0.5))) {
          heldTime.current[k] = now; heldTime.current[`r${k}`] = now; return true
        }
        const held = now - (heldTime.current[k] || 0)
        const sinceRepeat = now - (heldTime.current[`r${k}`] || 0)
        if (held > 400 && sinceRepeat > 130) { heldTime.current[`r${k}`] = now; return true }
        return false
      }

      if (menuOpen) {
        if (repeatFire(13)) setMenuIdx(i => Math.min(i + 1, menuItems.length - 1))
        if (repeatFire(12)) setMenuIdx(i => Math.max(i - 1, 0))
        if (justDown(0)) menuItems[menuIdx]?.action()
        if (justDown(1)) setMenuOpen(false)
        if (MENU_BTNS.some(justDown)) setMenuOpen(false)
      } else {
        // LB/RB: troca sistema com repeat
        if (repeatFire(4)) setSysIdx(i => Math.max(i - 1, 0))
        if (repeatFire(5)) setSysIdx(i => Math.min(i + 1, systems.length - 1))

        // D-pad esq/dir + analógico: navega jogos
        // Ao segurar por mais de 1.5s, pula para a próxima letra
        const goL = repeatFire(14) || axFire('L')
        const goR = repeatFire(15) || axFire('R')

        if (goL) {
          setGameIdx(cur => {
            // Segurado > 1.5s: pula para primeira letra anterior
            const held = now - (heldTime.current._navStart || now)
            if (held > 1500 && cur > 0) {
              const curLetter = filteredGames[cur]?.nome?.[0]?.toUpperCase() || ''
              // Acha primeira ocorrência da letra anterior
              for (let i = cur - 1; i >= 0; i--) {
                const l = filteredGames[i]?.nome?.[0]?.toUpperCase()
                if (l < curLetter) {
                  const first = filteredGames.findIndex(g => g.nome?.[0]?.toUpperCase() === l)
                  heldTime.current._navStart = now
                  return first >= 0 ? first : i
                }
              }
              heldTime.current._navStart = now
              return 0
            }
            return Math.max(0, cur - 1)
          })
        }
        if (goR) {
          setGameIdx(cur => {
            const held = now - (heldTime.current._navStart || now)
            if (held > 1500 && cur < filteredGames.length - 1) {
              const curLetter = filteredGames[cur]?.nome?.[0]?.toUpperCase() || ''
              const jumpIdx = filteredGames.findIndex((g, i) =>
                i > cur && (g.nome?.[0]?.toUpperCase() || '') > curLetter
              )
              heldTime.current._navStart = now
              return jumpIdx >= 0 ? jumpIdx : filteredGames.length - 1
            }
            return Math.min(cur + 1, filteredGames.length - 1)
          })
        }
        if (goL || goR) {
          if (!heldTime.current._navStart) heldTime.current._navStart = now
        } else {
          heldTime.current._navStart = 0
        }

        // D-pad cima/baixo: troca sistema
        if (justDown(12) || (ay < -0.5 && !(pAxes.ay < -0.5))) setSysIdx(i => Math.max(i - 1, 0))
        if (justDown(13) || (ay >  0.5 && !(pAxes.ay >  0.5))) setSysIdx(i => Math.min(i + 1, systems.length - 1))

        // A: lança jogo
        if (justDown(0)) launchCurrent()

        // Guide: abre menu
        if (MENU_BTNS.some(justDown)) { setMenuOpen(true); setMenuIdx(0) }

        // B: confirmação de saída
        if (justDown(1)) {
          if (confirmExit) confirmExitNow()
          else tryExit()
        }
      }

      prevBtns.current[gp.index] = Object.fromEntries(gp.buttons.map((b,i) => [i, b.pressed]))
      prevAxes.current[gp.index] = { ax, ay }
    }
    animRef.current = requestAnimationFrame(poll)
  }, [menuOpen, menuIdx, systems, filteredGames, launchCurrent, menuItems, confirmExit, confirmExitNow, tryExit])

  useEffect(() => {
    animRef.current = requestAnimationFrame(poll)
    return () => cancelAnimationFrame(animRef.current)
  }, [poll])

  // ── Intro ──────────────────────────────────────────────────────────────────
  if (introPhase === 'in') return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center"
         style={{ animation: 'rvFadeIn 0.4s ease forwards' }}>
      <div style={{ animation: 'rvLogoIn 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.2s both' }}>
        <div style={{ fontSize: 72, textAlign: 'center', marginBottom: 16 }}>🎮</div>
        <h1 style={{
          color: '#fff', fontSize: 40, fontWeight: 800, letterSpacing: 8,
          textAlign: 'center', textTransform: 'uppercase',
          textShadow: '0 0 40px rgba(102,192,244,0.8)',
        }}>RetroCloud</h1>
        <div style={{
          height: 2, background: 'linear-gradient(to right, transparent, #66c0f4, transparent)',
          marginTop: 12, animation: 'rvLine 0.8s ease 0.7s both',
          transform: 'scaleX(0)', transformOrigin: 'center',
        }} />
        <p style={{
          color: '#66c0f4', fontSize: 12, textAlign: 'center', marginTop: 10,
          letterSpacing: 6, textTransform: 'uppercase', opacity: 0,
          animation: 'rvFadeIn 0.5s ease 1.1s forwards',
        }}>RetroVision</p>
      </div>
      <style>{`
        @keyframes rvFadeIn { from{opacity:0} to{opacity:1} }
        @keyframes rvLogoIn { from{opacity:0;transform:scale(0.8)} to{opacity:1;transform:scale(1)} }
        @keyframes rvLine   { from{transform:scaleX(0)} to{transform:scaleX(1)} }
      `}</style>
    </div>
  )

  if (!systems.length) return (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <p className="text-white animate-pulse">Carregando...</p>
    </div>
  )

  // ── Main ───────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 overflow-hidden select-none" style={{ background: '#0a0a0f' }}>

      {/* Glow do sistema */}
      <div className="absolute inset-0 transition-all duration-700 pointer-events-none"
           style={{ background: `radial-gradient(ellipse 80% 60% at 50% 35%, ${meta.glow}18 0%, transparent 70%)` }} />

      {/* Capa em fundo desfocado */}
      {currentGame?.thumb && (
        <div className="absolute inset-0 pointer-events-none"
             style={{ backgroundImage: `url(${currentGame.thumb})`,
                      backgroundSize: 'cover', backgroundPosition: 'center',
                      filter: 'blur(60px) saturate(1.5)', opacity: 0.08,
                      transition: 'opacity 0.5s' }} />
      )}

      {/* Sistemas no topo */}
      <div className="relative z-10 pt-6 pb-2">
        <div className="flex items-end justify-center gap-1 px-4 flex-wrap">
          {systems.map((sys, i) => {
            const m = SYSTEM_META[sys] || DEFAULT_META
            const active = i === sysIdx
            return (
              <button key={sys} onClick={() => setSysIdx(i)}
                className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200"
                style={{
                  background: active ? `${m.color}35` : 'transparent',
                  border: `1px solid ${active ? m.glow : 'transparent'}`,
                  boxShadow: active ? `0 0 16px ${m.glow}30` : 'none',
                  transform: active ? 'scale(1.08)' : 'scale(0.88)',
                }}>
                <span style={{ fontSize: active ? 24 : 18 }}>{m.emoji}</span>
                <span style={{ fontSize: 10, color: active ? '#fff' : '#ffffff50',
                               fontWeight: active ? 700 : 400, whiteSpace: 'nowrap' }}>
                  {m.label}
                </span>
              </button>
            )
          })}
        </div>
        <p className="text-center text-xs mt-1" style={{ color: '#ffffff25', fontSize: 10 }}>
          LB ◀ sistema ▶ RB · ↑↓ D-pad
        </p>
      </div>

      {/* Carrossel 3D */}
      <div className="relative z-10 flex items-center justify-center"
           style={{ height: 'calc(100vh - 220px)', perspective: '1200px' }}>
        {filteredGames.length === 0 ? (
          <p style={{ color: '#ffffff40' }}>Nenhum jogo neste sistema</p>
        ) : (
          <div style={{ position: 'relative', width: '100%', height: '100%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {filteredGames.map((game, i) => {
              const offset = i - gameIdx
              const abs    = Math.abs(offset)
              if (abs > 3) return null

              const isCenter   = offset === 0
              const scale      = isCenter ? 1 : Math.max(0.5, 1 - abs * 0.2)
              const translateX = offset * 230
              const translateZ = isCenter ? 50 : -abs * 100
              const rotateY    = offset * -14
              const opacity    = isCenter ? 1 : Math.max(0.2, 1 - abs * 0.3)

              return (
                <div key={game.id}
                     onClick={() => isCenter ? launchCurrent() : setGameIdx(i)}
                     style={{
                       position: 'absolute',
                       cursor: 'pointer',
                       transition: 'all 0.35s cubic-bezier(0.34,1.2,0.64,1)',
                       transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                       opacity,
                       zIndex: 10 - abs,
                       transformStyle: 'preserve-3d',
                     }}>
                  <div style={{
                    width: isCenter ? 210 : 160,
                    height: isCenter ? 280 : 210,
                    borderRadius: 14,
                    overflow: 'hidden',
                    transition: 'all 0.35s ease',
                    boxShadow: isCenter
                      ? `0 0 50px ${meta.glow}60, 0 20px 50px rgba(0,0,0,0.9)`
                      : '0 8px 30px rgba(0,0,0,0.7)',
                    border: isCenter ? `2px solid ${meta.glow}50` : '1px solid #ffffff08',
                  }}>
                    {game.thumb && Math.abs(offset) <= 2 ? (
                      <img
                        src={game.thumb}
                        alt={game.nome}
                        loading="lazy"
                        decoding="async"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{
                        width: '100%', height: '100%',
                        background: `linear-gradient(135deg, ${meta.color}30, #000)`,
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', gap: 10, padding: 12,
                      }}>
                        <span style={{ fontSize: 40 }}>{meta.emoji}</span>
                        <span style={{ color: '#fff', fontSize: 12, textAlign: 'center',
                                       fontWeight: 600, lineHeight: 1.3 }}>{game.nome}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Info rodapé */}
      {currentGame && (
        <div className="absolute bottom-0 left-0 right-0 z-20"
             style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, transparent 100%)',
                      paddingTop: 60, paddingBottom: 24, textAlign: 'center' }}>
          <h2 style={{ color: '#fff', fontSize: 26, fontWeight: 700, marginBottom: 4,
                       textShadow: `0 0 20px ${meta.glow}` }}>
            {currentGame.nome}
          </h2>
          <p style={{ color: '#ffffff60', fontSize: 13, marginBottom: 16 }}>
            {meta.label} · {gameIdx + 1} / {filteredGames.length}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
            <button onClick={launchCurrent}
              style={{
                background: `linear-gradient(135deg, ${meta.color}, ${meta.glow})`,
                color: '#fff', border: 'none', borderRadius: 10,
                padding: '11px 28px', fontSize: 14, fontWeight: 700,
                cursor: 'pointer', boxShadow: `0 4px 16px ${meta.glow}50`,
              }}>▶ Jogar</button>
          </div>
          <p style={{ color: '#ffffff25', fontSize: 11, marginTop: 10 }}>
            ◀▶ navegar · A jogar · Guide menu · B / Esc sair
          </p>
        </div>
      )}

      {/* Launch animation */}
      {launching && launchGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
             style={{ animation: 'rvBlackIn 0.9s forwards',
                      background: 'rgba(0,0,0,0)' }}>
          {launchGame.thumb && (
            <img src={launchGame.thumb} alt=""
                 style={{ width: 260, height: 340, objectFit: 'cover', borderRadius: 18,
                          animation: 'rvCardOut 0.9s forwards',
                          boxShadow: `0 0 80px ${meta.glow}` }} />
          )}
          <style>{`
            @keyframes rvBlackIn { 0%{background:rgba(0,0,0,0)} 100%{background:rgba(0,0,0,0.98)} }
            @keyframes rvCardOut { 0%{transform:scale(1);opacity:1} 100%{transform:scale(1.25);opacity:0} }
          `}</style>
        </div>
      )}

      {/* Toast de confirmação de saída */}
      {confirmExit && (
        <div className="fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2"
             style={{ animation: 'rvFadeIn 0.2s ease' }}>
          <div style={{
            background: '#0f0f18', border: `1px solid ${meta.glow}60`,
            borderRadius: 16, padding: '28px 40px', textAlign: 'center',
            boxShadow: `0 0 40px ${meta.glow}30, 0 20px 60px rgba(0,0,0,0.9)`,
          }}>
            <p style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              Sair do RetroVision?
            </p>
            <p style={{ color: '#ffffff60', fontSize: 13, marginBottom: 20 }}>
              Pressione B / Esc novamente para confirmar
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={confirmExitNow}
                style={{
                  background: `${meta.color}`, color: '#fff', border: 'none',
                  borderRadius: 10, padding: '10px 24px', fontSize: 14,
                  fontWeight: 700, cursor: 'pointer',
                }}>Sair</button>
              <button onClick={() => setConfirmExit(false)}
                style={{
                  background: 'rgba(255,255,255,0.08)', color: '#ffffff80',
                  border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10,
                  padding: '10px 24px', fontSize: 14, cursor: 'pointer',
                }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Menu Guide */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
             style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)' }}>
          <div style={{
            background: '#0f0f18', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 18, overflow: 'hidden', width: 260,
            boxShadow: '0 30px 80px rgba(0,0,0,0.9)',
          }}>
            <div style={{ padding: '18px 22px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>RetroVision</p>
            </div>
            {menuItems.map((item, i) => (
              <button key={i} onClick={item.action} onMouseEnter={() => setMenuIdx(i)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                  padding: '13px 22px', border: 'none', cursor: 'pointer',
                  background: i === menuIdx ? `${meta.color}35` : 'transparent',
                  color: i === menuIdx ? '#fff' : '#ffffff70',
                  fontSize: 14, textAlign: 'left',
                  borderLeft: `3px solid ${i === menuIdx ? meta.glow : 'transparent'}`,
                  transition: 'all 0.15s',
                }}>
                <span>{item.icon}</span><span>{item.label}</span>
              </button>
            ))}
            <div style={{ padding: '10px 22px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ color: '#ffffff30', fontSize: 11, textAlign: 'center' }}>
                A confirmar · B / Guide fechar
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
