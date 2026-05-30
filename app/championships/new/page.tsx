'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { ChampionshipFormat } from '@/types'

const SPORTS = ['Futebol', 'Futsal', 'Basquete', 'Vôlei', 'Handebol', 'Tênis', 'Beach Tennis', 'Outro']

const FORMATS: { value: ChampionshipFormat; label: string; desc: string }[] = [
  { value: 'round_robin', label: 'Todos contra Todos', desc: 'Cada time enfrenta todos os outros uma vez. Classificação por pontos.' },
  { value: 'knockout', label: 'Mata-Mata', desc: 'Eliminatórias diretas. O perdedor é eliminado.' },
  { value: 'group_knockout', label: 'Grupos + Mata-Mata', desc: 'Fase de grupos seguida de mata-mata com os melhores.' },
  { value: 'custom', label: 'Personalizado (X Jogos)', desc: 'Cada time joga uma quantidade definida de partidas.' },
]

export default function NewChampionshipPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '',
    sport: 'Futebol',
    format: 'round_robin' as ChampionshipFormat,
    description: '',
    location: '',
    start_date: '',
    end_date: '',
    game_duration: 60,
    interval_between_games: 15,
    min_rest_minutes: 120,
    max_games_per_day_per_team: 2,
    custom_games_per_team: 3,
    groups_count: 4,
    teams_advance_per_group: 2,
    points_win: 3,
    points_draw: 1,
    points_loss: 0,
    allow_draws: true,
    is_public: true,
  })

  function update(key: string, value: unknown) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const slug = form.name
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .trim()
      + '-' + Math.floor(Math.random() * 9000 + 1000)

    const { data, error } = await supabase.from('championships').insert({
      owner_id: user.id,
      name: form.name,
      sport: form.sport,
      format: form.format,
      description: form.description || null,
      location: form.location || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      game_duration: form.game_duration,
      interval_between_games: form.interval_between_games,
      min_rest_minutes: form.min_rest_minutes,
      max_games_per_day_per_team: form.max_games_per_day_per_team,
      custom_games_per_team: form.custom_games_per_team,
      groups_count: form.groups_count,
      teams_advance_per_group: form.teams_advance_per_group,
      points_win: form.points_win,
      points_draw: form.points_draw,
      points_loss: form.points_loss,
      allow_draws: form.allow_draws,
      is_public: form.is_public,
      slug,
    }).select('id').single()

    if (error) { setError(error.message); setLoading(false); return }

    router.push(`/championships/${data.id}/teams`)
  }

  const Input = ({ label, id, ...props }: { label: string; id: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <input id={id} {...props} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-medium">Novo Campeonato</span>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Novo Campeonato</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informações básicas */}
          <section className="bg-white rounded-2xl p-6 border border-gray-200 space-y-4">
            <h2 className="font-semibold text-gray-900">Informações básicas</h2>
            <Input label="Nome do campeonato *" id="name" required value={form.name} onChange={e => update('name', e.target.value)} placeholder="Ex: Copa Amigos 2025" />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Esporte</label>
              <select value={form.sport} onChange={e => update('sport', e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                {SPORTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Descrição</label>
              <textarea value={form.description} onChange={e => update('description', e.target.value)} rows={2} placeholder="Descrição opcional..." className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none" />
            </div>
            <Input label="Local" id="location" value={form.location} onChange={e => update('location', e.target.value)} placeholder="Ex: Ginásio Municipal" />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Data de início" id="start" type="date" value={form.start_date} onChange={e => update('start_date', e.target.value)} />
              <Input label="Data de fim" id="end" type="date" value={form.end_date} onChange={e => update('end_date', e.target.value)} />
            </div>
          </section>

          {/* Formato */}
          <section className="bg-white rounded-2xl p-6 border border-gray-200 space-y-3">
            <h2 className="font-semibold text-gray-900">Formato do campeonato</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {FORMATS.map(f => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => update('format', f.value)}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${form.format === f.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="font-medium text-sm text-gray-900">{f.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{f.desc}</div>
                </button>
              ))}
            </div>

            {form.format === 'group_knockout' && (
              <div className="grid grid-cols-2 gap-4 pt-2">
                <Input label="Nº de grupos" id="gc" type="number" min={2} max={16} value={form.groups_count} onChange={e => update('groups_count', Number(e.target.value))} />
                <Input label="Times que avançam por grupo" id="ta" type="number" min={1} max={8} value={form.teams_advance_per_group} onChange={e => update('teams_advance_per_group', Number(e.target.value))} />
              </div>
            )}
            {form.format === 'custom' && (
              <Input label="Jogos por time" id="cg" type="number" min={1} max={20} value={form.custom_games_per_team} onChange={e => update('custom_games_per_team', Number(e.target.value))} />
            )}
          </section>

          {/* Configurações de tempo */}
          <section className="bg-white rounded-2xl p-6 border border-gray-200 space-y-4">
            <h2 className="font-semibold text-gray-900">Configurações de tempo</h2>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Duração do jogo (min)" id="gd" type="number" min={10} value={form.game_duration} onChange={e => update('game_duration', Number(e.target.value))} />
              <Input label="Intervalo entre jogos (min)" id="ig" type="number" min={0} value={form.interval_between_games} onChange={e => update('interval_between_games', Number(e.target.value))} />
              <Input label="Descanso mínimo (min)" id="mr" type="number" min={0} value={form.min_rest_minutes} onChange={e => update('min_rest_minutes', Number(e.target.value))} />
              <Input label="Máx. jogos por dia por time" id="mg" type="number" min={1} max={10} value={form.max_games_per_day_per_team} onChange={e => update('max_games_per_day_per_team', Number(e.target.value))} />
            </div>
          </section>

          {/* Pontuação */}
          <section className="bg-white rounded-2xl p-6 border border-gray-200 space-y-4">
            <h2 className="font-semibold text-gray-900">Pontuação e regras</h2>
            <div className="grid grid-cols-3 gap-4">
              <Input label="Pontos por vitória" id="pw" type="number" min={0} value={form.points_win} onChange={e => update('points_win', Number(e.target.value))} />
              <Input label="Pontos por empate" id="pd" type="number" min={0} value={form.points_draw} onChange={e => update('points_draw', Number(e.target.value))} />
              <Input label="Pontos por derrota" id="pl" type="number" min={0} value={form.points_loss} onChange={e => update('points_loss', Number(e.target.value))} />
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="draws" checked={form.allow_draws} onChange={e => update('allow_draws', e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
              <label htmlFor="draws" className="text-sm text-gray-700">Permitir empates</label>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="public" checked={form.is_public} onChange={e => update('is_public', e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
              <label htmlFor="public" className="text-sm text-gray-700">Página pública do campeonato (acessível sem login)</label>
            </div>
          </section>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
          )}

          <div className="flex gap-3">
            <Link href="/dashboard" className="flex-1 py-3 text-center border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors text-sm">
              Cancelar
            </Link>
            <button type="submit" disabled={loading} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm">
              {loading ? 'Criando...' : 'Criar e adicionar times →'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
