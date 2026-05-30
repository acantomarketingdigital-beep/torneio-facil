'use client'

import { useState } from 'react'
import Link from 'next/link'

type Format = 'round-robin' | 'groups' | 'knockout'
type Gender = '' | 'FEM' | 'MAS' | 'MISTO'

interface Config {
  name: string
  date: string
  venue: string
  startTime: string
  duration: number
  interval: number
  restTime: number
  courts: number
  format: Format
}

interface Team {
  id: string
  name: string
  group: string
  category: string
  gender: Gender
}

interface ScheduledMatch {
  court: number
  startMin: number
  home: Team
  away: Team
}

const toMin = (t: string) => {
  const p = t.split(':')
  return parseInt(p[0]) * 60 + parseInt(p[1])
}
const toTime = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

function buildMatchups(teams: Team[], format: Format): [Team, Team][] {
  const pairs: [Team, Team][] = []

  if (format === 'knockout') {
    for (let i = 0; i < teams.length - 1; i += 2)
      if (teams[i + 1]) pairs.push([teams[i], teams[i + 1]])
    return pairs
  }

  const groups = new Map<string, Team[]>()
  for (const t of teams) {
    let key: string
    if (format === 'groups') {
      key = `${t.group || 'U'}|${t.category}|${t.gender}`
    } else {
      key = t.category || t.gender ? `${t.category}|${t.gender}` : 'all'
    }
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(t)
  }

  for (const g of groups.values())
    for (let i = 0; i < g.length; i++)
      for (let j = i + 1; j < g.length; j++)
        pairs.push([g[i], g[j]])

  return pairs
}

function scheduleMatches(teams: Team[], config: Config): ScheduledMatch[] {
  const { courts, startTime, duration, interval, restTime, format } = config
  const start = toMin(startTime)
  const matchups = buildMatchups(teams, format)

  const courtEnd = Array(courts).fill(start)
  const teamEnd: Record<string, number> = {}
  const result: ScheduledMatch[] = []

  for (const [home, away] of matchups) {
    const ready = Math.max(teamEnd[home.id] ?? start, teamEnd[away.id] ?? start)
    let bestC = 0, bestT = Infinity
    for (let c = 0; c < courts; c++) {
      const t = Math.max(courtEnd[c], ready)
      if (t < bestT) { bestT = t; bestC = c }
    }
    const end = bestT + duration
    courtEnd[bestC] = end + interval
    teamEnd[home.id] = end + restTime
    teamEnd[away.id] = end + restTime
    result.push({ court: bestC + 1, startMin: bestT, home, away })
  }

  return result.sort((a, b) => a.startMin - b.startMin || a.court - b.court)
}

const ROW_COLORS = [
  'bg-pink-50',
  'bg-sky-50',
  'bg-emerald-50',
  'bg-amber-50',
  'bg-violet-50',
  'bg-rose-50',
]

const DEFAULT_CONFIG: Config = {
  name: '',
  date: new Date().toISOString().split('T')[0],
  venue: '',
  startTime: '08:30',
  duration: 60,
  interval: 10,
  restTime: 70,
  courts: 3,
  format: 'round-robin',
}

export default function Home() {
  const [step, setStep] = useState<'config' | 'teams' | 'table'>('config')
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG)
  const [teams, setTeams] = useState<Team[]>([
    { id: '1', name: '', group: '', category: '', gender: '' },
    { id: '2', name: '', group: '', category: '', gender: '' },
    { id: '3', name: '', group: '', category: '', gender: '' },
  ])
  const [matches, setMatches] = useState<ScheduledMatch[]>([])

  const cfg = (key: keyof Config, val: string | number) =>
    setConfig(c => ({ ...c, [key]: val }))

  const addTeam = () =>
    setTeams(t => [...t, { id: Date.now().toString(), name: '', group: '', category: '', gender: '' }])

  const removeTeam = (id: string) =>
    setTeams(t => t.length > 1 ? t.filter(x => x.id !== id) : t)

  const updateTeam = (id: string, field: keyof Team, val: string) =>
    setTeams(t => t.map(x => x.id === id ? { ...x, [field]: val } : x))

  const generate = () => {
    const valid = teams.filter(t => t.name.trim())
    if (valid.length < 2) { alert('Adicione pelo menos 2 times com nome.'); return }
    setMatches(scheduleMatches(valid, config))
    setStep('table')
  }

  const showGroup = matches.some(m => m.home.group || m.away.group)
  const showCategory = matches.some(m => m.home.category || m.away.category)
  const showGender = matches.some(m => m.home.gender || m.away.gender)

  const colorMap = new Map<string, number>()
  let ci = 0
  for (const m of matches) {
    const key = `${m.home.category}|${m.home.gender}`
    if (!colorMap.has(key)) colorMap.set(key, ci++)
  }

  const fmtDate = (d: string) => {
    if (!d) return ''
    const [y, mo, day] = d.split('-')
    return `${day}/${mo}/${y}`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .print-card { box-shadow: none !important; border-radius: 0 !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* Header */}
      <header className="no-print bg-blue-700 text-white px-4 py-3 flex items-center justify-between shadow">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏆</span>
          <span className="font-bold text-xl">TabelaPro</span>
        </div>
        <Link href="/dashboard" className="text-xs text-blue-200 hover:text-white border border-blue-500 rounded-lg px-3 py-1.5 transition-colors">
          Campeonatos salvos
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Steps */}
        <div className="no-print flex items-center gap-2 mb-6 text-sm">
          {(['config', 'teams', 'table'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className="h-px w-6 bg-gray-300" />}
              <button
                onClick={() => {
                  if (s === 'table' && matches.length === 0) return
                  setStep(s)
                }}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  step === s
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border text-gray-500 hover:border-blue-400'
                }`}
              >
                {i + 1}. {s === 'config' ? 'Torneio' : s === 'teams' ? 'Times' : 'Tabela'}
              </button>
            </div>
          ))}
        </div>

        {/* ── STEP 1: Config ── */}
        {step === 'config' && (
          <div className="bg-white rounded-2xl shadow p-6 space-y-5">
            <h2 className="font-bold text-gray-900 text-lg">Informações do torneio</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome do torneio</label>
              <input
                className="w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="Ex: Copa Municipal de Vôlei 2025"
                value={config.name}
                onChange={e => cfg('name', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                <input type="date"
                  className="w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={config.date} onChange={e => cfg('date', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Início</label>
                <input type="time"
                  className="w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={config.startTime} onChange={e => cfg('startTime', e.target.value)} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Local</label>
              <input
                className="w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="Ex: Ginásio Municipal"
                value={config.venue} onChange={e => cfg('venue', e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quadras / Campos</label>
                <input type="number" min={1} max={20}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={config.courts} onChange={e => cfg('courts', Number(e.target.value))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duração do jogo (min)</label>
                <input type="number" min={10} step={5}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={config.duration} onChange={e => cfg('duration', Number(e.target.value))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Intervalo entre jogos (min)</label>
                <input type="number" min={0} step={5}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={config.interval} onChange={e => cfg('interval', Number(e.target.value))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descanso por time (min)</label>
                <input type="number" min={0} step={5}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={config.restTime} onChange={e => cfg('restTime', Number(e.target.value))} />
              </div>
            </div>

            {/* Format */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Formato</label>
              <div className="grid grid-cols-3 gap-3">
                {([
                  { v: 'round-robin', label: 'Todos contra Todos', desc: 'Cada time enfrenta todos' },
                  { v: 'groups', label: 'Por Chaves', desc: 'Times em grupos (A, B, C...)' },
                  { v: 'knockout', label: 'Mata-Mata', desc: 'Eliminatória direta' },
                ] as const).map(f => (
                  <button key={f.v} onClick={() => cfg('format', f.v)}
                    className={`text-left p-3 rounded-xl border-2 transition-colors ${
                      config.format === f.v
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}>
                    <div className="font-semibold text-sm">{f.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{f.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <button onClick={() => setStep('teams')}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors">
              Próximo: Cadastrar Times →
            </button>
          </div>
        )}

        {/* ── STEP 2: Teams ── */}
        {step === 'teams' && (
          <div className="bg-white rounded-2xl shadow p-6 space-y-4">
            <div>
              <h2 className="font-bold text-gray-900 text-lg">Times</h2>
              <p className="text-sm text-gray-400 mt-0.5">
                {config.format === 'groups'
                  ? 'Preencha a Chave (A, B, C...). Times da mesma chave se enfrentam entre si.'
                  : config.format === 'round-robin'
                  ? 'Times com mesma Categoria e Naipe se enfrentam. Deixe em branco para todos jogarem entre si.'
                  : 'Pares formados pela ordem: 1° x 2°, 3° x 4°...'}
              </p>
            </div>

            <div className="overflow-x-auto -mx-2 px-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b">
                    <th className="pb-2 w-7 text-center">#</th>
                    <th className="pb-2 pr-2">Nome *</th>
                    {config.format === 'groups' && <th className="pb-2 pr-2 w-16 text-center">Chave</th>}
                    <th className="pb-2 pr-2 w-24 text-center">Categoria</th>
                    <th className="pb-2 pr-2 w-20 text-center">Naipe</th>
                    <th className="pb-2 w-6"></th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((t, i) => (
                    <tr key={t.id} className="border-b border-gray-50">
                      <td className="py-1.5 text-center text-xs text-gray-300">{i + 1}</td>
                      <td className="pr-2 py-1.5">
                        <input
                          className="w-full border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          placeholder={`Time ${i + 1}`}
                          value={t.name}
                          onChange={e => updateTeam(t.id, 'name', e.target.value)}
                        />
                      </td>
                      {config.format === 'groups' && (
                        <td className="pr-2 py-1.5">
                          <input
                            className="w-14 text-center border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none uppercase"
                            placeholder="A"
                            value={t.group}
                            onChange={e => updateTeam(t.id, 'group', e.target.value.toUpperCase())}
                          />
                        </td>
                      )}
                      <td className="pr-2 py-1.5">
                        <input
                          className="w-24 text-center border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none uppercase"
                          placeholder="SUB 14"
                          value={t.category}
                          onChange={e => updateTeam(t.id, 'category', e.target.value.toUpperCase())}
                        />
                      </td>
                      <td className="pr-2 py-1.5">
                        <select
                          className="w-20 border rounded-lg px-1.5 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          value={t.gender}
                          onChange={e => updateTeam(t.id, 'gender', e.target.value as Gender)}
                        >
                          <option value="">—</option>
                          <option>FEM</option>
                          <option>MAS</option>
                          <option>MISTO</option>
                        </select>
                      </td>
                      <td className="py-1.5">
                        <button onClick={() => removeTeam(t.id)}
                          className="text-gray-200 hover:text-red-400 text-xl leading-none pl-1">×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button onClick={addTeam}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
              <span className="text-base">+</span> Adicionar time
            </button>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep('config')}
                className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 text-sm transition-colors">
                ← Voltar
              </button>
              <button onClick={generate}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors">
                Gerar Tabela ⚡
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Table ── */}
        {step === 'table' && (
          <div className="space-y-4">
            <div className="no-print flex items-center justify-between">
              <button onClick={() => setStep('teams')}
                className="text-sm text-gray-500 hover:text-gray-700">
                ← Editar times
              </button>
              <button onClick={() => window.print()}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2">
                🖨️ Imprimir / Baixar PDF
              </button>
            </div>

            <div className="print-card bg-white rounded-2xl shadow p-6">
              {/* Header */}
              <div className="text-center mb-5">
                <h1 className="text-2xl font-black text-blue-800 tracking-wide uppercase">
                  {config.name || 'TORNEIO'}
                </h1>
                <p className="text-xl font-bold text-gray-700 mt-1">
                  RODADA {fmtDate(config.date)}
                </p>
                {config.venue && (
                  <p className="text-sm text-gray-500 mt-0.5 uppercase">
                    LOCAL: {config.venue}
                  </p>
                )}
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-blue-800 text-white text-xs">
                      <th className="border border-blue-700 px-3 py-2 text-center font-bold">QUADRA</th>
                      <th className="border border-blue-700 px-3 py-2 text-center font-bold">HORÁRIO</th>
                      <th className="border border-blue-700 px-3 py-2 font-bold">EQUIPE</th>
                      <th className="border border-blue-700 px-2 py-2 text-center font-bold">X</th>
                      <th className="border border-blue-700 px-3 py-2 font-bold">EQUIPE</th>
                      {showGroup && <th className="border border-blue-700 px-3 py-2 text-center font-bold">CHAVE</th>}
                      {showCategory && <th className="border border-blue-700 px-3 py-2 text-center font-bold">CATEGORIA</th>}
                      {showGender && <th className="border border-blue-700 px-3 py-2 text-center font-bold">NAIPE</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map((m, i) => {
                      const idx = colorMap.get(`${m.home.category}|${m.home.gender}`) ?? 0
                      const rowCls = ROW_COLORS[idx % ROW_COLORS.length]
                      return (
                        <tr key={i} className={rowCls}>
                          <td className="border border-gray-200 px-3 py-2 text-center font-bold">{m.court}</td>
                          <td className="border border-gray-200 px-3 py-2 text-center font-bold">{toTime(m.startMin)}</td>
                          <td className="border border-gray-200 px-3 py-2 font-bold">{m.home.name}</td>
                          <td className="border border-gray-200 px-2 py-2 text-center font-bold text-gray-400">X</td>
                          <td className="border border-gray-200 px-3 py-2 font-bold">{m.away.name}</td>
                          {showGroup && <td className="border border-gray-200 px-3 py-2 text-center font-semibold">{m.home.group || '—'}</td>}
                          {showCategory && <td className="border border-gray-200 px-3 py-2 text-center">{m.home.category || '—'}</td>}
                          {showGender && <td className="border border-gray-200 px-3 py-2 text-center">{m.home.gender || '—'}</td>}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-gray-300 text-center mt-4">
                {matches.length} jogo{matches.length !== 1 ? 's' : ''} •{' '}
                {config.courts} quadra{config.courts !== 1 ? 's' : ''} •{' '}
                {config.duration}min por jogo • TabelaPro
              </p>
            </div>

            {/* Regenerate */}
            <div className="no-print text-center">
              <button
                onClick={() => { setStep('config') }}
                className="text-sm text-gray-400 hover:text-gray-600 underline"
              >
                Criar nova tabela
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
