import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [gamepadConnected, setGamepadConnected] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onConnect    = () => setGamepadConnected(true)
    const onDisconnect = () => setGamepadConnected(
      [...(navigator.getGamepads?.() || [])].some(Boolean)
    )
    window.addEventListener('gamepadconnected',    onConnect)
    window.addEventListener('gamepaddisconnected', onDisconnect)
    return () => {
      window.removeEventListener('gamepadconnected',    onConnect)
      window.removeEventListener('gamepaddisconnected', onDisconnect)
    }
  }, [])

  const emulationMode = import.meta.env.VITE_EMULATION_MODE || 'local'
  const isActive = (path) => location.pathname === path

  return (
    <nav className="bg-steam-card border-b border-steam-border px-4 py-0 flex items-center justify-between sticky top-0 z-50 h-14">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2 text-white font-bold text-lg hover:text-steam-accent transition-colors">
        <span>🎮</span>
        <span className="hidden sm:inline">RetroCloud</span>
      </Link>

      {/* Nav links */}
      <div className="hidden md:flex items-center gap-1">
        <NavLink to="/" active={isActive('/')}>Biblioteca</NavLink>
        {user?.is_admin && (
          <NavLink to="/admin" active={isActive('/admin')}>Admin</NavLink>
        )}
      </div>

      {/* Status + User */}
      <div className="flex items-center gap-3">
        {/* Indicador de gamepad */}
        <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded ${
          gamepadConnected
            ? 'text-green-400 bg-green-900/30'
            : 'text-steam-muted bg-steam-panel'
        }`}>
          <span>🕹</span>
          <span className="hidden sm:inline">{gamepadConnected ? 'Controle' : 'Sem controle'}</span>
        </div>

        {/* Modo de emulação */}
        <div className={`hidden sm:flex items-center gap-1.5 text-xs px-2 py-1 rounded ${
          emulationMode === 'local'
            ? 'text-steam-accent bg-steam-panel'
            : 'text-orange-300 bg-orange-900/30'
        }`}>
          <span>{emulationMode === 'local' ? '💻' : '☁️'}</span>
          <span>{emulationMode === 'local' ? 'Local' : 'Servidor'}</span>
        </div>

        {/* Menu do usuário */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(m => !m)}
            className="flex items-center gap-2 bg-steam-panel hover:bg-steam-border
                       px-3 py-1.5 rounded text-sm text-steam-text transition-colors focus-gamepad"
          >
            <span className="w-6 h-6 rounded-full bg-steam-accent text-steam-bg text-xs
                             flex items-center justify-center font-bold">
              {user?.nome?.[0]?.toUpperCase() || '?'}
            </span>
            <span className="hidden sm:inline max-w-24 truncate">{user?.nome}</span>
            {user?.is_admin && (
              <span className="text-xs bg-steam-accent text-steam-bg px-1.5 py-0.5 rounded font-bold hidden sm:inline">
                ADM
              </span>
            )}
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-1 w-48 bg-steam-panel border border-steam-border
                            rounded-lg shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-steam-border">
                <p className="text-steam-text text-sm font-medium">{user?.nome}</p>
                <p className="text-steam-muted text-xs truncate">{user?.email}</p>
              </div>
              {user?.is_admin && (
                <button
                  onClick={() => { navigate('/admin'); setMenuOpen(false) }}
                  className="w-full text-left px-4 py-2.5 text-sm text-steam-text
                             hover:bg-steam-border transition-colors md:hidden"
                >
                  Painel Admin
                </button>
              )}
              <button
                onClick={() => { logout(); navigate('/login') }}
                className="w-full text-left px-4 py-2.5 text-sm text-red-400
                           hover:bg-steam-border transition-colors"
              >
                Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}

function NavLink({ to, active, children }) {
  return (
    <Link
      to={to}
      className={`px-4 py-4 text-sm font-medium border-b-2 transition-colors focus-gamepad
        ${active
          ? 'border-steam-accent text-steam-accent'
          : 'border-transparent text-steam-muted hover:text-steam-text'}`}
    >
      {children}
    </Link>
  )
}
