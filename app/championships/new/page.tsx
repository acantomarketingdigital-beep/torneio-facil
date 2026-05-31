'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function NewChampionshipPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '',
    location: '',
    start_date: '',
    end_date: '',
    default_start_time: '08:00',
    default_end_time: '22:00',
    courts_count: 2,
    game_duration: 70,
    interval_between_games: 10,
    min_rest_minutes: 80,
    min_games_per_team: 0,
    regulation: '',
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

    const { data, error: insertErr } = await supabase.from('championships').insert({
      owner_id: user.id,
      name: form.name,
      sport: 'Vôlei',
      format: 'auto',
      description: null,
      location: form.location || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      game_duration: form.game_duration,
      interval_between_games: form.interval_between_games,
      min_rest_minutes: form.min_rest_minutes,
      max_games_per_day_per_team: 99,
      custom_games_per_team: form.min_games_per_team,
      groups_count: 4,
      teams_advance_per_group: 2,
      points_win: 3,
      points_draw: 1,
      points_loss: 0,
      allow_draws: false,
      is_public: form.is_public,
      regulation: form.regulation || null,
      courts_count: form.courts_count,
      default_start_time: form.default_start_time,
      default_end_time: form.default_end_time,
      slug,
    }).select('id').single()

    if (insertErr) { setError(insertErr.message); setLoading(false); return }

    // Auto-create venues (Quadra 1, Quadra 2, ...)
    if (form.courts_count > 0) {
      const venues = Array.from({ length: form.courts_count }, (_, i) => ({
        championship_id: data.id,
        name: `Quadra ${i + 1}`,
        is_active: true,
      }))
      await supabase.from('venues').insert(venues)
    }

    // Auto-create slot for start_date if provided
    if (form.start_date) {
      await supabase.from('available_slots').insert({
        championship_id: data.id,
        slot_date: form.start_date,
        start_time: form.default_start_time,
        end_time: form.default_end_time,
        venue_id: null,
      })
    }

    router.push(`/championships/${data.id}/teams`)
  }

  const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5'
  const inputClass = 'w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-medium">Novo Torneio</span>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Novo Torneio</h1>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Identificação */}
          <section className="bg-white rounded-2xl p-6 border border-gray-200 space-y-4">
            <h2 className="font-semibold text-gray-900">Identificação</h2>
            <div>
              <label className={labelClass}>Nome do torneio *</label>
              <input required value={form.name} onChange={e => update('name', e.target.value)}
                placeholder="Ex: Copa Cruzeta de Vôlei 2026" className={inputClass} autoFocus />
            </div>
            <div>
              <label className={labelClass}>Local</label>
              <input value={form.location} onChange={e => update('location', e.target.value)}
                placeholder="Ex: Ginásio Municipal" className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Data de início *</label>
                <input required type="date" value={form.start_date} onChange={e => update('start_date', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Data de fim</label>
                <input type="date" value={form.end_date} onChange={e => update('end_date', e.target.value)} className={inputClass} />
              </div>
            </div>
          </section>

          {/* Agenda da rodada */}
          <section className="bg-white rounded-2xl p-6 border border-gray-200 space-y-4">
            <h2 className="font-semibold text-gray-900">Agenda da rodada</h2>
            <p className="text-xs text-gray-400">Esses valores são usados para gerar os horários automaticamente.</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Horário inicial *</label>
                <input required type="time" value={form.default_start_time} onChange={e => update('default_start_time', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Horário final *</label>
                <input required type="time" value={form.default_end_time} onChange={e => update('default_end_time', e.target.value)} className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Quantidade de quadras</label>
              <input type="number" min={1} max={20} value={form.courts_count}
                onChange={e => update('courts_count', Number(e.target.value))} className={inputClass} />
              <p className="text-xs text-gray-400 mt-1">As quadras serão criadas automaticamente (Quadra 1, Quadra 2…)</p>
            </div>
          </section>

          {/* Regras dos jogos */}
          <section className="bg-white rounded-2xl p-6 border border-gray-200 space-y-4">
            <h2 className="font-semibold text-gray-900">Regras dos jogos</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Duração do jogo (min)</label>
                <input type="number" min={10} value={form.game_duration}
                  onChange={e => update('game_duration', Number(e.target.value))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Intervalo entre jogos (min)</label>
                <input type="number" min={0} value={form.interval_between_games}
                  onChange={e => update('interval_between_games', Number(e.target.value))} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Descanso mínimo por time (min)</label>
                <input type="number" min={0} value={form.min_rest_minutes}
                  onChange={e => update('min_rest_minutes', Number(e.target.value))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Mínimo de jogos por time</label>
                <input type="number" min={0} max={20} value={form.min_games_per_team}
                  onChange={e => update('min_games_per_team', Number(e.target.value))} className={inputClass} />
                <p className="text-xs text-gray-400 mt-1">0 = todos contra todos na chave</p>
              </div>
            </div>
          </section>

          {/* Regulamento */}
          <section className="bg-white rounded-2xl p-6 border border-gray-200 space-y-3">
            <h2 className="font-semibold text-gray-900">Regulamento (opcional)</h2>
            <textarea value={form.regulation} onChange={e => update('regulation', e.target.value)}
              rows={4} placeholder="Descreva as regras e regulamento do torneio..."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none" />
            <div className="flex items-center gap-3">
              <input type="checkbox" id="public" checked={form.is_public} onChange={e => update('is_public', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded" />
              <label htmlFor="public" className="text-sm text-gray-700">Página pública do torneio (acessível sem login)</label>
            </div>
          </section>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
          )}

          <div className="flex gap-3 pb-8">
            <Link href="/dashboard" className="flex-1 py-3 text-center border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 text-sm">
              Cancelar
            </Link>
            <button type="submit" disabled={loading || !form.name || !form.start_date}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 text-sm">
              {loading ? 'Criando...' : 'Criar e adicionar times →'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
