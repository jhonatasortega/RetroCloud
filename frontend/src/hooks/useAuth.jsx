import { createContext, useContext, useState, useEffect } from 'react'
import { api } from '@/lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('retrocloud_token')
    if (token) {
      api.me()
        .then(d => setUser(d.user))
        .catch(() => localStorage.removeItem('retrocloud_token'))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (email, senha) => {
    const data = await api.login(email, senha)
    localStorage.setItem('retrocloud_token', data.token)
    setUser(data.user)
    return data.user
  }

  const logout = async () => {
    try { await api.logout() } catch {}
    localStorage.removeItem('retrocloud_token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
