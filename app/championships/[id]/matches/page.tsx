'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Match, Championship, Team, Venue } from '@/types'
import { formatDate, formatTime, PHASE_LABELS, MATCH_STATUS_LABELS } from '@/lib/utils'

export default function MatchesPage() {
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()

  const [matches, setMatches] = useState<Match[]>([])
  const [championship, setChampionship] = useState<Championship | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [venues, setVenues] = useState<Venue[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [editingMatch, setEditingMatch] = useState<Match | null>(null)
  const [scoreForm, setScoreForm] = useState({ home_score: '', away_score: '' })
  const [filter, setFilter] = useState<string>('all')

  const load = useCallback(async () => {
    const [{ data: c }, { data: t }, { data: v }, { data: m }] = await Promise.all([
      supabase.from('championships').select('*').eq('id', id).single(),
      supabase.from('teams').select('*').eq('championship_id', id).order('name'),
      supabase.from('venues').select('*').eq('championship_id', id).eq('is_active', true),
      supabase.from('matches')
        .select('*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*), venue:venues(*)')
        .eq('championship_id', id)
        .order('scheduled_date', { ascending: true, nullsFirst: false })
        .order('scheduled_time', { ascending: true, nullsFirst: false })
        .order('match_order'),
    ])
    setChampionship(c)
    setTeams(t ?? [])
    setVenues(v ?? [])
    setMatches(m ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function generateTable() {
    if (!confirm('Gerar a tabela irá remover todos os jogos existentes. Confirmar?')) return
    setGenerating(true)
    const res = await fetch(`/api/championships/${id}/generate`, { method: 'POST' })
    if (res.ok) await load()
    else alert('Erro ao gerar tabela.')
    setGenerating(false)
  }

  async function saveScore(match: Match) {
    const hs = parseInt(scoreForm.home_score)
    const as_ = parseInt(scoreForm.away_score)
    if (isNaN(hs) || isNaN(as_)) return

    let winnerId: string | null = null
    if (hs > as_) winnerId = match.home_team_id
    else if (as_ > hs) winnerId = match.away_team_id

    await supabase.from('matches').update({
      home_score: hs,
      away_score: as_,
      winner_id: winnerId,
      status: 'finished',
    }).eq('id', match.id)

    // Recalculate standings via API
    await fetch(`/api/championships/${id}/standings`, { method: 'POST' })
    setEditingMatch(null)
    await load()
  }

  // Group by phase then date
  const phases = [...new Set(matches.map(m => m.phase))]
  const activeMatches = filter === 'all' ? matches : matches.filter(m => m.phase === filter)

  const grouped = activeMatches.reduce<Record<string, Match[]>>((acc, m) => {
    const key = m.scheduled_date ?? 'Sem data'
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Carregando...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href={`/championships/${id}`} className="text-gray-400 hover:text-gray-600 text-sm">← {championship?.name}</Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-medium">Jogos</span>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Jogos</h1>
            <p className="text-sm text-gray-400">{matches.length} jogo(s) gerado(s)</p>
          </div>
          <div className="flex gap-2">
            {matches.length > 0 && (
              <Link href={`/api/championships/${id}/export?type=matches`} target="_blank"
                className="px-3 py-2 text-xs border border-gray-200 rounded-xl hover:bg-gray-50 flex items-center gap-1">
                📄 PDF
              </Link>
            )}
            <button
              onClick={generateTable}
              disabled={generating || teams.length < 2}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {generating ? (
                <><span className="animate-spin">⚙️</span> Gerando...</>
              ) : matches.length > 0 ? '🔄 Regenerar' : '⚡ Gerar tabela'}
            </button>
          </div>
        </div>

        {teams.length < 2 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4 text-sm text-yellow-700">
            ⚠️ Você precisa de pelo menos 2 times para gerar a tabela.{' '}
            <Link href={`/championships/${id}/teams`} className="font-medium underline">Adicionar times</Link>
          </div>
        )}

        {matches.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300">
            <div className="text-5xl mb-4">⚽</div>
            <h2 className="text-lg font-semibold text-gray-700 mb-2">Nenhum jogo gerado</h2>
            <p className="text-gray-400 text-sm mb-5">Cadastre os times, quadras e horários, depois clique em "Gerar tabela".</p>
            <button onClick={generateTable} disabled={generating || teams.length < 2} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50">
              ⚡ Gerar tabela agora
            </button>
          </div>
        ) : (
          <>
            {/* Phase filter */}
            {phases.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
                <button onClick={() => setFilter('all')} className={`px-3 py-1.5 text-xs rounded-full whitespace-nowrap font-medium transition-colors ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  Todos ({matches.length})
                </button>
                {phases.map(p => (
                  <button key={p} onClick={() => setFilter(p)} className={`px-3 py-1.5 text-xs rounded-full whitespace-nowrap font-medium transition-colors ${filter === p ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    {PHASE_LABELS[p] ?? p} ({matches.filter(m => m.phase === p).length})
                  </button>
                ))}
              </div>
            )}

            {/* Matches grouped by date */}
            <div className="space-y-4">
              {Object.entries(grouped).map(([date, dayMatches]) => (
                <div key={date}>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">
                    {date === 'Sem data' ? 'Sem data agendada' : formatDate(date, 'EEEE, dd/MM/yyyy')}
                  </div>
                  <div className="space-y-2">
                    {dayMatches.map(match => (
                      <MatchCard
                        key={match.id}
                        match={match}
                        isEditing={editingMatch?.id === match.id}
                        scoreForm={scoreForm}
                        onEdit={() => {
                          setEditingMatch(match)
                          setScoreForm({
                            home_score: match.home_score?.toString() ?? '',
                            away_score: match.away_score?.toString() ?? '',
                          })
                        }}
                        onSave={() => saveScore(match)}
                        onCancel={() => setEditingMatch(null)}
                        onScoreChange={setScoreForm}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="mt-6 flex gap-3">
          <Link href={`/championships/${id}`} className="flex-1 py-3 text-center text-sm border border-gray-300 rounded-xl hover:bg-gray-50">← Voltar</Link>
          <Link href={`/championships/${id}/standings`} className="flex-1 py-3 text-center text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium">Ver Classificação →</Link>
        </div>
      </main>
    </div>
  )
}

function MatchCard({
  match, isEditing, scoreForm, onEdit, onSave, onCancel, onScoreChange
}: {
  match: Match
  isEditing: boolean
  scoreForm: { home_score: string; away_score: string }
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  onScoreChange: (f: { home_score: string; away_score: string }) => void
}) {
  const isBye = !!match.bye_team_id
  const isFinished = match.status === 'finished'
  const noTeams = !match.home_team_id || !match.away_team_id

  if (isBye) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3 opacity-60">
        <span className="text-xs text-gray-400 font-medium w-8">{match.round_name}</span>
        <span className="flex-1 text-sm text-gray-500">{(match.home_team as Team)?.name ?? 'A definir'} — BYE (avança automaticamente)</span>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-xl border px-4 py-3 ${isFinished ? 'border-gray-200' : 'border-gray-200'}`}>
      {/* Match header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {match.scheduled_time && <span>{formatTime(match.scheduled_time)}</span>}
          {match.venue && <span className="bg-gray-100 px-2 py-0.5 rounded-full">{(match.venue as Venue).name}</span>}
          <span>{PHASE_LABELS[match.phase] ?? match.round_name}</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          isFinished ? 'bg-green-50 text-green-600' :
          match.status === 'in_progress' ? 'bg-yellow-50 text-yellow-600' :
          'bg-gray-50 text-gray-500'
        }`}>
          {MATCH_STATUS_LABELS[match.status]}
        </span>
      </div>

      {/* Teams and score */}
      <div className="flex items-center gap-3">
        <div className="flex-1 text-right">
          <span className={`text-sm font-semibold ${match.winner_id === match.home_team_id ? 'text-green-600' : 'text-gray-900'}`}>
            {noTeams ? 'A definir' : (match.home_team as Team)?.name ?? 'Time'}
          </span>
        </div>

        {isEditing ? (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <input
              type="number" min={0} max={99} value={scoreForm.home_score}
              onChange={e => onScoreChange({ ...scoreForm, home_score: e.target.value })}
              className="w-12 text-center border border-gray-300 rounded-lg py-1 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-400 text-sm">×</span>
            <input
              type="number" min={0} max={99} value={scoreForm.away_score}
              onChange={e => onScoreChange({ ...scoreForm, away_score: e.target.value })}
              className="w-12 text-center border border-gray-300 rounded-lg py-1 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ) : (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className={`text-base font-bold px-2.5 py-1 rounded-lg min-w-[2.5rem] text-center ${isFinished ? 'bg-gray-100' : 'bg-gray-50 text-gray-300'}`}>
              {isFinished ? match.home_score : '-'}
            </span>
            <span className="text-gray-300 text-xs">×</span>
            <span className={`text-base font-bold px-2.5 py-1 rounded-lg min-w-[2.5rem] text-center ${isFinished ? 'bg-gray-100' : 'bg-gray-50 text-gray-300'}`}>
              {isFinished ? match.away_score : '-'}
            </span>
          </div>
        )}

        <div className="flex-1">
          <span className={`text-sm font-semibold ${match.winner_id === match.away_team_id ? 'text-green-600' : 'text-gray-900'}`}>
            {noTeams ? 'A definir' : (match.away_team as Team)?.name ?? 'Time'}
          </span>
        </div>
      </div>

      {/* Actions */}
      {!noTeams && (
        <div className="flex justify-end gap-2 mt-2">
          {isEditing ? (
            <>
              <button onClick={onCancel} className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={onSave} className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700">Salvar resultado</button>
            </>
          ) : (
            <button onClick={onEdit} className="text-xs text-blue-600 hover:underline">
              {isFinished ? '✏️ Editar resultado' : '+ Lançar resultado'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
