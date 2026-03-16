import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate  = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [form, setForm]       = useState({ email: '', senha: '' })
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.email, form.senha)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-steam-bg px-4">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="text-5xl mb-3">🎮</div>
        <h1 className="text-3xl font-bold text-white tracking-wide">RetroCloud</h1>
        <p className="text-steam-muted text-sm mt-1">Sua biblioteca retro em qualquer tela</p>
      </div>

      <div className="w-full max-w-sm">
        <form
          onSubmit={submit}
          className="bg-steam-panel border border-steam-border rounded-lg p-6 space-y-4"
        >
          <div>
            <label className="block text-steam-muted text-xs mb-1 uppercase tracking-wider">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={set('email')}
              placeholder="email@exemplo.com"
              className="w-full bg-steam-card border border-steam-border rounded px-3 py-2.5
                         text-steam-text placeholder-steam-muted focus:border-steam-accent
                         focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-steam-muted text-xs mb-1 uppercase tracking-wider">Senha</label>
            <input
              type="password"
              required
              value={form.senha}
              onChange={set('senha')}
              placeholder="••••••••"
              className="w-full bg-steam-card border border-steam-border rounded px-3 py-2.5
                         text-steam-text placeholder-steam-muted focus:border-steam-accent
                         focus:outline-none transition-colors"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            data-gamepad-item
            className="w-full bg-steam-accent hover:bg-steam-hover disabled:opacity-50
                       text-steam-bg font-bold py-3 rounded transition-colors focus-gamepad"
          >
            {loading ? 'Aguarde...' : 'Entrar'}
          </button>
        </form>

        <div className="mt-4 p-3 bg-steam-card border border-steam-border rounded text-center">
          <p className="text-steam-muted text-xs">
            Não tem acesso? Entre em contato:
          </p>
          <a
            href="mailto:suporte@retrocloud.online"
            className="text-steam-accent text-xs mt-1 block hover:underline"
          >
            suporte@retrocloud.online
          </a>
        </div>
      </div>
    </div>
  )
}
