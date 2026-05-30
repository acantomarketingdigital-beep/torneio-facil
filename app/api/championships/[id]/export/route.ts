import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateStandings } from '@/lib/algorithms/standings'
import { formatDate, formatTime, PHASE_LABELS } from '@/lib/utils'
import type { Match, Team, Venue } from '@/types'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const type = req.nextUrl.searchParams.get('type') ?? 'matches'

  const supabase = await createClient()

  const [{ data: c }, { data: teams }, { data: matches }] = await Promise.all([
    supabase.from('championships').select('*').eq('id', id).single(),
    supabase.from('teams').select('*').eq('championship_id', id).order('name'),
    supabase.from('matches')
      .select('*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*), venue:venues(*)')
      .eq('championship_id', id)
      .order('scheduled_date', { ascending: true, nullsFirst: false })
      .order('scheduled_time', { ascending: true, nullsFirst: false })
      .order('match_order'),
  ])

  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Generate HTML for PDF
  let content = ''

  if (type === 'standings') {
    const standings = calculateStandings(teams ?? [], (matches ?? []) as Match[], c)
    content = generateStandingsHTML(c.name, standings)
  } else {
    content = generateMatchesHTML(c.name, matches ?? [])
  }

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${c.name} – ${type === 'standings' ? 'Classificação' : 'Tabela de Jogos'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; padding: 20px; }
    h1 { font-size: 20px; font-weight: bold; margin-bottom: 4px; }
    h2 { font-size: 14px; font-weight: bold; margin: 16px 0 8px; color: #2563EB; }
    .subtitle { font-size: 12px; color: #666; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #2563EB; color: white; padding: 8px 10px; text-align: left; font-size: 11px; }
    th.center, td.center { text-align: center; }
    td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
    tr:nth-child(even) { background: #f9fafb; }
    .footer { margin-top: 24px; font-size: 10px; color: #9ca3af; text-align: center; }
    @media print { body { padding: 10px; } }
  </style>
</head>
<body>
  <h1>${c.name}</h1>
  <p class="subtitle">${c.sport} · ${type === 'standings' ? 'Classificação' : 'Tabela de Jogos'} · Gerado em ${new Date().toLocaleDateString('pt-BR')}</p>
  ${content}
  <p class="footer">Gerado por TorneioFácil</p>
  <script>window.onload = () => window.print()</script>
</body>
</html>`

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

function generateMatchesHTML(champName: string, matches: Match[]): string {
  if (matches.length === 0) return '<p>Nenhum jogo gerado.</p>'

  const rows = matches.map(m => `
    <tr>
      <td>${m.round ?? '-'}</td>
      <td>${PHASE_LABELS[m.phase] ?? m.phase}</td>
      <td>${m.scheduled_date ? formatDate(m.scheduled_date) : '-'}</td>
      <td>${m.scheduled_time ? formatTime(m.scheduled_time) : '-'}</td>
      <td>${(m.venue as Venue)?.name ?? '-'}</td>
      <td style="text-align:right;font-weight:600">${(m.home_team as Team)?.name ?? 'A definir'}</td>
      <td class="center" style="font-weight:bold">${m.status === 'finished' ? `${m.home_score} × ${m.away_score}` : 'vs'}</td>
      <td style="font-weight:600">${(m.away_team as Team)?.name ?? 'A definir'}</td>
    </tr>
  `).join('')

  return `
    <table>
      <thead>
        <tr>
          <th>Rodada</th>
          <th>Fase</th>
          <th>Data</th>
          <th>Horário</th>
          <th>Local</th>
          <th class="center">Mandante</th>
          <th class="center">Placar</th>
          <th>Visitante</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `
}

function generateStandingsHTML(champName: string, standings: ReturnType<typeof calculateStandings>): string {
  if (standings.length === 0) return '<p>Nenhum dado de classificação disponível.</p>'

  const rows = standings.map((row, i) => `
    <tr>
      <td class="center">${i + 1}</td>
      <td style="font-weight:600">${row.team.name}</td>
      <td class="center">${row.played}</td>
      <td class="center">${row.wins}</td>
      <td class="center">${row.draws}</td>
      <td class="center">${row.losses}</td>
      <td class="center">${row.goalsFor}</td>
      <td class="center">${row.goalsAgainst}</td>
      <td class="center">${row.goalDifference > 0 ? '+' : ''}${row.goalDifference}</td>
      <td class="center" style="font-weight:bold;font-size:13px">${row.points}</td>
    </tr>
  `).join('')

  return `
    <table>
      <thead>
        <tr>
          <th class="center">#</th>
          <th>Time</th>
          <th class="center">J</th>
          <th class="center">V</th>
          <th class="center">E</th>
          <th class="center">D</th>
          <th class="center">GM</th>
          <th class="center">GS</th>
          <th class="center">SG</th>
          <th class="center">Pts</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `
}
