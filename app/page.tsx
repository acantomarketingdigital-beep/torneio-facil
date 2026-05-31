'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// ── Types ──────────────────────────────────────────────────────────────────────

type Gender = '' | 'FEM' | 'MAS' | 'MISTO'

interface EventDate {
  id: string
  date: string
  startTime: string
}

interface Config {
  name: string
  venue: string
  startTime: string
  duration: number
  interval: number
  restTime: number
  courts: number
  minGamesPerTeam: number
  regulation: string
  dates: EventDate[]
}

interface Team {
  id: string
  name: string
  group: string
  category: string
  gender: Gender
}

interface RegisteredTeam {
  id: string
  name: string
  category: string
  gender: string
}

interface ScheduledMatch {
  court: number
  startMin: number
  home: Team
  away: Team
}

interface DateSchedule {
  date: EventDate
  matches: ScheduledMatch[]
  roundIndex: number
}

// ── Utilities ──────────────────────────────────────────────────────────────────

const toMin = (t: string) => {
  const p = t.split(':')
  return parseInt(p[0]) * 60 + parseInt(p[1])
}
const toTime = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const fmtDate = (d: string) => {
  if (!d) return '—'
  const [y, mo, day] = d.split('-')
  return `${day}/${mo}/${y}`
}

// ── Algorithm ──────────────────────────────────────────────────────────────────

// Berger circle: each round has no team appearing twice → courts fill efficiently
function bergerRounds(teams: Team[]): [Team, Team][][] {
  const list: (Team | null)[] =
    teams.length % 2 === 0 ? [...teams] : [...teams, null]
  const N = list.length
  const fixed = list[N - 1]
  const rot = list.slice(0, N - 1) as (Team | null)[]
  const rounds: [Team, Team][][] = []

  for (let r = 0; r < N - 1; r++) {
    const round: [Team, Team][] = []
    if (fixed && rot[0]) round.push([rot[0] as Team, fixed as Team])
    for (let i = 1; i < N / 2; i++) {
      const a = rot[i], b = rot[N - 1 - i]
      if (a && b) round.push([a as Team, b as Team])
    }
    rounds.push(round)
    rot.unshift(rot.pop()!)
  }
  return rounds
}

// Auto-calculates number of keys for a division
function calcKeysCount(n: number): number {
  if (n <= 5) return 1
  if (n <= 8) return 2
  if (n <= 12) return 3
  if (n <= 16) return 4
  if (n <= 20) return 5
  return Math.ceil(n / 5)
}

// Assigns auto-generated chave letters to teams based on category+gender
function assignAutoKeys(teams: Team[]): Team[] {
  const divMap = new Map<string, Team[]>()
  for (const t of teams) {
    const key = `${t.category}|${t.gender}`
    if (!divMap.has(key)) divMap.set(key, [])
    divMap.get(key)!.push(t)
  }
  const assigned = new Map<string, string>()
  for (const divTeams of divMap.values()) {
    const keysCount = calcKeysCount(divTeams.length)
    const sorted = [...divTeams].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    sorted.forEach((team, i) => {
      const row = Math.floor(i / keysCount)
      const col = i % keysCount
      const target = row % 2 === 0 ? col : keysCount - 1 - col
      assigned.set(team.id, keysCount === 1 ? 'U' : String.fromCharCode(65 + target))
    })
  }
  return teams.map(t => ({ ...t, group: assigned.get(t.id) ?? '' }))
}

function buildMatchups(teams: Team[]): [Team, Team][] {
  const keyed = assignAutoKeys(teams)
  const groupMap = new Map<string, Team[]>()
  for (const t of keyed) {
    const key = `${t.category}|${t.gender}|${t.group}`
    if (!groupMap.has(key)) groupMap.set(key, [])
    groupMap.get(key)!.push(t)
  }

  // Berger rounds per key, then interleave across keys so courts stay busy
  const allGroupRounds = Array.from(groupMap.values()).map(bergerRounds)
  const maxR = Math.max(...allGroupRounds.map(r => r.length), 0)
  const maxG = Math.max(...allGroupRounds.flatMap(r => r.map(rd => rd.length)), 0)
  const pairs: [Team, Team][] = []

  for (let r = 0; r < maxR; r++) {
    for (let g = 0; g < maxG; g++) {
      for (const groupRounds of allGroupRounds) {
        if (r < groupRounds.length && g < groupRounds[r].length)
          pairs.push(groupRounds[r][g])
      }
    }
  }

  return pairs
}

function repeatMatchups(base: [Team, Team][], minGames: number): [Team, Team][] {
  if (minGames <= 0 || base.length === 0) return base

  const counts = new Map<string, number>()
  for (const [h, a] of base) {
    counts.set(h.id, (counts.get(h.id) ?? 0) + 1)
    counts.set(a.id, (counts.get(a.id) ?? 0) + 1)
  }
  const maxPerRound = Math.max(...Array.from(counts.values()), 1)
  const rounds = Math.ceil(minGames / maxPerRound)

  const all: [Team, Team][] = []
  for (let r = 0; r < rounds; r++) all.push(...base)
  return all
}

function scheduleDay(
  matchups: [Team, Team][],
  courts: number,
  startMin: number,
  duration: number,
  interval: number,
  restTime: number
): ScheduledMatch[] {
  const courtEnd = Array(courts).fill(startMin)
  const teamEnd: Record<string, number> = {}
  const result: ScheduledMatch[] = []

  for (const [home, away] of matchups) {
    const ready = Math.max(teamEnd[home.id] ?? startMin, teamEnd[away.id] ?? startMin)
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

  return result.sort((a, b) => a.court - b.court || a.startMin - b.startMin)
}

function generateSchedule(teams: Team[], config: Config): DateSchedule[] {
  const validDates = config.dates.filter(d => d.date)
  if (validDates.length === 0) return []

  const base = buildMatchups(teams)
  const all = repeatMatchups(base, config.minGamesPerTeam)

  // Distribute round-robin style across dates
  const n = validDates.length
  const buckets: [Team, Team][][] = Array.from({ length: n }, () => [])
  all.forEach((m, i) => buckets[i % n].push(m))

  return validDates.map((date, i) => ({
    date,
    roundIndex: i + 1,
    matches: scheduleDay(
      buckets[i],
      config.courts,
      toMin(date.startTime || config.startTime),
      config.duration,
      config.interval,
      config.restTime
    ),
  }))
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ROW_COLORS = ['bg-pink-50', 'bg-sky-50', 'bg-emerald-50', 'bg-amber-50', 'bg-violet-50', 'bg-rose-50']
const today = new Date().toISOString().split('T')[0]

const DEFAULT_CONFIG: Config = {
  name: '',
  venue: '',
  startTime: '08:30',
  duration: 60,
  interval: 10,
  restTime: 70,
  courts: 3,
  minGamesPerTeam: 0,
  regulation: '',
  dates: [{ id: '1', date: today, startTime: '08:30' }],
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Home() {
  const [step, setStep] = useState<'config' | 'teams' | 'table'>('config')
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG)
  const [teams, setTeams] = useState<Team[]>([
    { id: '1', name: '', group: '', category: '', gender: '' },
    { id: '2', name: '', group: '', category: '', gender: '' },
    { id: '3', name: '', group: '', category: '', gender: '' },
  ])
  const [schedules, setSchedules] = useState<DateSchedule[]>([])
  const [user, setUser] = useState<{ id: string } | null | undefined>(undefined)
  const [suggestions, setSuggestions] = useState<RegisteredTeam[]>([])
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null))
  }, [])

  // ── Config helpers ─────────────────────────────────────────────────────────

  const cfg = (key: keyof Config, val: string | number) =>
    setConfig(c => ({ ...c, [key]: val }))

  const addDate = () => setConfig(c => ({
    ...c,
    dates: [...c.dates, { id: Date.now().toString(), date: '', startTime: c.startTime }],
  }))
  const removeDate = (id: string) =>
    setConfig(c => ({ ...c, dates: c.dates.filter(d => d.id !== id) }))
  const updateDate = (id: string, field: keyof EventDate, val: string) =>
    setConfig(c => ({
      ...c,
      dates: c.dates.map(d => d.id === id ? { ...d, [field]: val } : d),
    }))

  // ── Teams helpers ──────────────────────────────────────────────────────────

  const addTeam = () =>
    setTeams(t => [...t, { id: Date.now().toString(), name: '', group: '', category: '', gender: '' }])
  const removeTeam = (id: string) =>
    setTeams(t => t.length > 1 ? t.filter(x => x.id !== id) : t)
  const updateTeam = (id: string, field: keyof Team, val: string) =>
    setTeams(t => t.map(x => x.id === id ? { ...x, [field]: val } : x))

  // ── Autocomplete ───────────────────────────────────────────────────────────

  const fetchSuggestions = useCallback((teamId: string, query: string) => {
    clearTimeout(debounceRef.current)
    if (!user || !query.trim()) { setSuggestions([]); setActiveTeamId(null); return }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/teams/search?q=${encodeURIComponent(query)}`)
      if (res.ok) {
        const data = await res.json()
        setSuggestions(data)
        setActiveTeamId(data.length > 0 ? teamId : null)
      }
    }, 280)
  }, [user])

  const applySuggestion = (teamId: string, s: RegisteredTeam) => {
    updateTeam(teamId, 'name', s.name)
    if (s.category) updateTeam(teamId, 'category', s.category)
    if (s.gender) updateTeam(teamId, 'gender', s.gender as Gender)
    setSuggestions([])
    setActiveTeamId(null)
  }

  // ── Generate ───────────────────────────────────────────────────────────────

  const generate = () => {
    const valid = teams.filter(t => t.name.trim())
    if (valid.length < 2) { alert('Adicione pelo menos 2 times com nome.'); return }
    if (config.dates.every(d => !d.date)) { alert('Adicione pelo menos uma data.'); return }

    const result = generateSchedule(valid, config)
    setSchedules(result)
    setStep('table')
    setSaved(false)

    if (user) {
      fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(valid),
      }).then(() => setSaved(true)).catch(() => {})
    }
  }

  // ── Display helpers ────────────────────────────────────────────────────────

  const allMatches = schedules.flatMap(s => s.matches)
  const showGroup = allMatches.some(m => m.home.group || m.away.group)
  const showCategory = allMatches.some(m => m.home.category || m.away.category)
  const showGender = allMatches.some(m => m.home.gender || m.away.gender)

  const colorMap = new Map<string, number>()
  let ci = 0
  for (const m of allMatches) {
    const k = `${m.home.category}|${m.home.gender}`
    if (!colorMap.has(k)) colorMap.set(k, ci++)
  }
  const rowColor = (m: ScheduledMatch) =>
    ROW_COLORS[(colorMap.get(`${m.home.category}|${m.home.gender}`) ?? 0) % ROW_COLORS.length]

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .print-card { box-shadow: none !important; border-radius: 0 !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .page-break { page-break-before: always; }
        }
      `}</style>

      {/* Header */}
      <header className="no-print bg-blue-700 text-white px-4 py-3 flex items-center justify-between shadow">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏆</span>
          <span className="font-bold text-xl">TabelaPro</span>
        </div>
        <div className="flex items-center gap-3">
          {user === undefined ? null : user ? (
            <>
              <Link href="/times" className="text-xs text-blue-200 hover:text-white">Times</Link>
              <Link href="/dashboard" className="text-xs text-blue-200 hover:text-white border border-blue-500 rounded-lg px-3 py-1.5">Dashboard</Link>
            </>
          ) : (
            <Link href="/login" className="text-xs text-white border border-blue-400 rounded-lg px-3 py-1.5 hover:bg-blue-600 transition-colors">
              Entrar
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Step indicator */}
        <div className="no-print flex items-center gap-2 mb-6">
          {(['config', 'teams', 'table'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className="h-px w-6 bg-gray-300" />}
              <button
                onClick={() => { if (s === 'table' && schedules.length === 0) return; setStep(s) }}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  step === s ? 'bg-blue-600 text-white' : 'bg-white border text-gray-500 hover:border-blue-400'
                }`}
              >
                {i + 1}. {s === 'config' ? 'Torneio' : s === 'teams' ? 'Times' : 'Tabela'}
              </button>
            </div>
          ))}
        </div>

        {/* ── STEP 1: Config ──────────────────────────────────────────────────── */}
        {step === 'config' && (
          <div className="bg-white rounded-2xl shadow p-6 space-y-6">
            <h2 className="font-bold text-gray-900 text-lg">Informações do torneio</h2>

            {/* Basic */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do torneio</label>
                <input
                  className="w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Ex: Copa Municipal de Vôlei 2025"
                  value={config.name}
                  onChange={e => cfg('name', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Local</label>
                <input
                  className="w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Ex: Ginásio Municipal"
                  value={config.venue}
                  onChange={e => cfg('venue', e.target.value)}
                />
              </div>
            </div>

            {/* Dates */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Datas do torneio</label>
                <button onClick={addDate} className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                  <span>+</span> Adicionar data
                </button>
              </div>
              <div className="space-y-2">
                {config.dates.map((d, i) => (
                  <div key={d.id} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-16 shrink-0">Rodada {i + 1}</span>
                    <input type="date"
                      className="flex-1 border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      value={d.date}
                      onChange={e => updateDate(d.id, 'date', e.target.value)}
                    />
                    <input type="time"
                      className="w-28 border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      value={d.startTime}
                      onChange={e => updateDate(d.id, 'startTime', e.target.value)}
                    />
                    {config.dates.length > 1 && (
                      <button onClick={() => removeDate(d.id)} className="text-gray-300 hover:text-red-400 text-xl leading-none">×</button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Courts & time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quadras / Campos</label>
                <input type="number" min={1} max={20}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={config.courts}
                  onChange={e => cfg('courts', Number(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duração do jogo (min)</label>
                <input type="number" min={10} step={5}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={config.duration}
                  onChange={e => cfg('duration', Number(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Intervalo entre jogos (min)</label>
                <input type="number" min={0} step={5}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={config.interval}
                  onChange={e => cfg('interval', Number(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descanso mínimo por time (min)</label>
                <input type="number" min={0} step={5}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={config.restTime}
                  onChange={e => cfg('restTime', Number(e.target.value))}
                />
              </div>
            </div>

            {/* Min games */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mínimo de jogos por time
              </label>
              <div className="flex items-center gap-3">
                <input type="number" min={0} max={50}
                  className="w-24 border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={config.minGamesPerTeam}
                  onChange={e => cfg('minGamesPerTeam', Number(e.target.value))}
                />
                <p className="text-xs text-gray-400 leading-relaxed">
                  {config.minGamesPerTeam === 0
                    ? 'Padrão: gera um turno completo'
                    : `Cada time joga ao menos ${config.minGamesPerTeam} partidas no total, distribuídas nas ${config.dates.length} data${config.dates.length !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>

            {/* Regulation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Regulamento (opcional)</label>
              <textarea
                rows={4}
                className="w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                placeholder="Descreva as regras do torneio, pontuação, critérios de desempate..."
                value={config.regulation}
                onChange={e => cfg('regulation', e.target.value)}
              />
            </div>

            <button
              onClick={() => setStep('teams')}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
            >
              Próximo: Cadastrar Times →
            </button>
          </div>
        )}

        {/* ── STEP 2: Teams ──────────────────────────────────────────────────── */}
        {step === 'teams' && (
          <div className="bg-white rounded-2xl shadow p-6 space-y-4">
            <div>
              <h2 className="font-bold text-gray-900 text-lg">Times</h2>
              <p className="text-sm text-gray-400 mt-0.5">
                Times com mesma Categoria e Naipe jogam entre si. O sistema cria as chaves automaticamente.
                {user && (
                  <span className="ml-1 text-blue-400 text-xs">
                    · Autocomplete ativo —{' '}
                    <Link href="/times" className="underline hover:text-blue-600">gerenciar times</Link>
                  </span>
                )}
              </p>
            </div>

            <div className="overflow-x-auto -mx-2 px-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b">
                    <th className="pb-2 w-7 text-center">#</th>
                    <th className="pb-2 pr-2">Nome *</th>
                    <th className="pb-2 pr-2 w-24 text-center">Categoria</th>
                    <th className="pb-2 pr-2 w-20 text-center">Naipe</th>
                    <th className="pb-2 w-6"></th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((t, i) => (
                    <tr key={t.id} className="border-b border-gray-50">
                      <td className="py-1.5 text-center text-xs text-gray-300">{i + 1}</td>
                      <td className="pr-2 py-1.5 relative">
                        <input
                          className="w-full border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          placeholder={`Time ${i + 1}`}
                          value={t.name}
                          autoComplete="off"
                          onChange={e => {
                            updateTeam(t.id, 'name', e.target.value)
                            fetchSuggestions(t.id, e.target.value)
                          }}
                          onBlur={() => setTimeout(() => { setSuggestions([]); setActiveTeamId(null) }, 200)}
                        />
                        {/* Autocomplete dropdown */}
                        {activeTeamId === t.id && suggestions.length > 0 && (
                          <div className="absolute left-0 right-2 top-full mt-0.5 z-50 bg-white border rounded-xl shadow-lg overflow-hidden">
                            {suggestions.map(s => (
                              <button
                                key={s.id}
                                onMouseDown={() => applySuggestion(t.id, s)}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center gap-2 border-b border-gray-50 last:border-0"
                              >
                                <span className="flex-1 font-medium">{s.name}</span>
                                {s.category && <span className="text-xs text-gray-400 bg-gray-100 rounded px-1">{s.category}</span>}
                                {s.gender && <span className="text-xs text-gray-400 bg-gray-100 rounded px-1">{s.gender}</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="pr-2 py-1.5">
                        <input
                          className="w-24 text-center border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                        <button onClick={() => removeTeam(t.id)} className="text-gray-200 hover:text-red-400 text-xl leading-none pl-1">×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button onClick={addTeam} className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
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

        {/* ── STEP 3: Table ──────────────────────────────────────────────────── */}
        {step === 'table' && (
          <div className="space-y-4">
            <div className="no-print flex items-center justify-between">
              <button onClick={() => setStep('teams')} className="text-sm text-gray-500 hover:text-gray-700">
                ← Editar times
              </button>
              <div className="flex items-center gap-3">
                {saved && <span className="text-xs text-green-600 font-medium">✓ Times salvos</span>}
                <button
                  onClick={() => window.print()}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  🖨️ Imprimir / PDF
                </button>
              </div>
            </div>

            <div className="print-card bg-white rounded-2xl shadow p-6">
              {/* Tournament header */}
              <div className="text-center border-b pb-4 mb-6">
                <h1 className="text-2xl font-black text-blue-800 tracking-wide uppercase">
                  {config.name || 'TORNEIO'}
                </h1>
                {config.venue && (
                  <p className="text-sm text-gray-500 mt-0.5 uppercase">LOCAL: {config.venue}</p>
                )}
              </div>

              {/* One table per rodada */}
              {schedules.map((s, di) => (
                s.matches.length > 0 && (
                  <div key={s.date.id} className={di > 0 ? 'page-break pt-6 mt-6 border-t' : ''}>
                    <div className="text-center mb-3">
                      <p className="text-xl font-bold text-gray-800">
                        RODADA {s.roundIndex} — {fmtDate(s.date.date)}
                      </p>
                    </div>

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
                          {s.matches.map((m, j) => (
                            <tr key={j} className={rowColor(m)}>
                              <td className="border border-gray-200 px-3 py-2 text-center font-bold">{m.court}</td>
                              <td className="border border-gray-200 px-3 py-2 text-center font-bold">{toTime(m.startMin)}</td>
                              <td className="border border-gray-200 px-3 py-2 font-bold">{m.home.name}</td>
                              <td className="border border-gray-200 px-2 py-2 text-center text-gray-400 font-bold">×</td>
                              <td className="border border-gray-200 px-3 py-2 font-bold">{m.away.name}</td>
                              {showGroup && <td className="border border-gray-200 px-3 py-2 text-center font-semibold">{m.home.group || '—'}</td>}
                              {showCategory && <td className="border border-gray-200 px-3 py-2 text-center">{m.home.category || '—'}</td>}
                              {showGender && <td className="border border-gray-200 px-3 py-2 text-center">{m.home.gender || '—'}</td>}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {s.matches.some(m => m.startMin >= 22 * 60) && (
                      <div className="mt-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-700">
                        ⚠️ Jogos passando das 22h — adicione mais datas ou quadras para distribuir melhor.
                      </div>
                    )}
                    <p className="text-xs text-gray-300 text-center mt-1.5">
                      {s.matches.length} jogo{s.matches.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                )
              ))}

              {/* Regulation */}
              {config.regulation && (
                <div className="border-t mt-6 pt-4">
                  <h3 className="font-bold text-gray-800 text-sm mb-2 uppercase tracking-wide">Regulamento</h3>
                  <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">{config.regulation}</p>
                </div>
              )}

              <p className="text-xs text-gray-300 text-center border-t mt-4 pt-4">
                {allMatches.length} jogo{allMatches.length !== 1 ? 's' : ''} no total •{' '}
                {config.courts} quadra{config.courts !== 1 ? 's' : ''} •{' '}
                {config.duration}min por jogo • TabelaPro
              </p>
            </div>

            <div className="no-print text-center">
              <button onClick={() => { setStep('config'); setSchedules([]) }} className="text-sm text-gray-400 hover:text-gray-600 underline">
                Criar nova tabela
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
