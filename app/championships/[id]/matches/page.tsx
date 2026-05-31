'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Match, Championship, Team, Venue } from '@/types'
import { formatDate, formatTime, MATCH_STATUS_LABELS } from '@/lib/utils'

interface ReviewData {
  keys: { name: string; teams: number; matches: number }[]
  totalMatches: number
  totalScheduled: number
  totalPending: number
}

export default function MatchesPage() {
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()

  const [matches, setMatches] = useState<Match[]>([])
  const [championship, setChampionship] = useState<Championship | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [review, setReview] = useState<ReviewData | null>(null)
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [sortMode, setSortMode] = useState<'venue' | 'time'>('venue')
  const [editingMatch, setEditingMatch] = useState<Match | null>(null)
  const [scoreForm, setScoreForm] = useState({ home_score: '', away_score: '' })

  const load = useCallback(async () => {
    const [{ data: c }, { data: t }, { data: m }] = await Promise.all([
      supabase.from('championships').select('*').eq('id', id).single(),
      supabase.from('teams').select('*').eq('championship_id', id).order('name'),
      supabase.from('matches')
        .select('*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*), venue:venues(*), group:groups(*)')
        .eq('championship_id', id)
        .order('match_order'),
    ])
    setChampionship(c)
    setTeams(t ?? [])
    setMatches(m ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function generateTable() {
    if (matches.length > 0 && !confirm('Regenerar irá remover todos os jogos existentes. Confirmar?')) return
    setGenerating(true)
    setReview(null)

    const res = await fetch(`/api/championships/${id}/generate`, { method: 'POST' })
    const json = await res.json()

    if (res.ok) {
      if (json.review) setReview(json.review)
      await load()
    } else {
      alert(json.error ?? 'Erro ao gerar tabela.')
    }
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
      home_score: hs, away_score: as_, winner_id: winnerId, status: 'finished',
    }).eq('id', match.id)
    await fetch(`/api/championships/${id}/standings`, { method: 'POST' })
    setEditingMatch(null)
    await load()
  }

  // ------- Sort logic -------
  const scheduledMatches = matches.filter(m => m.scheduled_date && m.scheduled_time && m.venue_id)
  const unscheduledMatches = matches.filter(m => !m.scheduled_date || !m.scheduled_time || !m.venue_id)

  function sortedMatches(list: Match[]) {
    return [...list].sort((a, b) => {
      const aVenue = (a.venue as Venue)?.name ?? ''
      const bVenue = (b.venue as Venue)?.name ?? ''
      const aDate = a.scheduled_date ?? ''
      const bDate = b.scheduled_date ?? ''
      const aTime = a.scheduled_time ?? ''
      const bTime = b.scheduled_time ?? ''

      if (sortMode === 'venue') {
        if (aVenue !== bVenue) return aVenue.localeCompare(bVenue)
        if (aDate !== bDate) return aDate.localeCompare(bDate)
        return aTime.localeCompare(bTime)
      } else {
        if (aDate !== bDate) return aDate.localeCompare(bDate)
        if (aTime !== bTime) return aTime.localeCompare(bTime)
        return aVenue.localeCompare(bVenue)
      }
    })
  }

  // Group scheduled matches by date
  const byDate = sortedMatches(scheduledMatches).reduce<Record<string, Match[]>>((acc, m) => {
    const key = m.scheduled_date!
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Carregando...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href={`/championships/${id}`} className="text-gray-400 hover:text-gray-600 text-sm">← {championship?.name}</Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-medium">Tabela de Jogos</span>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Tabela de Jogos</h1>
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
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {generating ? <><span className="animate-spin inline-block">⚙️</span> Gerando...</> : matches.length > 0 ? '🔄 Regenerar' : '⚡ Gerar tabela'}
            </button>
          </div>
        </div>

        {teams.length < 2 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4 text-sm text-yellow-700">
            ⚠️ Você precisa de pelo menos 2 times para gerar a tabela.{' '}
            <Link href={`/championships/${id}/teams`} className="font-medium underline">Adicionar times</Link>
          </div>
        )}

        {/* Review panel */}
        {review && (
          <div className="bg-white border border-green-200 rounded-2xl p-5 mb-5">
            <h2 className="font-semibold text-gray-900 mb-3">Resumo da geração</h2>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Stat label="Total de jogos" value={review.totalMatches} color="blue" />
              <Stat label="Agendados" value={review.totalScheduled} color="green" />
              <Stat label="Pendentes" value={review.totalPending} color={review.totalPending > 0 ? 'yellow' : 'gray'} />
            </div>
            {review.totalPending > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-3 text-sm text-yellow-700">
                ⚠️ {review.totalPending} jogo(s) não cabem nos horários cadastrados e ficaram pendentes.
                Adicione mais datas em <Link href={`/championships/${id}/schedule`} className="font-medium underline">Horários</Link> e regenere.
              </div>
            )}
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Chaves geradas</p>
              {review.keys.map(k => (
                <div key={k.name} className="flex items-center justify-between text-sm bg-gray-50 rounded-xl px-3 py-2">
                  <span className="font-medium text-gray-800">{k.name}</span>
                  <span className="text-gray-500">{k.teams} times · {k.matches} jogos</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {matches.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300">
            <div className="text-5xl mb-4">📋</div>
            <h2 className="text-lg font-semibold text-gray-700 mb-2">Nenhum jogo gerado</h2>
            <p className="text-gray-400 text-sm mb-5">Cadastre os times com Categoria e Naipe, configure os horários e clique em Gerar tabela.</p>
            <button onClick={generateTable} disabled={generating || teams.length < 2}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50">
              ⚡ Gerar tabela agora
            </button>
          </div>
        ) : (
          <>
            {/* View controls */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1">
                <button onClick={() => setViewMode('table')}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                  Tabela
                </button>
                <button onClick={() => setViewMode('cards')}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${viewMode === 'cards' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                  Cards
                </button>
              </div>
              {viewMode === 'table' && (
                <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1">
                  <button onClick={() => setSortMode('venue')}
                    className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${sortMode === 'venue' ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                    Por quadra
                  </button>
                  <button onClick={() => setSortMode('time')}
                    className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${sortMode === 'time' ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                    Por horário
                  </button>
                </div>
              )}
            </div>

            {/* Table view */}
            {viewMode === 'table' && (
              <div className="space-y-6">
                {Object.entries(byDate).map(([date, dayMatches]) => (
                  <div key={date} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 bg-gray-800 text-white">
                      <span className="font-semibold text-sm">RODADA — {formatDate(date, 'dd/MM/yyyy').toUpperCase()}</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Quadra</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Horário</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Equipe</th>
                            <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500">×</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Equipe</th>
                            <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Chave</th>
                            <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Categoria</th>
                            <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Naipe</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {dayMatches.map(match => {
                            const home = match.home_team as Team | undefined
                            const away = match.away_team as Team | undefined
                            const venue = match.venue as Venue | undefined
                            const group = match.group as { name?: string } | undefined
                            const isFinished = match.status === 'finished'
                            const cat = home?.category ?? away?.category ?? ''
                            const gen = home?.gender ?? away?.gender ?? ''

                            // Extract chave letter from group name (last part after "- Chave ")
                            const chaveMatch = group?.name?.match(/Chave ([A-Z]+)$/i)
                            const chaveLabel = chaveMatch ? chaveMatch[1] : (group?.name ? 'U' : '—')

                            return (
                              <tr key={match.id} className={`hover:bg-gray-50 ${isFinished ? 'bg-green-50/30' : ''}`}>
                                <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">{venue?.name ?? '—'}</td>
                                <td className="px-3 py-2.5 text-blue-600 font-semibold whitespace-nowrap">{formatTime(match.scheduled_time)}</td>
                                <td className="px-3 py-2.5 text-right font-semibold text-gray-900">
                                  {home?.name ?? 'A definir'}
                                  {isFinished && <span className="ml-1 text-green-600"> {match.home_score}</span>}
                                </td>
                                <td className="px-3 py-2.5 text-center text-gray-400 text-xs font-bold">×</td>
                                <td className="px-3 py-2.5 font-semibold text-gray-900">
                                  {isFinished && <span className="mr-1 text-green-600">{match.away_score} </span>}
                                  {away?.name ?? 'A definir'}
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">{chaveLabel}</span>
                                </td>
                                <td className="px-3 py-2.5 text-center text-xs text-gray-500 hidden sm:table-cell">{cat}</td>
                                <td className="px-3 py-2.5 text-center text-xs text-gray-500 hidden sm:table-cell">{gen}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}

                {/* Pending matches */}
                {unscheduledMatches.length > 0 && (
                  <div className="bg-white rounded-2xl border border-yellow-200 overflow-hidden">
                    <div className="px-4 py-3 bg-yellow-50 border-b border-yellow-200">
                      <span className="font-semibold text-sm text-yellow-800">⏳ JOGOS PENDENTES ({unscheduledMatches.length})</span>
                      <p className="text-xs text-yellow-600 mt-0.5">Estes jogos não couberam nos horários disponíveis. Adicione mais datas e regenere.</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-gray-100">
                          {unscheduledMatches.map(match => {
                            const home = match.home_team as Team | undefined
                            const away = match.away_team as Team | undefined
                            const group = match.group as { name?: string } | undefined
                            const chaveMatch = group?.name?.match(/Chave ([A-Z]+)$/i)
                            const chaveLabel = chaveMatch ? chaveMatch[1] : (group?.name ? 'U' : '—')
                            const cat = home?.category ?? away?.category ?? ''
                            const gen = home?.gender ?? away?.gender ?? ''
                            return (
                              <tr key={match.id} className="opacity-60">
                                <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">—</td>
                                <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">—</td>
                                <td className="px-3 py-2.5 text-right font-semibold text-gray-700">{home?.name ?? 'A definir'}</td>
                                <td className="px-3 py-2.5 text-center text-gray-400 text-xs">×</td>
                                <td className="px-3 py-2.5 font-semibold text-gray-700">{away?.name ?? 'A definir'}</td>
                                <td className="px-3 py-2.5 text-center">
                                  <span className="bg-gray-100 text-gray-500 text-xs font-bold px-2 py-0.5 rounded-full">{chaveLabel}</span>
                                </td>
                                <td className="px-3 py-2.5 text-center text-xs text-gray-400 hidden sm:table-cell">{cat}</td>
                                <td className="px-3 py-2.5 text-center text-xs text-gray-400 hidden sm:table-cell">{gen}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Cards view */}
            {viewMode === 'cards' && (
              <div className="space-y-4">
                {Object.entries(
                  matches.reduce<Record<string, Match[]>>((acc, m) => {
                    const key = m.scheduled_date ?? 'Sem data'
                    if (!acc[key]) acc[key] = []
                    acc[key].push(m)
                    return acc
                  }, {})
                ).map(([date, dayMatches]) => (
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
                            setScoreForm({ home_score: match.home_score?.toString() ?? '', away_score: match.away_score?.toString() ?? '' })
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
            )}
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

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  const bg: Record<string, string> = { blue: 'bg-blue-50 text-blue-700', green: 'bg-green-50 text-green-700', yellow: 'bg-yellow-50 text-yellow-700', gray: 'bg-gray-50 text-gray-500' }
  return (
    <div className={`rounded-xl p-3 text-center ${bg[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs mt-0.5">{label}</div>
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
  const group = match.group as { name?: string } | undefined

  if (isBye) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3 opacity-60">
        <span className="text-xs text-gray-400 font-medium">{match.round_name}</span>
        <span className="flex-1 text-sm text-gray-500">{(match.home_team as Team)?.name ?? 'A definir'} — BYE</span>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {match.scheduled_time && <span>{formatTime(match.scheduled_time)}</span>}
          {match.venue && <span className="bg-gray-100 px-2 py-0.5 rounded-full">{(match.venue as Venue).name}</span>}
          {group?.name && <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{group.name}</span>}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${isFinished ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-500'}`}>
          {MATCH_STATUS_LABELS[match.status]}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 text-right">
          <span className={`text-sm font-semibold ${match.winner_id === match.home_team_id ? 'text-green-600' : 'text-gray-900'}`}>
            {noTeams ? 'A definir' : (match.home_team as Team)?.name ?? 'Time'}
          </span>
        </div>

        {isEditing ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <input type="number" min={0} max={99} value={scoreForm.home_score}
              onChange={e => onScoreChange({ ...scoreForm, home_score: e.target.value })}
              className="w-12 text-center border border-gray-300 rounded-lg py-1 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <span className="text-gray-400 text-sm">×</span>
            <input type="number" min={0} max={99} value={scoreForm.away_score}
              onChange={e => onScoreChange({ ...scoreForm, away_score: e.target.value })}
              className="w-12 text-center border border-gray-300 rounded-lg py-1 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        ) : (
          <div className="flex items-center gap-1.5 shrink-0">
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
