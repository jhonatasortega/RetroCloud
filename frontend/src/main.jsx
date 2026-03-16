import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import { useInputMode } from '@/hooks/useInputMode'
import Navbar from '@/components/Navbar'
import LoginPage   from '@/pages/LoginPage'
import LibraryPage from '@/pages/LibraryPage'
import PlayerPage  from '@/pages/PlayerPage'
import AdminPage   from '@/pages/AdminPage'
import '@/index.css'

// Ativa detecção global de modo de entrada
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

function AppLayout({ children }) {
  return (
    <>
      <Navbar />
      {children}
    </>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <InputModeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={
              <PrivateRoute>
                <AppLayout><LibraryPage /></AppLayout>
              </PrivateRoute>
            } />
            <Route path="/play/:id" element={
              <PrivateRoute>
                <AppLayout><PlayerPage /></AppLayout>
              </PrivateRoute>
            } />
            <Route path="/admin" element={
              <AdminRoute>
                <AppLayout><AdminPage /></AppLayout>
              </AdminRoute>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </InputModeProvider>
    </AuthProvider>
  </React.StrictMode>
)
