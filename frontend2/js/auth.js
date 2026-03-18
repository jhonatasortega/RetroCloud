import { api, setToken } from './api.js'

export async function requireAuth() {
  const token = localStorage.getItem('rc_token')
  if (!token) { redirect('/index.html'); return null }
  try {
    const data = await api.me()
    return data.user
  } catch {
    setToken(null)
    redirect('/index.html')
    return null
  }
}

export async function requireAdmin() {
  const user = await requireAuth()
  if (!user) return null
  if (!user.is_admin) { redirect('/library.html'); return null }
  return user
}

export function redirect(url) {
  window.location.href = url
}

export function logout() {
  api.logout().catch(() => {})
  setToken(null)
  redirect('/index.html')
}
