import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateMatches } from '@/lib/algorithms'
import type { ScheduleConstraints } from '@/types'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: c } = await supabase.from('championships').select('*').eq('id', id).eq('owner_id', user.id).single()
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [{ data: teams }, { data: venues }, { data: slots }, { data: groups }] = await Promise.all([
    supabase.from('teams').select('*').eq('championship_id', id).order('seed', { nullsFirst: false }).order('name'),
    supabase.from('venues').select('*').eq('championship_id', id).eq('is_active', true),
    supabase.from('available_slots').select('*').eq('championship_id', id).order('slot_date').order('start_time'),
    supabase.from('groups').select('*, group_teams(team_id)').eq('championship_id', id).order('order'),
  ])

  if (!teams || teams.length < 2) {
    return NextResponse.json({ error: 'Need at least 2 teams' }, { status: 400 })
  }

  const constraints: ScheduleConstraints = {
    gameDuration: c.game_duration,
    intervalBetweenGames: c.interval_between_games,
    minRestMinutes: c.min_rest_minutes,
    maxGamesPerDayPerTeam: c.max_games_per_day_per_team,
  }

  // Delete existing matches (cascade will clean up)
  await supabase.from('matches').delete().eq('championship_id', id)
  await supabase.from('groups').delete().eq('championship_id', id)

  // For group_knockout, create groups first
  let groupIdMap: Record<string, string> = {}

  if (c.format === 'group_knockout') {
    const { distributeTeamsIntoGroups } = await import('@/lib/algorithms/group-knockout')
    const generatedGroups = distributeTeamsIntoGroups(teams, c.groups_count ?? 4)

    for (const group of generatedGroups) {
      const { data: dbGroup } = await supabase.from('groups').insert({
        championship_id: id,
        name: group.name,
        order: group.order,
        teams_advance: c.teams_advance_per_group ?? 2,
      }).select('id').single()

      if (dbGroup) {
        groupIdMap[group.id] = dbGroup.id
        await supabase.from('group_teams').insert(
          group.teams.map((t) => ({ group_id: dbGroup.id, team_id: t.id }))
        )
      }
    }
  }

  const generatedMatches = generateMatches({
    format: c.format,
    teams,
    venues: venues ?? [],
    slots: slots ?? [],
    constraints,
    customGamesPerTeam: c.custom_games_per_team ?? 3,
    groupsCount: c.groups_count ?? 4,
    teamsAdvancePerGroup: c.teams_advance_per_group ?? 2,
    allowDraws: c.allow_draws,
  })

  if (generatedMatches.length === 0) {
    return NextResponse.json({ error: 'No matches could be generated' }, { status: 400 })
  }

  // Map temporary group IDs to real IDs
  const matchesToInsert = generatedMatches.map((m, index) => ({
    championship_id: id,
    group_id: m.group_id ? (groupIdMap[m.group_id] ?? m.group_id) : null,
    round: m.round,
    round_name: m.round_name,
    phase: m.phase,
    home_team_id: m.home_team_id,
    away_team_id: m.away_team_id,
    venue_id: m.venue_id ?? null,
    scheduled_date: m.scheduled_date ?? null,
    scheduled_time: m.scheduled_time ?? null,
    match_order: m.match_order ?? index,
    bye_team_id: m.bye_team_id ?? null,
    status: 'scheduled',
  }))

  const { error } = await supabase.from('matches').insert(matchesToInsert)

  if (error) {
    console.error('Insert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, count: matchesToInsert.length })
}
