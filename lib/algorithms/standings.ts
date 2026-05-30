import { type Match, type Team, type Standing, type Championship } from '@/types'

interface StandingRow {
  team: Team
  groupId: string | null
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
}

/**
 * Calculates standings from finished matches.
 * Supports all tiebreaker criteria.
 */
export function calculateStandings(
  teams: Team[],
  matches: Match[],
  championship: Pick<Championship, 'points_win' | 'points_draw' | 'points_loss' | 'tiebreaker_order'>,
  groupId?: string | null
): StandingRow[] {
  const rows = new Map<string, StandingRow>()

  teams.forEach(team => {
    rows.set(team.id, {
      team,
      groupId: groupId ?? null,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    })
  })

  const relevantMatches = matches.filter(m =>
    m.status === 'finished' &&
    m.home_score !== null &&
    m.away_score !== null &&
    (groupId === undefined || m.group_id === groupId)
  )

  for (const match of relevantMatches) {
    const home = rows.get(match.home_team_id ?? '')
    const away = rows.get(match.away_team_id ?? '')

    if (!home || !away) continue

    const hs = match.home_score!
    const as_ = match.away_score!

    home.played++
    away.played++
    home.goalsFor += hs
    home.goalsAgainst += as_
    away.goalsFor += as_
    away.goalsAgainst += hs

    if (hs > as_) {
      home.wins++
      home.points += championship.points_win
      away.losses++
      away.points += championship.points_loss
    } else if (hs < as_) {
      away.wins++
      away.points += championship.points_win
      home.losses++
      home.points += championship.points_loss
    } else {
      home.draws++
      home.points += championship.points_draw
      away.draws++
      away.points += championship.points_draw
    }
  }

  rows.forEach(row => {
    row.goalDifference = row.goalsFor - row.goalsAgainst
  })

  return sortStandings([...rows.values()], matches, championship.tiebreaker_order)
}

function sortStandings(
  rows: StandingRow[],
  matches: Match[],
  tiebreakerOrder: string[]
): StandingRow[] {
  return rows.sort((a, b) => {
    for (const criterion of tiebreakerOrder) {
      const diff = compareByCriterion(a, b, criterion, matches)
      if (diff !== 0) return diff
    }
    // Final tiebreaker: alphabetical by name
    return a.team.name.localeCompare(b.team.name)
  })
}

function compareByCriterion(
  a: StandingRow,
  b: StandingRow,
  criterion: string,
  matches: Match[]
): number {
  switch (criterion) {
    case 'points': return b.points - a.points
    case 'wins': return b.wins - a.wins
    case 'goal_difference': return b.goalDifference - a.goalDifference
    case 'goals_for': return b.goalsFor - a.goalsFor
    case 'goals_against': return a.goalsAgainst - b.goalsAgainst
    case 'head_to_head': return compareHeadToHead(a, b, matches)
    default: return 0
  }
}

function compareHeadToHead(
  a: StandingRow,
  b: StandingRow,
  matches: Match[]
): number {
  const h2h = matches.filter(m =>
    m.status === 'finished' &&
    ((m.home_team_id === a.team.id && m.away_team_id === b.team.id) ||
     (m.home_team_id === b.team.id && m.away_team_id === a.team.id))
  )

  let aPoints = 0
  let bPoints = 0

  for (const m of h2h) {
    if (m.home_score === null || m.away_score === null) continue
    if (m.home_team_id === a.team.id) {
      if (m.home_score > m.away_score) aPoints += 3
      else if (m.home_score === m.away_score) { aPoints += 1; bPoints += 1 }
      else bPoints += 3
    } else {
      if (m.away_score > m.home_score) aPoints += 3
      else if (m.home_score === m.away_score) { aPoints += 1; bPoints += 1 }
      else bPoints += 3
    }
  }

  return bPoints - aPoints
}
