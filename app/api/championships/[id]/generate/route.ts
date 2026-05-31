import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildAllKeys } from '@/lib/algorithms/divisions'
import { generateRoundRobin } from '@/lib/algorithms/round-robin'
import { generateCustomFormat } from '@/lib/algorithms/custom'
import { generateKnockout } from '@/lib/algorithms/knockout'
import { generateGroupKnockout } from '@/lib/algorithms/group-knockout'
import { scheduleMatches } from '@/lib/algorithms/scheduler'
import type { GeneratedMatch, ScheduleConstraints, Team } from '@/types'

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

  const [{ data: teams }, { data: venues }, { data: slots }, { data: breaks }] = await Promise.all([
    supabase.from('teams').select('*').eq('championship_id', id).order('category').order('gender').order('name'),
    supabase.from('venues').select('*').eq('championship_id', id).eq('is_active', true).order('name'),
    supabase.from('available_slots').select('*').eq('championship_id', id).order('slot_date').order('start_time'),
    supabase.from('championship_breaks').select('*').eq('championship_id', id).order('start_time'),
  ])

  if (!teams || teams.length < 2) {
    return NextResponse.json({ error: 'Precisa de pelo menos 2 times para gerar a tabela.' }, { status: 400 })
  }

  const constraints: ScheduleConstraints = {
    gameDuration: c.game_duration,
    intervalBetweenGames: c.interval_between_games,
    minRestMinutes: c.min_rest_minutes,
    maxGamesPerDayPerTeam: c.max_games_per_day_per_team,
  }

  const minGamesPerTeam: number = c.custom_games_per_team ?? 0
  const format: string = c.format ?? 'auto'
  const safetyMargin: number = c.safety_margin_minutes ?? 0

  // Clear existing matches and groups
  await supabase.from('matches').delete().eq('championship_id', id)
  await supabase.from('groups').delete().eq('championship_id', id)

  // -------------------------------------------------------------------
  // group_knockout uses its own logic (legacy)
  // -------------------------------------------------------------------
  if (format === 'group_knockout') {
    const { distributeTeamsIntoGroups } = await import('@/lib/algorithms/group-knockout')
    const generatedGroups = distributeTeamsIntoGroups(teams, c.groups_count ?? 4)
    const groupIdMap: Record<string, string> = {}

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
          group.teams.map((t: Team) => ({ group_id: dbGroup.id, team_id: t.id }))
        )
      }
    }

    const { groupMatches, knockoutMatches } = generateGroupKnockout(teams, c.groups_count ?? 4, c.teams_advance_per_group ?? 2)
    let allMatches: GeneratedMatch[] = [...groupMatches, ...knockoutMatches]

    if ((slots ?? []).length > 0 && (venues ?? []).length > 0) {
      allMatches = scheduleMatches(allMatches, slots ?? [], venues ?? [], constraints, breaks ?? [], safetyMargin)
    }

    const matchesToInsert = allMatches.map((m, index) => ({
      championship_id: id,
      group_id: m.group_id ? (groupIdMap[m.group_id] ?? null) : null,
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
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, count: matchesToInsert.length })
  }

  // -------------------------------------------------------------------
  // Auto / round_robin / custom / knockout — division + key logic
  // -------------------------------------------------------------------
  const autoKeys = buildAllKeys(teams)

  // Validate: every key needs >= 2 teams
  const invalidKeys = autoKeys.filter(k => k.teams.length < 2)
  if (invalidKeys.length === autoKeys.length) {
    return NextResponse.json({
      error: 'Nenhum grupo tem times suficientes para gerar jogos (mínimo 2 por chave).',
    }, { status: 400 })
  }

  // Create DB group records for each key
  const groupIdMap: Record<string, string> = {}

  for (let i = 0; i < autoKeys.length; i++) {
    const key = autoKeys[i]
    if (key.teams.length < 2) continue

    const { data: dbGroup } = await supabase.from('groups').insert({
      championship_id: id,
      name: key.name,
      order: i,
      teams_advance: 0,
    }).select('id').single()

    if (dbGroup) {
      groupIdMap[key.id] = dbGroup.id
      await supabase.from('group_teams').insert(
        key.teams.map(t => ({ group_id: dbGroup.id, team_id: t.id }))
      )
    }
  }

  // Generate matches per key
  let allMatches: GeneratedMatch[] = []
  let matchOrderOffset = 0

  const reviewKeys: { name: string; teams: number; matches: number }[] = []

  for (const key of autoKeys) {
    if (key.teams.length < 2) continue

    let keyMatches: GeneratedMatch[] = []

    if (format === 'knockout') {
      keyMatches = generateKnockout(key.teams, true, true)
    } else if (format === 'custom' && minGamesPerTeam > 0) {
      keyMatches = generateCustomFormat(key.teams, minGamesPerTeam)
    } else if (minGamesPerTeam > 0) {
      // auto or round_robin with a minimum — use custom generator
      keyMatches = generateCustomFormat(key.teams, minGamesPerTeam)
    } else {
      // default: full round-robin within the key
      keyMatches = generateRoundRobin(key.teams)
    }

    // Offset match_order so each key's matches come after the previous key's
    keyMatches = keyMatches.map(m => ({
      ...m,
      group_id: key.id,
      match_order: m.match_order + matchOrderOffset,
    }))

    reviewKeys.push({ name: key.name, teams: key.teams.length, matches: keyMatches.length })
    allMatches.push(...keyMatches)
    matchOrderOffset += keyMatches.length
  }

  // Schedule
  if ((slots ?? []).length > 0 && (venues ?? []).length > 0) {
    allMatches = scheduleMatches(allMatches, slots ?? [], venues ?? [], constraints, breaks ?? [], safetyMargin)
  }

  // Count scheduled vs pending
  const scheduled = allMatches.filter(m => m.scheduled_date && m.scheduled_time)
  const pending = allMatches.filter(m => !m.scheduled_date || !m.scheduled_time)

  // Insert matches
  const matchesToInsert = allMatches.map((m, index) => ({
    championship_id: id,
    group_id: m.group_id ? (groupIdMap[m.group_id] ?? null) : null,
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

  return NextResponse.json({
    success: true,
    count: matchesToInsert.length,
    review: {
      keys: reviewKeys,
      totalMatches: allMatches.length,
      totalScheduled: scheduled.length,
      totalPending: pending.length,
    },
  })
}
