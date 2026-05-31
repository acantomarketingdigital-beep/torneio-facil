export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { calculateStandings } from '@/lib/algorithms/standings'
import { formatDate, formatTime, PHASE_LABELS, MATCH_STATUS_LABELS, FORMAT_LABELS } from '@/lib/utils'
import type { Match, Team, Venue } from '@/types'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: c } = await supabase.from('championships').select('name, description').eq('slug', slug).single()
  return {
    title: c ? `${c.name} – TorneioFácil` : 'Campeonato – TorneioFácil',
    description: c?.description ?? 'Acompanhe jogos e classificação em tempo real.',
  }
}

export default async function PublicChampionshipPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: c } = await supabase
    .from('championships')
    .select('*')
    .eq('slug', slug)
    .eq('is_public', true)
    .single()

  if (!c) notFound()

  const [{ data: teams }, { data: matches }, { data: groups }] = await Promise.all([
    supabase.from('teams').select('*').eq('championship_id', c.id).order('name'),
    supabase.from('matches')
      .select('*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*), venue:venues(*)')
      .eq('championship_id', c.id)
      .order('scheduled_date', { ascending: true, nullsFirst: false })
      .order('scheduled_time', { ascending: true, nullsFirst: false })
      .order('match_order'),
    supabase.from('groups')
      .select('*, group_teams(team_id)')
      .eq('championship_id', c.id)
      .order('order'),
  ])

  const finishedMatches = (matches ?? []).filter(m => m.status === 'finished')
  const upcomingMatches = (matches ?? []).filter(m => m.status === 'scheduled').slice(0, 10)

  const hasGroups = c.format === 'group_knockout' && groups && groups.length > 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Link href="/" className="mb-4 inline-flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src="/images/logoapp.png" alt="TabelaPro" className="h-8 w-8 rounded-lg object-contain" />
            <span className="text-white font-bold text-sm">TabelaPro</span>
          </Link>
          <h1 className="text-3xl font-bold mb-1">{c.name}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-blue-100 mt-2">
            <span>{c.sport}</span>
            <span>·</span>
            <span>{FORMAT_LABELS[c.format]}</span>
            {c.start_date && (
              <>
                <span>·</span>
                <span>{formatDate(c.start_date)} – {formatDate(c.end_date)}</span>
              </>
            )}
            {c.location && (
              <>
                <span>·</span>
                <span>📍 {c.location}</span>
              </>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            {[
              { label: 'Times', value: teams?.length ?? 0 },
              { label: 'Jogos', value: matches?.length ?? 0 },
              { label: 'Realizados', value: finishedMatches.length },
            ].map(s => (
              <div key={s.label} className="text-center bg-white/10 rounded-xl py-3">
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs text-blue-200">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Tabs navigation (using anchor links) */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {[
            { href: '#jogos', label: 'Jogos' },
            { href: '#classificacao', label: 'Classificação' },
            { href: '#times', label: 'Times' },
            ...(c.regulation ? [{ href: '#regulamento', label: 'Regulamento' }] : []),
          ].map(tab => (
            <a key={tab.href} href={tab.href}
              className="px-4 py-3 text-sm font-medium text-gray-600 hover:text-blue-600 border-b-2 border-transparent hover:border-blue-600 transition-colors whitespace-nowrap">
              {tab.label}
            </a>
          ))}
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-10">
        {/* Próximos jogos */}
        {upcomingMatches.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">Próximos jogos</h2>
            <div className="space-y-2">
              {upcomingMatches.map(match => (
                <PublicMatchCard key={match.id} match={match as Match} />
              ))}
            </div>
          </section>
        )}

        {/* Todos os jogos */}
        <section id="jogos">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Todos os Jogos</h2>
          {(matches ?? []).length === 0 ? (
            <div className="text-center py-10 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
              <p className="text-sm">Nenhum jogo gerado ainda.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(matches ?? []).map(match => (
                <PublicMatchCard key={match.id} match={match as Match} />
              ))}
            </div>
          )}
        </section>

        {/* Classificação */}
        <section id="classificacao">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Classificação</h2>
          {hasGroups ? (
            <div className="space-y-6">
              {groups!.map((group: { id: string; name: string; teams_advance: number; group_teams: { team_id: string }[] }) => {
                const groupTeams = (teams ?? []).filter(t =>
                  group.group_teams.some((gt: { team_id: string }) => gt.team_id === t.id)
                )
                const standings = calculateStandings(groupTeams, (matches ?? []) as Match[], c, group.id)
                return (
                  <div key={group.id}>
                    <h3 className="font-semibold text-gray-700 mb-2 text-sm">{group.name}</h3>
                    <PublicStandingsTable standings={standings} advanceCount={group.teams_advance} />
                  </div>
                )
              })}
            </div>
          ) : (
            <PublicStandingsTable
              standings={calculateStandings(teams ?? [], (matches ?? []) as Match[], c)}
              advanceCount={0}
            />
          )}
        </section>

        {/* Times */}
        <section id="times">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Times Participantes</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {(teams ?? []).map(team => (
              <div key={team.id} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: team.color ?? '#3B82F6' }}>
                  {team.short_name ?? team.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-gray-900 truncate">{team.name}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Regulamento */}
        {c.regulation && (
          <section id="regulamento">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Regulamento</h2>
            <div className="bg-white rounded-2xl border border-gray-200 p-6 prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 leading-relaxed">{c.regulation}</pre>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-gray-200 py-8 text-center text-sm text-gray-400 mt-8">
        <p>Powered by <Link href="/" className="text-blue-600 font-medium">TorneioFácil</Link></p>
      </footer>
    </div>
  )
}

function PublicMatchCard({ match }: { match: Match }) {
  const isBye = !!match.bye_team_id
  const isFinished = match.status === 'finished'

  if (isBye) return null

  const homeTeam = match.home_team as Team
  const awayTeam = match.away_team as Team
  const venue = match.venue as Venue

  return (
    <div className={`bg-white rounded-xl border px-4 py-3 ${isFinished ? 'border-gray-200' : 'border-gray-100'}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {match.scheduled_date && <span>{formatDate(match.scheduled_date)}</span>}
          {match.scheduled_time && <span>{formatTime(match.scheduled_time)}</span>}
          {venue && <span className="bg-gray-100 px-2 py-0.5 rounded-full">{venue.name}</span>}
          <span className="text-gray-300">{PHASE_LABELS[match.phase] ?? match.round_name}</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          isFinished ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-500'
        }`}>
          {MATCH_STATUS_LABELS[match.status]}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 text-right">
          <div className="flex items-center justify-end gap-2">
            {homeTeam && (
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: homeTeam.color ?? '#3B82F6' }} />
            )}
            <span className={`text-sm font-semibold ${match.winner_id === match.home_team_id ? 'text-green-600' : 'text-gray-900'}`}>
              {homeTeam?.name ?? 'A definir'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 text-center">
          {isFinished ? (
            <span className="text-base font-bold bg-gray-100 px-3 py-1 rounded-lg">
              {match.home_score} × {match.away_score}
            </span>
          ) : (
            <span className="text-xs text-gray-300 font-medium px-2">vs</span>
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold ${match.winner_id === match.away_team_id ? 'text-green-600' : 'text-gray-900'}`}>
              {awayTeam?.name ?? 'A definir'}
            </span>
            {awayTeam && (
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: awayTeam.color ?? '#3B82F6' }} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function PublicStandingsTable({ standings, advanceCount }: {
  standings: ReturnType<typeof calculateStandings>
  advanceCount: number
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
              <th className="text-left px-4 py-3">#</th>
              <th className="text-left px-4 py-3">Time</th>
              <th className="text-center px-2 py-3">J</th>
              <th className="text-center px-2 py-3">V</th>
              <th className="text-center px-2 py-3">E</th>
              <th className="text-center px-2 py-3">D</th>
              <th className="text-center px-2 py-3 hidden sm:table-cell">SG</th>
              <th className="text-center px-3 py-3 font-bold">Pts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {standings.map((row, i) => (
              <tr key={row.team.id} className={advanceCount > 0 && i < advanceCount ? 'bg-green-50/40' : ''}>
                <td className="px-4 py-3 text-gray-500 font-medium text-xs">
                  {advanceCount > 0 && i < advanceCount ? (
                    <span className="inline-flex items-center justify-center w-5 h-5 bg-green-100 text-green-700 rounded-full text-xs font-bold">{i + 1}</span>
                  ) : i + 1}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: row.team.color ?? '#3B82F6' }} />
                    <span className="font-medium text-gray-900 text-sm">{row.team.name}</span>
                  </div>
                </td>
                <td className="text-center px-2 py-3 text-gray-600 text-sm">{row.played}</td>
                <td className="text-center px-2 py-3 text-green-600 font-medium text-sm">{row.wins}</td>
                <td className="text-center px-2 py-3 text-gray-500 text-sm">{row.draws}</td>
                <td className="text-center px-2 py-3 text-red-500 text-sm">{row.losses}</td>
                <td className={`text-center px-2 py-3 text-sm hidden sm:table-cell font-medium ${row.goalDifference > 0 ? 'text-green-600' : row.goalDifference < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                  {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                </td>
                <td className="text-center px-3 py-3 font-bold text-gray-900">{row.points}</td>
              </tr>
            ))}
            {standings.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-8 text-gray-400 text-sm">Aguardando resultados...</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
