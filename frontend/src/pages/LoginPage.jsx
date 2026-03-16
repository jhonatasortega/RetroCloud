import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/api'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate   = useNavigate()
  const [tab, setTab]       = useState('login')   // 'login' | 'register'
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  const [form, setForm] = useState({ nome: '', email: '', senha: '' })
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (tab === 'login') {
        await login(form.email, form.senha)
      } else {
        await api.register({ nome: form.nome, email: form.email, senha: form.senha })
        await login(form.email, form.senha)
      }
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
        {/* Tabs */}
        <div className="flex mb-1 border border-steam-border rounded-t-lg overflow-hidden">
          {['login', 'register'].map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError('') }}
              className={`flex-1 py-3 text-sm font-medium transition-colors focus-gamepad
                ${tab === t
                  ? 'bg-steam-panel text-steam-accent'
                  : 'bg-steam-card text-steam-muted hover:text-steam-text'}`}
            >
              {t === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          ))}
        </div>

        {/* Card */}
        <form
          onSubmit={submit}
          className="bg-steam-panel border border-steam-border rounded-b-lg rounded-tr-lg p-6 space-y-4"
        >
          {tab === 'register' && (
            <div>
              <label className="block text-steam-muted text-xs mb-1 uppercase tracking-wider">Nome</label>
              <input
                type="text"
                required
                value={form.nome}
                onChange={set('nome')}
                placeholder="Seu nome"
                className="w-full bg-steam-card border border-steam-border rounded px-3 py-2.5
                           text-steam-text placeholder-steam-muted focus:border-steam-accent
                           focus:outline-none transition-colors"
              />
            </div>
          )}

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
            className="w-full bg-steam-accent hover:bg-steam-hover disabled:opacity-50
                       text-steam-bg font-bold py-3 rounded transition-colors focus-gamepad
                       data-gamepad-item"
            data-gamepad-item
          >
            {loading ? 'Aguarde...' : tab === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        {/* Dica do usuário padrão */}
        {tab === 'login' && (
          <div className="mt-4 p-3 bg-steam-card border border-steam-border rounded text-center">
            <p className="text-steam-muted text-xs">Primeiro acesso? Use as credenciais padrão:</p>
            <p className="text-steam-accent text-xs mt-1 font-mono">
              admin@retrocloud.local&nbsp;/&nbsp;admin
            </p>
            <p className="text-steam-muted text-xs mt-1">Troque a senha após o primeiro login.</p>
          </div>
        )}
      </div>
    </div>
  )
}
