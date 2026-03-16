import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import GameCard from '@/components/GameCard'
import { useGamepad, useGamepadNavigation } from '@/hooks/useGamepad'

const ALL = 'todos'

export default function LibraryPage() {
  const navigate = useNavigate()
  const [games, setGames]     = useState([])
  const [systems, setSystems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [search, setSearch]   = useState('')
  const [system, setSystem]   = useState(ALL)
  const [page, setPage]       = useState(1)
  const PER_PAGE = 24  // menos cards por página = menos requests simultâneos

  useEffect(() => {
    api.systems()
      .then(d => setSystems(d.systems || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = {}
    if (system !== ALL) params.sistema = system
    if (search)         params.search  = search
    api.games(params)
      .then(d => { setGames(d.games || []); setPage(1) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [system, search])

  // Gamepad: navega na grade, A abre o jogo
  useGamepadNavigation({
    onBack: () => navigate(-1),
  })

  // Gamepad: botão Start abre o jogo em foco
  const onAction = useCallback((btn) => {
    const BTN_START = 9
    if (btn === BTN_START) {
      const focused = document.activeElement?.closest('[data-game-id]')
      if (focused) navigate(`/play/${focused.dataset.gameId}`)
    }
  }, [navigate])
  useGamepad({ onAction })

  const paginated = games.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const totalPages = Math.ceil(games.length / PER_PAGE)

  return (
    <div className="min-h-screen bg-steam-bg">
      {/* Hero header */}
      <div className="bg-gradient-to-b from-steam-panel to-steam-bg px-6 py-8">
        <h1 className="text-2xl font-bold text-white mb-1">Sua Biblioteca</h1>
        <p className="text-steam-muted text-sm">
          {games.length} jogo{games.length !== 1 ? 's' : ''}
          {system !== ALL ? ` · ${system.toUpperCase()}` : ''}
          {search ? ` · "${search}"` : ''}
        </p>
      </div>

      {/* Filtros */}
      <div className="sticky top-14 z-40 bg-steam-card border-b border-steam-border px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap gap-3 items-center">
          {/* Busca */}
          <div className="relative flex-1 min-w-48">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-steam-muted text-sm">🔍</span>
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar jogos..."
              className="w-full bg-steam-bg border border-steam-border rounded px-3 py-2 pl-8
                         text-steam-text placeholder-steam-muted focus:border-steam-accent
                         focus:outline-none text-sm"
            />
          </div>

          {/* Filtros de sistema */}
          <div className="flex gap-1.5 flex-wrap">
            <SystemBtn label="Todos" active={system === ALL} onClick={() => setSystem(ALL)} />
            {systems.map(s => (
              <SystemBtn key={s} label={s.toUpperCase()} active={system === s} onClick={() => setSystem(s)} />
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="bg-steam-panel rounded-lg aspect-[3/4] animate-pulse" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-20">
            <p className="text-red-400 text-lg">{error}</p>
            <button onClick={() => window.location.reload()} className="mt-4 text-steam-accent hover:underline text-sm">
              Tentar novamente
            </button>
          </div>
        )}

        {!loading && !error && paginated.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🕹</div>
            <p className="text-steam-muted text-lg">Nenhum jogo encontrado</p>
            {search && (
              <button onClick={() => setSearch('')} className="mt-3 text-steam-accent hover:underline text-sm">
                Limpar busca
              </button>
            )}
          </div>
        )}

        {!loading && !error && paginated.length > 0 && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {paginated.map((game, i) => (
                <div key={game.id} data-game-id={game.id}>
                  <GameCard
                    game={game}
                    tabIndex={i}
                    onClick={() => navigate(`/play/${game.id}`)}
                  />
                </div>
              ))}
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                <PagBtn disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Anterior</PagBtn>
                <span className="px-4 py-2 text-steam-muted text-sm">
                  {page} / {totalPages}
                </span>
                <PagBtn disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Próxima →</PagBtn>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function SystemBtn({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded text-xs font-medium transition-colors focus-gamepad
        ${active
          ? 'bg-steam-accent text-steam-bg'
          : 'bg-steam-bg border border-steam-border text-steam-muted hover:text-steam-text hover:border-steam-accent'}`}
    >
      {label}
    </button>
  )
}

function PagBtn({ children, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2 bg-steam-panel border border-steam-border rounded text-sm
                 text-steam-text disabled:opacity-40 hover:border-steam-accent transition-colors"
    >
      {children}
    </button>
  )
}
