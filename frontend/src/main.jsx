import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import { useInputMode } from '@/hooks/useInputMode'
import Navbar         from '@/components/Navbar'
import LoginPage      from '@/pages/LoginPage'
import LibraryPage    from '@/pages/LibraryPage'
import PlayerPage     from '@/pages/PlayerPage'
import AdminPage      from '@/pages/AdminPage'
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

// Dentro do BrowserRouter para ter acesso ao useNavigate
function AppRoutes() {
  const { user } = useAuth()
  const [retroVision, setRetroVision] = useState(false)

  useEffect(() => {
    const onConnect    = () => {
      if (!window.location.pathname.startsWith('/play/')) setRetroVision(true)
    }
    const onDisconnect = () => setRetroVision(false)
    window.addEventListener('gamepadconnected',    onConnect)
    window.addEventListener('gamepaddisconnected', onDisconnect)
    // ESC global sai do RetroVision
    const onKey = (e) => { if (e.key === 'Escape') setRetroVision(false) }
    window.addEventListener('keydown', onKey)
    // Verifica controle já conectado
    if ([...(navigator.getGamepads?.() || [])].some(Boolean)) setRetroVision(true)
    return () => {
      window.removeEventListener('gamepadconnected',    onConnect)
      window.removeEventListener('gamepaddisconnected', onDisconnect)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  if (retroVision && user) {
    return (
      <RetroVisionPage
        onExit={() => setRetroVision(false)}
        onLaunch={(id) => {
          setRetroVision(false)   // desmonta RetroVision
          // Pequeno delay deixa o React processar o unmount antes do navigate
          setTimeout(() => {
            window.location.href = `/play/${id}`
          }, 50)
        }}
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
