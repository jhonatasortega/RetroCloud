import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

const MODE_CONFIG = {
  desktop:  { icon: '🖥',  label: 'Desktop',  color: 'text-steam-muted bg-steam-panel' },
  touch:    { icon: '📱',  label: 'Touch',    color: 'text-blue-400 bg-blue-900/20' },
  gamepad:  { icon: '🕹',  label: 'Controle', color: 'text-green-400 bg-green-900/30' },
}

export default function Navbar({ onRetroVision }) {
  const { user, logout } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const [menuOpen, setMenuOpen]   = useState(false)
  const [inputMode, setInputMode] = useState('mouse')

  // Lê o data-input-mode do body (atualizado pelo useInputMode global)
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setInputMode(document.body.dataset.inputMode || 'mouse')
    })
    obs.observe(document.body, { attributes: true, attributeFilter: ['data-input-mode'] })
    return () => obs.disconnect()
  }, [])

  const isActive = (path) => location.pathname === path
  const mode = MODE_CONFIG[inputMode] || MODE_CONFIG['desktop']

  return (
    <nav className="bg-steam-card border-b border-steam-border px-4 flex items-center justify-between sticky top-0 z-50 h-14">
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
      <div className="flex items-center gap-2">
        {/* Badge modo de entrada */}
        <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded transition-all duration-300 ${mode.color}`}>
          <span>{mode.icon}</span>
          <span className="hidden sm:inline">{mode.label}</span>
        </div>

        {/* Botão RetroVision — só aparece no modo gamepad */}
        {inputMode === 'gamepad' && onRetroVision && (
          <button onClick={onRetroVision}
            className="flex items-center gap-1.5 text-xs px-2 py-1 rounded
                       text-green-400 bg-green-900/30 hover:bg-green-900/50 transition-colors">
            <span>🎮</span>
            <span className="hidden sm:inline">RetroVision</span>
          </button>
        )}

        {/* Menu do usuário */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(m => !m)}
            data-gamepad-item
            className="flex items-center gap-2 bg-steam-panel hover:bg-steam-border
                       px-3 py-1.5 rounded text-sm text-steam-text transition-colors"
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
      data-gamepad-item
      className={`px-4 py-4 text-sm font-medium border-b-2 transition-colors
        ${active
          ? 'border-steam-accent text-steam-accent'
          : 'border-transparent text-steam-muted hover:text-steam-text'}`}
    >
      {children}
    </Link>
  )
}
