import { useEffect, useRef, useState } from 'react'

const SYSTEM_LABELS = {
  ps1: 'PS1', psx: 'PS1',
  snes: 'SNES', n64: 'N64',
  gba: 'GBA', gbc: 'GBC', gb: 'GB',
  megadrive: 'Mega Drive', genesis: 'Mega Drive', md: 'Mega Drive',
  nes: 'NES',
}

const SYSTEM_COLORS = {
  ps1: 'bg-blue-900 text-blue-200', psx: 'bg-blue-900 text-blue-200',
  snes: 'bg-purple-900 text-purple-200',
  n64: 'bg-red-900 text-red-200',
  gba: 'bg-orange-900 text-orange-200',
  gbc: 'bg-yellow-900 text-yellow-200',
  gb:  'bg-gray-700 text-gray-200',
  megadrive: 'bg-teal-900 text-teal-200',
  genesis:   'bg-teal-900 text-teal-200',
  md:        'bg-teal-900 text-teal-200',
  nes: 'bg-red-900 text-red-200',
}

// Semáforo global — máximo 4 imagens carregando simultaneamente
let _loading = 0
const MAX_CONCURRENT = 4
const _queue = []

function requestLoad(cb) {
  if (_loading < MAX_CONCURRENT) {
    _loading++
    cb()
  } else {
    _queue.push(cb)
  }
}

function releaseLoad() {
  _loading = Math.max(0, _loading - 1)
  if (_queue.length > 0 && _loading < MAX_CONCURRENT) {
    _loading++
    const next = _queue.shift()
    next()
  }
}

export default function GameCard({ game, onClick, tabIndex = 0 }) {
  const sysKey   = game.sistema?.toLowerCase()
  const sysLabel = SYSTEM_LABELS[sysKey] || game.sistema?.toUpperCase()
  const sysColor = SYSTEM_COLORS[sysKey] || 'bg-steam-border text-steam-text'

  const [imgSrc, setImgSrc]   = useState(null)
  const [imgFail, setImgFail] = useState(false)
  const cardRef = useRef(null)

  useEffect(() => {
    if (!game.thumb || imgFail) return

    // Só carrega quando o card está visível na tela (IntersectionObserver)
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        obs.disconnect()
        // Entra na fila do semáforo
        requestLoad(() => {
          const img = new Image()
          img.onload  = () => { setImgSrc(game.thumb); releaseLoad() }
          img.onerror = () => { setImgFail(true); releaseLoad() }
          img.src = game.thumb
        })
      }
    }, { rootMargin: '100px' })

    if (cardRef.current) obs.observe(cardRef.current)
    return () => obs.disconnect()
  }, [game.thumb, imgFail])

  return (
    <button
      ref={cardRef}
      onClick={onClick}
      tabIndex={tabIndex}
      data-gamepad-item
      className="game-card focus-gamepad text-left w-full bg-steam-card border border-steam-border
                 rounded-lg overflow-hidden group animate-fadein"
    >
      <div className="aspect-[3/4] bg-steam-bg overflow-hidden relative">
        {imgSrc ? (
          <img src={imgSrc} alt={game.nome}
               className="game-card-img w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-3">
            <span className="text-4xl">🎮</span>
            <span className="text-steam-muted text-xs text-center leading-tight">{game.nome}</span>
          </div>
        )}
        <span className={`absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded ${sysColor}`}>
          {sysLabel}
        </span>
      </div>
      <div className="p-3">
        <p className="text-steam-text text-sm font-medium leading-tight line-clamp-2 group-hover:text-steam-accent transition-colors">
          {game.nome}
        </p>
      </div>
    </button>
  )
}
