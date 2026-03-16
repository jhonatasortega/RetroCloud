const BASE = import.meta.env.VITE_API_URL || '/api'

function getToken() {
  return localStorage.getItem('retrocloud_token')
}

async function req(method, path, body) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  login:     (email, senha)  => req('POST', '/auth/login', { email, senha }),
  register:  (data)          => req('POST', '/auth/register', data),
  me:        ()              => req('GET',  '/auth/me'),
  logout:    ()              => req('POST', '/auth/logout'),

  games:     (params = {})   => {
    const qs = new URLSearchParams(params).toString()
    return req('GET', `/games/list${qs ? '?' + qs : ''}`)
  },
  game:      (id)            => req('GET', `/games/${id}`),
  play:      (id)            => req('GET', `/games/${id}/play`),
  systems:   ()              => req('GET', '/games/systems'),
  comment:   (id, texto)     => req('POST', `/games/${id}/comment`, { texto }),
  saveGame:  (id, save_data) => req('POST', `/games/${id}/save`, { save_data }),
  loadSave:  (id)            => req('GET',  `/games/${id}/save`),

  // Admin
  adminUsers:      ()        => req('GET',  '/admin/users'),
  adminSessions:   ()        => req('GET',  '/admin/sessions'),
  adminConfig:     ()        => req('GET',  '/admin/config'),
  updateConfig:    (data)    => req('PUT',  '/admin/config', data),
  deleteRom:       (id)      => req('DELETE', `/admin/roms/${id}`),
  terminateSession:(id)      => req('POST', `/admin/sessions/${id}/terminate`),

  // Scraper
  fetchThumb:      (id)      => req('POST', `/scraper/rom/${id}/fetch-thumb`),
  fetchAllThumbs:  ()        => req('POST', '/scraper/roms/fetch-all-thumbs'),

  // Upload de ROM (multipart)
  uploadRom: (formData) => {
    const token = getToken()
    const headers = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    return fetch(`${BASE}/admin/roms/upload`, { method: 'POST', headers, body: formData })
      .then(r => r.json())
  },

  // Streaming
  streamStatus: () => req('GET', '/stream/status'),
}
