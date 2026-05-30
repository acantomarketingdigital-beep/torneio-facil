export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { calculateStandings } from '@/lib/algorithms/standings'
import type { Match, Team, Group } from '@/types'

export default async function StandingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: c }, { data: teams }, { data: matches }, { data: groups }] = await Promise.all([
    supabase.from('championships').select('*').eq('id', id).eq('owner_id', user.id).single(),
    supabase.from('teams').select('*').eq('championship_id', id).order('name'),
    supabase.from('matches').select('*').eq('championship_id', id),
    supabase.from('groups').select('*, group_teams(team_id)').eq('championship_id', id).order('order'),
  ])

  if (!c) redirect('/dashboard')

  const hasGroups = c.format === 'group_knockout' && groups && groups.length > 0

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/championships/${id}`} className="text-gray-400 hover:text-gray-600 text-sm">← {c.name}</Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-medium">Classificação</span>
          </div>
          <Link href={`/api/championships/${id}/export?type=standings`} target="_blank"
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-xl hover:bg-gray-50 flex items-center gap-1">
            📄 PDF
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-gray-900 mb-5">Classificação</h1>

        {hasGroups ? (
          <div className="space-y-6">
            {groups!.map((group: Group & { group_teams: { team_id: string }[] }) => {
              const groupTeams = (teams ?? []).filter(t =>
                group.group_teams.some((gt: { team_id: string }) => gt.team_id === t.id)
              )
              const standings = calculateStandings(
                groupTeams,
                (matches ?? []) as Match[],
                c,
                group.id
              )
              return (
                <div key={group.id}>
                  <h2 className="font-semibold text-gray-700 mb-2 text-sm uppercase tracking-wide">{group.name}</h2>
                  <StandingsTable standings={standings} advanceCount={group.teams_advance} />
                </div>
              )
            })}
          </div>
        ) : (
          <StandingsTable
            standings={calculateStandings(teams ?? [], (matches ?? []) as Match[], c)}
            advanceCount={0}
          />
        )}

        <div className="mt-6 text-xs text-gray-400 space-y-1">
          <p><strong>Critérios de desempate:</strong></p>
          <p>{c.tiebreaker_order.map((t: string) => ({
            points: 'Pontos',
            wins: 'Vitórias',
            goal_difference: 'Saldo de gols',
            goals_for: 'Gols marcados',
            goals_against: 'Gols sofridos',
            head_to_head: 'Confronto direto',
          }[t] ?? t)).join(' → ')}</p>
        </div>
      </main>
    </div>
  )
}

function StandingsTable({ standings, advanceCount }: {
  standings: ReturnType<typeof calculateStandings>
  advanceCount: number
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <th className="text-left px-4 py-3 w-8">#</th>
              <th className="text-left px-4 py-3">Time</th>
              <th className="text-center px-2 py-3 w-10" title="Jogos">J</th>
              <th className="text-center px-2 py-3 w-10" title="Vitórias">V</th>
              <th className="text-center px-2 py-3 w-10" title="Empates">E</th>
              <th className="text-center px-2 py-3 w-10" title="Derrotas">D</th>
              <th className="text-center px-2 py-3 w-12" title="Gols marcados">GM</th>
              <th className="text-center px-2 py-3 w-12" title="Gols sofridos">GS</th>
              <th className="text-center px-2 py-3 w-12" title="Saldo">SG</th>
              <th className="text-center px-3 py-3 w-12" title="Pontos"><strong>Pts</strong></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {standings.map((row, i) => (
              <tr key={row.team.id} className={`${advanceCount > 0 && i < advanceCount ? 'bg-green-50/40' : ''} hover:bg-gray-50 transition-colors`}>
                <td className="px-4 py-3 text-gray-500 font-medium text-xs">
                  {advanceCount > 0 && i < advanceCount ? (
                    <span className="inline-flex items-center justify-center w-5 h-5 bg-green-100 text-green-700 rounded-full text-xs font-bold">{i + 1}</span>
                  ) : i + 1}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: row.team.color ?? '#3B82F6' }} />
                    <span className="font-medium text-gray-900">{row.team.name}</span>
                  </div>
                </td>
                <td className="text-center px-2 py-3 text-gray-600">{row.played}</td>
                <td className="text-center px-2 py-3 text-green-600 font-medium">{row.wins}</td>
                <td className="text-center px-2 py-3 text-gray-500">{row.draws}</td>
                <td className="text-center px-2 py-3 text-red-500">{row.losses}</td>
                <td className="text-center px-2 py-3 text-gray-600">{row.goalsFor}</td>
                <td className="text-center px-2 py-3 text-gray-600">{row.goalsAgainst}</td>
                <td className={`text-center px-2 py-3 font-medium ${row.goalDifference > 0 ? 'text-green-600' : row.goalDifference < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                  {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                </td>
                <td className="text-center px-3 py-3 font-bold text-gray-900 text-base">{row.points}</td>
              </tr>
            ))}
            {standings.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center py-10 text-gray-400 text-sm">
                  Lance os resultados dos jogos para ver a classificação.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {advanceCount > 0 && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
          🟢 Times classificados para a próxima fase
        </div>
      )}
    </div>
  )
}
