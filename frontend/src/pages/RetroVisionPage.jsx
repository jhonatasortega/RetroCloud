import { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/api'

const SYSTEM_META = {
  snes:      { label: 'Super Nintendo',  color: '#7c3aed', glow: '#a855f7', emoji: '🎮' },
  n64:       { label: 'Nintendo 64',     color: '#dc2626', glow: '#ef4444', emoji: '🕹' },
  ps1:       { label: 'PlayStation',     color: '#1d4ed8', glow: '#3b82f6', emoji: '🎯' },
  psx:       { label: 'PlayStation',     color: '#1d4ed8', glow: '#3b82f6', emoji: '🎯' },
  megadrive: { label: 'Mega Drive',      color: '#0f766e', glow: '#14b8a6', emoji: '⚡' },
  genesis:   { label: 'Mega Drive',      color: '#0f766e', glow: '#14b8a6', emoji: '⚡' },
  md:        { label: 'Mega Drive',      color: '#0f766e', glow: '#14b8a6', emoji: '⚡' },
  gba:       { label: 'Game Boy Advance',color: '#b45309', glow: '#f59e0b', emoji: '🌟' },
  gbc:       { label: 'Game Boy Color',  color: '#15803d', glow: '#22c55e', emoji: '🎨' },
  gb:        { label: 'Game Boy',        color: '#374151', glow: '#9ca3af', emoji: '📱' },
  nes:       { label: 'NES',             color: '#9f1239', glow: '#f43f5e', emoji: '🔴' },
}
const DEFAULT_META = { label: 'Outros', color: '#4b5563', glow: '#9ca3af', emoji: '🎮' }
const GUIDE = [16]
const VISIBLE_RANGE = 3 // quantos cards de cada lado renderizar

// Card memoizado com onClick estável via data-idx
const CarouselCard = memo(function CarouselCard({ game, offset, meta, isCenter }) {
  const abs = Math.abs(offset)
  return (
    <div data-cardidx={game.id} style={{
      position: 'absolute',
      cursor: 'pointer',
      transition: 'transform 0.3s cubic-bezier(0.34,1.2,0.64,1), opacity 0.3s ease',
      transform: `translateX(${offset * 220}px) translateZ(${isCenter ? 50 : -abs * 80}px) rotateY(${offset * -12}deg) scale(${isCenter ? 1 : Math.max(0.52, 1 - abs * 0.18)})`,
      opacity: isCenter ? 1 : Math.max(0.25, 1 - abs * 0.25),
      zIndex: 10 - abs,
      transformStyle: 'preserve-3d',
    }}>
      <div style={{
        width: isCenter ? 200 : 155,
        height: isCenter ? 270 : 205,
        borderRadius: 14, overflow: 'hidden',
        boxShadow: isCenter ? `0 0 50px ${meta.glow}60, 0 20px 50px rgba(0,0,0,0.9)` : '0 8px 30px rgba(0,0,0,0.7)',
        border: isCenter ? `2px solid ${meta.glow}50` : '1px solid #ffffff08',
        background: '#111',
      }}>
        {game.thumb ? (
          <img src={game.thumb} alt={game.nome} loading="lazy" decoding="async"
               style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: `linear-gradient(135deg, ${meta.color}30, #000)`,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12,
          }}>
            <span style={{ fontSize: 36 }}>{meta.emoji}</span>
            <span style={{ color: '#fff', fontSize: 11, textAlign: 'center', fontWeight: 600, lineHeight: 1.3 }}>{game.nome}</span>
          </div>
        )}
      </div>
    </div>
  )
})

export default function RetroVisionPage({ onExit, onLaunch, tvMode = false }) {
  const { logout } = useAuth()

  const [allGames, setAllGames]     = useState([])
  const [systems, setSystems]       = useState([])
  const [sysIdx, setSysIdx]         = useState(0)
  const [gameIdx, setGameIdx]       = useState(0)
  const [launching, setLaunching]   = useState(false)
  const [menuOpen, setMenuOpen]     = useState(false)
  const [menuIdx, setMenuIdx]       = useState(0)
  const [introPhase, setIntroPhase] = useState('in')
  const [confirmExit, setConfirmExit] = useState(false)
  const [confirmSel, setConfirmSel]   = useState(0)  // 0=Sair, 1=Cancelar

  const animRef    = useRef(null)
  const prevBtns   = useRef({})
  const prevAxes   = useRef({})
  const heldRef    = useRef({})   // timers de repeat por botão
  const navStart   = useRef(0)    // para skip de letra

  // Confirmação de saída
  const tryExit = useCallback(() => { if (!tvMode) { setConfirmExit(true); setConfirmSel(0) } }, [tvMode])
  const cancelExit = useCallback(() => setConfirmExit(false), [])
  const confirmExitNow = useCallback(() => { setConfirmExit(false); onExit?.() }, [onExit])

  // Intro
  useEffect(() => {
    const t = setTimeout(() => setIntroPhase('done'), 1600)
    return () => clearTimeout(t)
  }, [])

  // ESC — só abre confirmação, nunca confirma
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') tryExit() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [tryExit])

  // Setas do teclado para navegar
  useEffect(() => {
    const fn = (e) => {
      if (menuOpen || confirmExit) return
      if (e.key === 'ArrowLeft')  setGameIdx(i => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setGameIdx(i => Math.min(i + 1, filteredGamesRef.current.length - 1))
      if (e.key === 'ArrowUp')    setSysIdx(i => Math.max(0, i - 1))
      if (e.key === 'ArrowDown')  setSysIdx(i => i + 1)
      if (e.key === 'Enter')      doLaunch()
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [menuOpen, confirmExit])

  // Carrega jogos
  useEffect(() => {
    api.games().then(d => {
      const games = d.games || []
      setAllGames(games)
      setSystems([...new Set(games.map(g => g.sistema?.toLowerCase()).filter(Boolean))])
    })
  }, [])

  const currentSystem = systems[sysIdx % Math.max(1, systems.length)]
  const filteredGames = useMemo(
    () => allGames.filter(g => g.sistema?.toLowerCase() === currentSystem),
    [allGames, currentSystem]
  )
  const filteredGamesRef = useRef(filteredGames)
  useEffect(() => { filteredGamesRef.current = filteredGames }, [filteredGames])

  const safeGameIdx = Math.min(gameIdx, Math.max(0, filteredGames.length - 1))
  const currentGame = filteredGames[safeGameIdx]
  const meta = SYSTEM_META[currentSystem] || DEFAULT_META

  useEffect(() => { setGameIdx(0) }, [sysIdx])

  // Só os cards visíveis — máximo 7 elementos no DOM
  const visibleCards = useMemo(() => {
    const cards = []
    for (let i = safeGameIdx - VISIBLE_RANGE; i <= safeGameIdx + VISIBLE_RANGE; i++) {
      if (i >= 0 && i < filteredGames.length) {
        cards.push({ game: filteredGames[i], offset: i - safeGameIdx, idx: i })
      }
    }
    return cards
  }, [filteredGames, safeGameIdx])

  // Launch
  const doLaunch = useCallback(() => {
    const game = filteredGamesRef.current[safeGameIdx]  // usa ref para não criar closure
    if (!game || launching) return
    setLaunching(true)
    setTimeout(() => onLaunch?.(game.id), 600)
  }, [launching, onLaunch, safeGameIdx])

  const menuItems = useMemo(() => [
    { icon: '▶', label: 'Continuar',      action: () => setMenuOpen(false) },
    ...(!tvMode ? [{ icon: '🖥', label: 'Modo Desktop', action: () => { setMenuOpen(false); tryExit() } }] : []),
    { icon: '⏻',  label: 'Sair da conta',  action: () => { logout(); window.location.href = '/login' } },
  ], [tryExit, logout, tvMode])

  // Click no card via delegação — não passa onClick como prop
  const handleCarouselClick = useCallback((e) => {
    const card = e.target.closest('[data-cardidx]')
    if (!card) return
    const gameId = card.dataset.cardidx
    const idx = filteredGamesRef.current.findIndex(g => String(g.id) === gameId)
    if (idx === safeGameIdx) doLaunch()
    else if (idx >= 0) setGameIdx(idx)
  }, [safeGameIdx, doLaunch])

  // Repeat helper — dispara imediatamente, depois 400ms delay, depois 120ms
  const repeatFire = useCallback((key, fn) => {
    const h = heldRef.current
    if (!h[key]) return
    const now = performance.now()
    if (!h[`${key}_start`]) { h[`${key}_start`] = now; fn(); return }
    if (!h[`${key}_last`])  { h[`${key}_last`]  = now }
    const held   = now - h[`${key}_start`]
    const since  = now - h[`${key}_last`]
    if (held > 400 && since > 120) { h[`${key}_last`] = now; fn() }
  }, [])

  // Poll gamepad
  const poll = useCallback(() => {
    const gps  = navigator.getGamepads?.() || []
    const now  = performance.now()

    for (const gp of gps) {
      if (!gp) continue
      const prev  = prevBtns.current[gp.index] || {}
      const pAxes = prevAxes.current[gp.index] || { ax: 0, ay: 0 }
      const h     = heldRef.current

      const dn = (i) => !!gp.buttons[i]?.pressed
      const jd = (i) => dn(i) && !prev[i]  // just down
      const ju = (i) => !dn(i) && !!prev[i] // just up

      const ax = gp.axes[0] || 0
      const ay = gp.axes[1] || 0

      // Atualiza held state
      ;[4,5,12,13,14,15].forEach(i => {
        if (jd(i)) { h[i] = true; h[`${i}_start`] = 0; h[`${i}_last`] = 0 }
        if (ju(i)) { h[i] = false; h[`${i}_start`] = 0; h[`${i}_last`] = 0 }
      })
      // Analógico
      if (ax < -0.5 && !(pAxes.ax < -0.5)) { h.axL = true;  h.axL_start = 0; h.axL_last = 0 }
      if (ax >= -0.5 && pAxes.ax < -0.5)   { h.axL = false; h.axL_start = 0; h.axL_last = 0 }
      if (ax > 0.5  && !(pAxes.ax > 0.5))  { h.axR = true;  h.axR_start = 0; h.axR_last = 0 }
      if (ax <= 0.5 && pAxes.ax > 0.5)     { h.axR = false; h.axR_start = 0; h.axR_last = 0 }

      if (menuOpen) {
        if (jd(12) || (ay < -0.5 && pAxes.ay >= -0.5)) setMenuIdx(i => Math.max(0, i - 1))
        if (jd(13) || (ay > 0.5  && pAxes.ay <= 0.5))  setMenuIdx(i => Math.min(i + 1, menuItems.length - 1))
        if (jd(0)) menuItems[menuIdx]?.action()
        if (jd(1) || GUIDE.some(jd)) setMenuOpen(false)

      } else if (confirmExit) {
        // Navega entre Sair e Cancelar
        if (jd(14) || jd(15) || (ax < -0.5 && pAxes.ax >= -0.5) || (ax > 0.5 && pAxes.ax <= 0.5))
          setConfirmSel(s => s === 0 ? 1 : 0)
        if (jd(0)) { if (confirmSel === 0) confirmExitNow(); else cancelExit() }
        if (jd(1) || jd(2)) cancelExit()

      } else {
        // LB/RB — troca sistema com repeat
        repeatFire(4, () => setSysIdx(i => Math.max(0, i - 1)))
        repeatFire(5, () => setSysIdx(i => i + 1))

        // D-pad esq/dir + analógico — navega com repeat e skip de letra
        const goLeft = () => {
          setGameIdx(cur => {
            const games = filteredGamesRef.current
            const held = now - (navStart.current || now)
            if (held > 1500 && cur > 0) {
              const curL = games[cur]?.nome?.[0]?.toUpperCase() || ''
              for (let i = cur - 1; i >= 0; i--) {
                const l = games[i]?.nome?.[0]?.toUpperCase()
                if (l && l < curL) {
                  const first = games.findIndex(g => g.nome?.[0]?.toUpperCase() === l)
                  navStart.current = now
                  return first >= 0 ? first : i
                }
              }
              navStart.current = now; return 0
            }
            return Math.max(0, cur - 1)
          })
        }
        const goRight = () => {
          setGameIdx(cur => {
            const games = filteredGamesRef.current
            const held = now - (navStart.current || now)
            if (held > 1500 && cur < games.length - 1) {
              const curL = games[cur]?.nome?.[0]?.toUpperCase() || ''
              const idx  = games.findIndex((g, i) => i > cur && (g.nome?.[0]?.toUpperCase() || '') > curL)
              navStart.current = now
              return idx >= 0 ? idx : games.length - 1
            }
            return Math.min(cur + 1, games.length - 1)
          })
        }

        repeatFire(14,  goLeft)
        repeatFire(15,  goRight)
        repeatFire('axL', goLeft)
        repeatFire('axR', goRight)

        if (h[14] || h[15] || h.axL || h.axR) {
          if (!navStart.current) navStart.current = now
        } else {
          navStart.current = 0
        }

        // D-pad cima/baixo — troca sistema
        if (jd(12) || (ay < -0.5 && pAxes.ay >= -0.5)) setSysIdx(i => Math.max(0, i - 1))
        if (jd(13) || (ay > 0.5  && pAxes.ay <= 0.5))  setSysIdx(i => i + 1)

        if (jd(0)) doLaunch()
        if (GUIDE.some(jd)) { setMenuOpen(true); setMenuIdx(0) }
        if (jd(1) && !tvMode) tryExit()
      }

      prevBtns.current[gp.index] = Object.fromEntries(gp.buttons.map((b,i) => [i, b.pressed]))
      prevAxes.current[gp.index] = { ax, ay }
    }
    animRef.current = requestAnimationFrame(poll)
  }, [menuOpen, menuIdx, confirmExit, confirmSel, menuItems, doLaunch, tryExit, cancelExit, confirmExitNow, repeatFire])

  useEffect(() => {
    animRef.current = requestAnimationFrame(poll)
    return () => cancelAnimationFrame(animRef.current)
  }, [poll])

  // ── Intro ──
  if (introPhase === 'in') return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center">
      <div style={{ animation: 'rvIn 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.2s both' }}>
        <div style={{ fontSize: 64, textAlign: 'center', marginBottom: 12 }}>🎮</div>
        <h1 style={{ color: '#fff', fontSize: 38, fontWeight: 800, letterSpacing: 8, textAlign: 'center', textTransform: 'uppercase', textShadow: '0 0 40px rgba(102,192,244,0.8)' }}>RetroCloud</h1>
        <div style={{ height: 2, background: 'linear-gradient(to right, transparent, #66c0f4, transparent)', marginTop: 10, animation: 'rvLine 0.8s ease 0.7s both', transform: 'scaleX(0)', transformOrigin: 'center' }} />
        <p style={{ color: '#66c0f4', fontSize: 11, textAlign: 'center', marginTop: 8, letterSpacing: 6, textTransform: 'uppercase', opacity: 0, animation: 'rvFade 0.5s ease 1.1s forwards' }}>RetroVision</p>
      </div>
      <style>{`
        @keyframes rvIn   { from{opacity:0;transform:scale(0.85)} to{opacity:1;transform:scale(1)} }
        @keyframes rvLine { from{transform:scaleX(0)} to{transform:scaleX(1)} }
        @keyframes rvFade { from{opacity:0} to{opacity:1} }
      `}</style>
    </div>
  )

  if (!systems.length) return (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <p className="text-white animate-pulse">Carregando...</p>
    </div>
  )

  return (
    <div className="fixed inset-0 overflow-hidden select-none" style={{ background: '#0a0a0f' }}>

      {/* Fundo */}
      <div className="absolute inset-0 pointer-events-none transition-all duration-700"
           style={{ background: `radial-gradient(ellipse 80% 60% at 50% 35%, ${meta.glow}15 0%, transparent 70%)` }} />
      {currentGame?.thumb && (
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: `url(${currentGame.thumb})`, backgroundSize: 'cover',
          backgroundPosition: 'center', filter: 'blur(60px) saturate(1.5)', opacity: 0.06,
        }} />
      )}

      {/* Sistemas */}
      <div className="relative z-10 pt-5 pb-1">
        <div className="flex items-end justify-center gap-1 px-4 flex-wrap">
          {systems.map((sys, i) => {
            const m = SYSTEM_META[sys] || DEFAULT_META
            const active = i === sysIdx % systems.length
            return (
              <button key={sys} onClick={() => setSysIdx(i)} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                padding: '6px 12px', borderRadius: 12, border: `1px solid ${active ? m.glow : 'transparent'}`,
                background: active ? `${m.color}30` : 'transparent',
                transform: active ? 'scale(1.08)' : 'scale(0.88)',
                transition: 'all 0.2s', cursor: 'pointer',
              }}>
                <span style={{ fontSize: active ? 22 : 17 }}>{m.emoji}</span>
                <span style={{ fontSize: 9, color: active ? '#fff' : '#ffffff45', fontWeight: active ? 700 : 400, whiteSpace: 'nowrap' }}>{m.label}</span>
              </button>
            )
          })}
        </div>
        <p style={{ textAlign: 'center', color: '#ffffff20', fontSize: 9, marginTop: 4 }}>
          LB ◀ sistema ▶ RB · ↑↓ D-pad
        </p>
      </div>

      {/* Carrossel — só renderiza cards visíveis */}
      <div className="relative z-10 flex items-center justify-center"
           style={{ height: 'calc(100vh - 210px)', perspective: '1200px' }}
           onClick={handleCarouselClick}>
        {filteredGames.length === 0 ? (
          <p style={{ color: '#ffffff30' }}>Nenhum jogo neste sistema</p>
        ) : (
          <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {visibleCards.map(({ game, offset }) => (
              <CarouselCard key={game.id} game={game} offset={offset} meta={meta} isCenter={offset === 0} />
            ))}
          </div>
        )}
      </div>

      {/* Info rodapé */}
      {currentGame && (
        <div className="absolute bottom-0 left-0 right-0 z-20" style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, transparent 100%)',
          paddingTop: 50, paddingBottom: 20, textAlign: 'center',
        }}>
          <h2 style={{ color: '#fff', fontSize: 24, fontWeight: 700, marginBottom: 3, textShadow: `0 0 20px ${meta.glow}` }}>
            {currentGame.nome}
          </h2>
          <p style={{ color: '#ffffff50', fontSize: 12, marginBottom: 14 }}>
            {meta.label} · {safeGameIdx + 1} / {filteredGames.length}
          </p>
          <button onClick={doLaunch} style={{
            background: `linear-gradient(135deg, ${meta.color}, ${meta.glow})`,
            color: '#fff', border: 'none', borderRadius: 10,
            padding: '10px 26px', fontSize: 14, fontWeight: 700,
            cursor: 'pointer', boxShadow: `0 4px 16px ${meta.glow}50`,
          }}>▶ Jogar</button>
          <p style={{ color: '#ffffff20', fontSize: 10, marginTop: 8 }}>
            {tvMode ? '◀▶ navegar · A jogar · Guide menu' : '◀▶ navegar · A jogar · Guide menu · B sair'}
          </p>
        </div>
      )}

      {/* Launch */}
      {launching && currentGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ animation: 'rvBlack 0.6s forwards', background: 'rgba(0,0,0,0)' }}>
          {currentGame.thumb && <img src={currentGame.thumb} alt="" style={{ width: 240, height: 320, objectFit: 'cover', borderRadius: 16, animation: 'rvCard 0.6s forwards', boxShadow: `0 0 80px ${meta.glow}` }} />}
          <style>{`
            @keyframes rvBlack { to{background:rgba(0,0,0,0.98)} }
            @keyframes rvCard  { to{transform:scale(1.2);opacity:0} }
          `}</style>
        </div>
      )}

      {/* Confirmação saída */}
      {confirmExit && !tvMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
          <div style={{ background: '#0f0f18', border: `1px solid ${meta.glow}50`, borderRadius: 16, padding: '28px 40px', textAlign: 'center' }}>
            <p style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Sair do RetroVision?</p>
            <p style={{ color: '#ffffff50', fontSize: 12, marginBottom: 20 }}>A confirmar · B / X cancelar</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={confirmExitNow} onMouseEnter={() => setConfirmSel(0)}
                style={{ background: confirmSel === 0 ? meta.color : 'rgba(255,255,255,0.08)', color: confirmSel === 0 ? '#fff' : '#ffffff70', border: `2px solid ${confirmSel === 0 ? meta.glow : 'transparent'}`, borderRadius: 10, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}>Sair</button>
              <button onClick={cancelExit} onMouseEnter={() => setConfirmSel(1)}
                style={{ background: confirmSel === 1 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)', color: '#ffffff70', border: `2px solid ${confirmSel === 1 ? 'rgba(255,255,255,0.4)' : 'transparent'}`, borderRadius: 10, padding: '10px 24px', fontSize: 14, cursor: 'pointer', transition: 'all 0.15s' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Menu Guide */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)' }}>
          <div style={{ background: '#0f0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, overflow: 'hidden', width: 250 }}>
            <div style={{ padding: '16px 20px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>RetroVision</p>
            </div>
            {menuItems.map((item, i) => (
              <button key={i} onClick={item.action} onMouseEnter={() => setMenuIdx(i)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 20px', border: 'none', cursor: 'pointer',
                background: i === menuIdx ? `${meta.color}35` : 'transparent',
                color: i === menuIdx ? '#fff' : '#ffffff60', fontSize: 14, textAlign: 'left',
                borderLeft: `3px solid ${i === menuIdx ? meta.glow : 'transparent'}`,
              }}>
                <span>{item.icon}</span><span>{item.label}</span>
              </button>
            ))}
            <div style={{ padding: '8px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ color: '#ffffff25', fontSize: 10, textAlign: 'center' }}>A confirmar · B fechar</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
