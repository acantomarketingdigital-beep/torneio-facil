import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateStandings } from '@/lib/algorithms/standings'
import type { Match } from '@/types'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: c }, { data: teams }, { data: matches }] = await Promise.all([
    supabase.from('championships').select('*').eq('id', id).eq('owner_id', user.id).single(),
    supabase.from('teams').select('*').eq('championship_id', id),
    supabase.from('matches').select('*').eq('championship_id', id),
  ])

  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const standings = calculateStandings(teams ?? [], (matches ?? []) as Match[], c)

  // Upsert standings
  for (let i = 0; i < standings.length; i++) {
    const row = standings[i]
    await supabase.from('standings').upsert({
      championship_id: id,
      group_id: row.groupId,
      team_id: row.team.id,
      position: i + 1,
      played: row.played,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      goals_for: row.goalsFor,
      goals_against: row.goalsAgainst,
      points: row.points,
    }, { onConflict: 'championship_id,group_id,team_id' })
  }

  return NextResponse.json({ success: true })
}
