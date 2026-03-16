import { useState, useEffect } from 'react'
import { api } from '@/lib/api'

const TABS = ['ROMs', 'Usuários', 'Sessões', 'Configurações']

export default function AdminPage() {
  const [tab, setTab] = useState('ROMs')

  return (
    <div className="min-h-screen bg-steam-bg">
      <div className="bg-steam-card border-b border-steam-border px-6 py-4">
        <h1 className="text-xl font-bold text-white">Painel Administrativo</h1>
        <p className="text-steam-muted text-sm mt-0.5">Gerencie ROMs, usuários e configurações do sistema</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-steam-border bg-steam-card px-6 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors focus-gamepad
              ${tab === t ? 'border-steam-accent text-steam-accent' : 'border-transparent text-steam-muted hover:text-steam-text'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {tab === 'ROMs'          && <RomsTab />}
        {tab === 'Usuários'      && <UsersTab />}
        {tab === 'Sessões'       && <SessionsTab />}
        {tab === 'Configurações' && <ConfigTab />}
      </div>
    </div>
  )
}

/* ── ROMs ── */
function RomsTab() {
  const [games, setGames]   = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg]       = useState('')
  const [fetchingAll, setFetchingAll] = useState(false)
  const [form, setForm]     = useState({ nome: '', sistema: '', descricao: '', tags: '' })

  const load = () => api.games().then(d => setGames(d.games || [])).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const upload = async (e) => {
    e.preventDefault()
    const romFile   = document.getElementById('rom-file').files[0]
    const thumbFile = document.getElementById('thumb-file').files[0]
    if (!romFile) return setMsg('Selecione um arquivo ROM.')
    setUploading(true)
    const fd = new FormData()
    fd.append('rom',      romFile)
    fd.append('nome',     form.nome || romFile.name.replace(/\.[^.]+$/, ''))
    fd.append('sistema',  form.sistema)
    fd.append('descricao',form.descricao)
    fd.append('tags',     form.tags)
    if (thumbFile) fd.append('thumb', thumbFile)
    try {
      const d = await api.uploadRom(fd)
      setMsg(d.message || 'ROM enviada!')
      setForm({ nome: '', sistema: '', descricao: '', tags: '' })
      load()
    } catch (err) { setMsg('Erro: ' + err.message) }
    finally { setUploading(false) }
  }

  const deleteRom = async (id, nome) => {
    if (!confirm(`Deletar "${nome}"?`)) return
    await api.deleteRom(id)
    load()
  }

  const fetchThumb = async (id) => {
    try {
      await api.fetchThumb(id)
      load()
      setMsg('Thumbnail atualizada!')
    } catch { setMsg('Thumbnail não encontrada.') }
  }

  const fetchAll = async () => {
    setFetchingAll(true)
    try {
      const d = await api.fetchAllThumbs()
      setMsg(`Thumbnails: ${d.atualizadas} atualizadas, ${d.falhas} falhas.`)
      load()
    } catch (err) { setMsg('Erro: ' + err.message) }
    finally { setFetchingAll(false) }
  }

  return (
    <div className="space-y-6">
      {/* Upload form */}
      <Card title="Adicionar ROM">
        <form onSubmit={upload} className="grid sm:grid-cols-2 gap-4">
          <Field label="Nome do jogo">
            <input value={form.nome} onChange={e => setForm(f=>({...f,nome:e.target.value}))}
              placeholder="Ex: Final Fantasy VII" className={input} />
          </Field>
          <Field label="Sistema *">
            <select value={form.sistema} required onChange={e => setForm(f=>({...f,sistema:e.target.value}))} className={input}>
              <option value="">Selecione...</option>
              {['ps1','snes','n64','gba','gbc','gb','megadrive','nes'].map(s => (
                <option key={s} value={s}>{s.toUpperCase()}</option>
              ))}
            </select>
          </Field>
          <Field label="Arquivo ROM *">
            <input id="rom-file" type="file" accept=".bin,.iso,.cue,.sfc,.smc,.nes,.gba,.gbc,.gb,.n64,.z64,.md,.gen"
              className={input} required />
          </Field>
          <Field label="Thumbnail (opcional)">
            <input id="thumb-file" type="file" accept="image/*" className={input} />
          </Field>
          <Field label="Descrição" className="sm:col-span-2">
            <input value={form.descricao} onChange={e => setForm(f=>({...f,descricao:e.target.value}))}
              placeholder="Descrição do jogo..." className={input} />
          </Field>
          <Field label="Tags" className="sm:col-span-2">
            <input value={form.tags} onChange={e => setForm(f=>({...f,tags:e.target.value}))}
              placeholder="rpg, ação, aventura..." className={input} />
          </Field>
          <div className="sm:col-span-2 flex gap-3 items-center flex-wrap">
            <Btn type="submit" disabled={uploading}>{uploading ? 'Enviando...' : 'Adicionar ROM'}</Btn>
            <Btn type="button" variant="secondary" onClick={fetchAll} disabled={fetchingAll}>
              {fetchingAll ? 'Buscando...' : '🔍 Buscar todas as capas'}
            </Btn>
            {msg && <p className="text-sm text-steam-accent">{msg}</p>}
          </div>
        </form>
      </Card>

      {/* Lista de ROMs */}
      <Card title={`ROMs (${games.length})`}>
        {loading ? <p className="text-steam-muted text-sm">Carregando...</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-steam-border text-steam-muted text-xs uppercase">
                  <th className="text-left py-2 pr-4">Nome</th>
                  <th className="text-left py-2 pr-4">Sistema</th>
                  <th className="text-left py-2 pr-4">Capa</th>
                  <th className="text-left py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {games.map(g => (
                  <tr key={g.id} className="border-b border-steam-border/50 hover:bg-steam-panel/50 transition-colors">
                    <td className="py-2.5 pr-4 text-steam-text">{g.nome}</td>
                    <td className="py-2.5 pr-4">
                      <span className="text-xs bg-steam-border px-2 py-0.5 rounded text-steam-muted">
                        {g.sistema?.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">
                      {g.thumb
                        ? <img src={g.thumb} alt="" className="w-8 h-10 object-cover rounded" />
                        : <span className="text-steam-muted text-xs">sem capa</span>}
                    </td>
                    <td className="py-2.5 flex gap-2 flex-wrap">
                      <button onClick={() => fetchThumb(g.id)}
                        className="text-xs text-steam-accent hover:underline">capa</button>
                      <button onClick={() => deleteRom(g.id, g.nome)}
                        className="text-xs text-red-400 hover:underline">deletar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

/* ── Usuários ── */
function UsersTab() {
  const [users, setUsers] = useState([])
  useEffect(() => { api.adminUsers().then(d => setUsers(d.users || [])) }, [])
  return (
    <Card title={`Usuários (${users.length} / 5)`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-steam-border text-steam-muted text-xs uppercase">
              <th className="text-left py-2 pr-4">Nome</th>
              <th className="text-left py-2 pr-4">Email</th>
              <th className="text-left py-2 pr-4">Admin</th>
              <th className="text-left py-2">Criado em</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-steam-border/50 hover:bg-steam-panel/50">
                <td className="py-2.5 pr-4 text-steam-text">{u.nome}</td>
                <td className="py-2.5 pr-4 text-steam-muted">{u.email}</td>
                <td className="py-2.5 pr-4">
                  {u.is_admin && <span className="text-xs bg-steam-accent text-steam-bg px-2 py-0.5 rounded font-bold">ADM</span>}
                </td>
                <td className="py-2.5 text-steam-muted text-xs">
                  {new Date(u.criado_em).toLocaleDateString('pt-BR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/* ── Sessões ── */
function SessionsTab() {
  const [sessions, setSessions] = useState([])
  const load = () => api.adminSessions().then(d => setSessions(d.sessions || []))
  useEffect(() => { load() }, [])

  const terminate = async (id) => {
    await api.terminateSession(id)
    load()
  }

  return (
    <Card title={`Sessões ativas (${sessions.length})`}>
      {sessions.length === 0
        ? <p className="text-steam-muted text-sm">Nenhuma sessão ativa.</p>
        : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-steam-border text-steam-muted text-xs uppercase">
                  <th className="text-left py-2 pr-4">Usuário</th>
                  <th className="text-left py-2 pr-4">IP</th>
                  <th className="text-left py-2 pr-4">Duração</th>
                  <th className="text-left py-2">Ação</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id} className="border-b border-steam-border/50 hover:bg-steam-panel/50">
                    <td className="py-2.5 pr-4 text-steam-text">{s.user_nome}</td>
                    <td className="py-2.5 pr-4 text-steam-muted font-mono text-xs">{s.ip_address}</td>
                    <td className="py-2.5 pr-4 text-steam-muted text-xs">{s.tempo_sessao}</td>
                    <td className="py-2.5">
                      <button onClick={() => terminate(s.id)} className="text-xs text-red-400 hover:underline">
                        encerrar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </Card>
  )
}

/* ── Configurações ── */
function ConfigTab() {
  const [config, setConfig] = useState(null)
  const [saved, setSaved]   = useState(false)
  useEffect(() => { api.adminConfig().then(d => setConfig(d.config)) }, [])

  const save = async () => {
    await api.updateConfig(config)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!config) return <p className="text-steam-muted">Carregando...</p>

  return (
    <div className="space-y-4 max-w-md">
      <Card title="Limites de sessão">
        <div className="space-y-4">
          <Field label={`Sessões simultâneas por usuário: ${config.max_sessions}`}>
            <input type="range" min={1} max={5} value={config.max_sessions}
              onChange={e => setConfig(c => ({...c, max_sessions: +e.target.value}))}
              className="w-full accent-steam-accent" />
            <div className="flex justify-between text-xs text-steam-muted mt-1">
              <span>1</span><span>5</span>
            </div>
          </Field>

          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={config.time_limit_enabled}
              onChange={e => setConfig(c => ({...c, time_limit_enabled: e.target.checked}))}
              className="w-4 h-4 accent-steam-accent" />
            <span className="text-steam-text text-sm">Limite de tempo por sessão</span>
          </label>

          {config.time_limit_enabled && (
            <Field label={`Limite: ${config.session_time_limit} min`}>
              <input type="range" min={15} max={480} step={15} value={config.session_time_limit}
                onChange={e => setConfig(c => ({...c, session_time_limit: +e.target.value}))}
                className="w-full accent-steam-accent" />
              <div className="flex justify-between text-xs text-steam-muted mt-1">
                <span>15min</span><span>8h</span>
              </div>
            </Field>
          )}

          <Btn onClick={save}>{saved ? '✓ Salvo!' : 'Salvar'}</Btn>
        </div>
      </Card>

      <Card title="Modo de emulação">
        <div className="space-y-2">
          <p className="text-steam-muted text-sm">
            Modo atual: <span className="text-steam-accent font-mono">
              {import.meta.env.VITE_EMULATION_MODE || 'local'}
            </span>
          </p>
          <p className="text-steam-muted text-xs">
            Para mudar, edite <code className="text-steam-accent">EMULATION_MODE</code> no arquivo <code className="text-steam-accent">.env</code> e reinicie os containers.
          </p>
          <div className="bg-steam-bg border border-steam-border rounded p-3 text-xs font-mono text-steam-text space-y-1">
            <p># Emulação no browser (padrão)</p>
            <p className="text-green-400">EMULATION_MODE=local</p>
            <p className="mt-2"># Streaming via servidor (em breve)</p>
            <p className="text-orange-300">EMULATION_MODE=server</p>
          </div>
        </div>
      </Card>
    </div>
  )
}

/* ── Helpers ── */
const input = `w-full bg-steam-bg border border-steam-border rounded px-3 py-2
  text-steam-text placeholder-steam-muted focus:border-steam-accent focus:outline-none text-sm`

function Card({ title, children }) {
  return (
    <div className="bg-steam-card border border-steam-border rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-steam-border bg-steam-panel">
        <h2 className="text-steam-text font-medium text-sm">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-steam-muted text-xs mb-1 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}

function Btn({ children, variant = 'primary', ...props }) {
  return (
    <button
      {...props}
      className={`px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 focus-gamepad
        ${variant === 'primary'
          ? 'bg-steam-accent hover:bg-steam-hover text-steam-bg'
          : 'bg-steam-panel border border-steam-border text-steam-text hover:border-steam-accent'}`}
    >
      {children}
    </button>
  )
}
