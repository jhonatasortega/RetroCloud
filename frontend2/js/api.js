const BASE = '/api'

function getToken() {
  return localStorage.getItem('rc_token')
}

export function setToken(t) {
  if (t) localStorage.setItem('rc_token', t)
  else    localStorage.removeItem('rc_token')
}

async function req(method, path, body, isForm = false) {
  const token = getToken()
  const headers = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (body && !isForm) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) {
    setToken(null)
    window.location.href = '/'
    throw new Error('Sessão expirada')
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`)
  return data
}

export const api = {
  // Auth
  login:     (email, senha)        => req('POST', '/auth/login',    { email, senha }),
  register:  (nome, email, senha)  => req('POST', '/auth/register', { nome, email, senha }),
  me:        ()                    => req('GET',  '/auth/me'),
  logout:    ()                    => req('POST', '/auth/logout'),
  changePass:(atual, nova)         => req('POST', '/auth/change-password', { senha_atual: atual, senha_nova: nova }),

  // Games
  games:     (params = {})   => {
    const qs = new URLSearchParams(Object.entries(params).filter(([,v]) => v)).toString()
    return req('GET', `/games/list${qs ? '?' + qs : ''}`)
  },
  game:      (id)            => req('GET',  `/games/${id}`),
  play:      (id)            => req('GET',  `/games/${id}/play`),
  systems:   ()              => req('GET',  '/games/systems'),
  saveState: (id, b64)       => req('POST', `/games/${id}/save`, { save_data: b64 }),
  loadState: (id)            => req('GET',  `/games/${id}/save`),

  // Netplay
  createSession:    (id)     => req('POST',   `/games/${id}/netplay`),
  getSession:       (id)     => req('GET',    `/games/${id}/netplay`),
  endSession:       (id)     => req('DELETE', `/games/${id}/netplay`),
  getActiveSessions:()       => req('GET',    '/games/netplay/active'),

  // Admin
  adminUsers:      ()        => req('GET',    '/admin/users'),
  adminCreateUser: (data)    => req('POST',   '/admin/users', data),
  adminDeleteUser: (id)      => req('DELETE', `/admin/users/${id}`),
  adminSessions:   ()        => req('GET',    '/admin/sessions'),
  adminConfig:     ()        => req('GET',    '/admin/config'),
  updateConfig:    (data)    => req('PUT',    '/admin/config', data),
  deleteRom:       (id)      => req('DELETE', `/admin/roms/${id}`),
  shutdown:        ()        => req('POST',   '/admin/shutdown'),

  // Thumbs
  fetchThumb:      (id)          => req('POST', `/scraper/rom/${id}/fetch-thumb`),
  fetchThumbNome:  (id, nome)    => req('POST', `/scraper/rom/${id}/fetch-thumb`, { nome }),
  fetchAllThumbs:  ()            => req('POST', '/scraper/roms/fetch-all-thumbs'),
  clearThumbs: (sistema)     => req('POST', '/scraper/roms/clear-thumbs', sistema ? { sistema } : {}),
  uploadThumb: (id, form)    => req('POST', `/admin/roms/${id}/thumb`, form, true),

  // Upload ROM
  uploadRom: (form) => {
    const token = getToken()
    return fetch(`${BASE}/admin/roms/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(async r => {
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data.message || `HTTP ${r.status}`)
      return data
    })
  },
}
