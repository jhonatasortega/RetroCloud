import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'

const EMULATOR_SYSTEM_MAP = {
  ps1: 'psx', psx: 'psx',
  snes: 'snes',
  n64: 'n64',
  gba: 'gba',
  gbc: 'gbc',
  gb: 'gb',
  megadrive: 'segaMD', genesis: 'segaMD', md: 'segaMD',
  nes: 'nes',
}

export default function PlayerPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const iframeRef = useRef(null)
  const emulationMode = import.meta.env.VITE_EMULATION_MODE || 'local'

  const [game, setGame]     = useState(null)
  const [playInfo, setPlay] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')
  const [gamepadConnected, setGamepadConnected] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)

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
      .then(([gameData, playData]) => {
        setGame(gameData.game)
        setPlay(playData)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  const toggleFullscreen = () => {
    const el = iframeRef.current?.parentElement
    if (!document.fullscreenElement) {
      el?.requestFullscreen?.()
      setFullscreen(true)
    } else {
      document.exitFullscreen?.()
      setFullscreen(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-steam-bg flex items-center justify-center">
      <div className="text-steam-muted text-lg animate-pulse">Carregando...</div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-steam-bg flex flex-col items-center justify-center gap-4">
      <p className="text-red-400">{error}</p>
      <button onClick={() => navigate('/')} className="text-steam-accent hover:underline text-sm">
        ← Voltar à biblioteca
      </button>
    </div>
  )

  const sysKey  = game?.sistema?.toLowerCase()
  const emuCore = EMULATOR_SYSTEM_MAP[sysKey] || sysKey
  const romUrl  = playInfo?.emulator_url || ''

  // URL do EmulatorJS embed
  const emulatorUrl = `/emulator/?system=${emuCore}&rom=${encodeURIComponent(romUrl)}`

  return (
    <div className="min-h-screen bg-steam-bg flex flex-col">
      {/* Barra superior */}
      <div className="flex items-center justify-between px-4 py-3 bg-steam-card border-b border-steam-border">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-steam-muted hover:text-steam-accent transition-colors text-sm focus-gamepad"
          >
            ← Voltar
          </button>
          <div className="h-4 w-px bg-steam-border" />
          <div>
            <h1 className="text-white font-medium text-sm">{game?.nome}</h1>
            <p className="text-steam-muted text-xs">{game?.sistema?.toUpperCase()}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status do controle */}
          <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded ${
            gamepadConnected ? 'text-green-400 bg-green-900/30' : 'text-steam-muted bg-steam-panel'
          }`}>
            <span>🕹</span>
            <span className="hidden sm:inline">{gamepadConnected ? 'Controle detectado' : 'Sem controle'}</span>
          </div>

          {/* Modo de emulação */}
          <EmulationBadge mode={emulationMode} />

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="text-steam-muted hover:text-steam-accent transition-colors text-sm px-3 py-1
                       border border-steam-border rounded focus-gamepad"
          >
            {fullscreen ? '⊠ Sair' : '⊞ Fullscreen'}
          </button>
        </div>
      </div>

      {/* Player */}
      <div className="flex-1 flex flex-col items-center justify-center bg-black">
        {emulationMode === 'local' ? (
          <div className="w-full max-w-5xl aspect-video relative">
            <iframe
              ref={iframeRef}
              src={emulatorUrl}
              className="w-full h-full border-0"
              allow="gamepad; fullscreen"
              title={game?.nome}
            />
          </div>
        ) : (
          <StreamingStub game={game} />
        )}
      </div>

      {/* Info do jogo */}
      {game?.descricao && (
        <div className="px-6 py-4 bg-steam-card border-t border-steam-border max-w-5xl mx-auto w-full">
          <p className="text-steam-muted text-sm leading-relaxed">{game.descricao}</p>
        </div>
      )}
    </div>
  )
}

function EmulationBadge({ mode }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded ${
      mode === 'local'
        ? 'text-steam-accent bg-steam-panel'
        : 'text-orange-300 bg-orange-900/30'
    }`}>
      <span>{mode === 'local' ? '💻' : '☁️'}</span>
      <span>{mode === 'local' ? 'Emulação local' : 'Streaming'}</span>
    </div>
  )
}

function StreamingStub({ game }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 text-center p-8 max-w-md">
      <div className="text-6xl">☁️</div>
      <div>
        <h2 className="text-white text-xl font-bold mb-2">Modo Streaming</h2>
        <p className="text-steam-muted text-sm leading-relaxed">
          O streaming via servidor ainda não está implementado.
          Esta funcionalidade permitirá rodar jogos no servidor e
          transmitir via WebRTC — útil para hardware sem suporte a WebGL.
        </p>
      </div>
      <div className="bg-steam-panel border border-steam-border rounded-lg p-4 w-full text-left">
        <p className="text-steam-muted text-xs uppercase tracking-wider mb-2">Requisitos previstos</p>
        <ul className="text-steam-text text-sm space-y-1">
          <li>• Hardware com GPU (NPU/NVENC)</li>
          <li>• Rede local ≤ 5ms de latência</li>
          <li>• Browser com suporte a WebRTC</li>
        </ul>
      </div>
      <p className="text-steam-muted text-xs">
        Configure <code className="text-steam-accent">EMULATION_MODE=local</code> no .env para jogar agora.
      </p>
    </div>
  )
}
