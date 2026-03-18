// Toast notifications
let toastContainer = null

function getContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div')
    toastContainer.className = 'toast-container'
    document.body.appendChild(toastContainer)
  }
  return toastContainer
}

export function toast(msg, type = '', duration = 3000) {
  const el = document.createElement('div')
  el.className = `toast ${type}`
  el.textContent = msg
  getContainer().appendChild(el)
  setTimeout(() => el.remove(), duration)
}

export function toastOk(msg)  { toast(msg, 'success') }
export function toastErr(msg) { toast(msg, 'error') }

// Modal simples
export function showModal(html, onClose) {
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `<div class="modal">${html}</div>`
  overlay.addEventListener('click', e => {
    if (e.target === overlay) { overlay.remove(); onClose?.() }
  })
  document.body.appendChild(overlay)
  return {
    el: overlay.querySelector('.modal'),
    close: () => { overlay.remove(); onClose?.() },
  }
}

// Navbar ativa
export function setActiveNav(href) {
  document.querySelectorAll('.nav-link').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === href)
  })
}

// Skeleton loaders
export function skeletonGrid(n = 12, cols = '') {
  return Array.from({length: n}).map(() =>
    `<div class="game-card skeleton" style="aspect-ratio:3/4${cols}"></div>`
  ).join('')
}

// Formata data
export function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' })
}
