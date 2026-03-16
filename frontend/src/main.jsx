import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import { useInputMode } from '@/hooks/useInputMode'
import Navbar          from '@/components/Navbar'
import LoginPage       from '@/pages/LoginPage'
import LibraryPage     from '@/pages/LibraryPage'
import PlayerPage      from '@/pages/PlayerPage'
import AdminPage       from '@/pages/AdminPage'
import RetroVisionPage from '@/pages/RetroVisionPage'
import '@/index.css'

function InputModeProvider({ children }) {
  useInputMode()
  return children
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-steam-bg flex items-center justify-center">
      <div className="text-steam-muted animate-pulse">Carregando...</div>
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (!user.is_admin) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  const { user } = useAuth()

  // Detecta se é TV: só tem controle, sem mouse nem touch
  const isTV = () => {
    const hasGamepad = [...(navigator.getGamepads?.() || [])].some(Boolean)
    const hasTouch   = navigator.maxTouchPoints > 0
    const hasMouse   = window.matchMedia('(pointer: fine)').matches
    return hasGamepad && !hasTouch && !hasMouse
  }

  // RetroVision ativo se: controle conectado OU voltou de um jogo com ?rv=1
  const [retroVision, setRetroVision] = useState(() => {
    return new URLSearchParams(window.location.search).get('rv') === '1'
  })
  const [tvMode, setTvMode] = useState(false)

  useEffect(() => {
    // Limpa o ?rv=1 da URL sem reload
    if (window.location.search.includes('rv=1')) {
      window.history.replaceState({}, '', window.location.pathname)
    }

    const onConnect    = () => {
      if (!window.location.pathname.startsWith('/play/')) {
        setRetroVision(true)
        setTvMode(isTV())
      }
    }
    const onDisconnect = () => {
      setRetroVision(false)
      setTvMode(false)
    }
    const onKey        = (e) => { if (e.key === 'Escape' && !tvMode) setRetroVision(false) }

    window.addEventListener('gamepadconnected',    onConnect)
    window.addEventListener('gamepaddisconnected', onDisconnect)
    window.addEventListener('keydown',             onKey)

    if ([...(navigator.getGamepads?.() || [])].some(Boolean)) {
      setRetroVision(true)
      setTvMode(isTV())
    }

    return () => {
      window.removeEventListener('gamepadconnected',    onConnect)
      window.removeEventListener('gamepaddisconnected', onDisconnect)
      window.removeEventListener('keydown',             onKey)
    }
  }, [])

  // Lança jogo: salva flag e faz redirect completo
  const handleLaunch = (id) => {
    sessionStorage.setItem('from_rv', '1')
    window.location.href = `/play/${id}`
  }

  if (retroVision && user) {
    return (
      <RetroVisionPage
        onExit={tvMode ? null : () => setRetroVision(false)}
        onLaunch={handleLaunch}
        tvMode={tvMode}
      />
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={
        <PrivateRoute>
          <>
            <Navbar onRetroVision={() => setRetroVision(true)} />
            <LibraryPage />
          </>
        </PrivateRoute>
      } />
      <Route path="/play/:id" element={
        <PrivateRoute><PlayerPage /></PrivateRoute>
      } />
      <Route path="/admin" element={
        <AdminRoute>
          <>
            <Navbar />
            <AdminPage />
          </>
        </AdminRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <InputModeProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </InputModeProvider>
    </AuthProvider>
  </React.StrictMode>
)
