import { type Team, type GeneratedMatch } from '@/types'

/**
 * Generates a schedule where each team plays exactly `gamesPerTeam` matches.
 * Uses a greedy balanced approach: builds a list of all desired matchups
 * then distributes them ensuring no team exceeds gamesPerTeam.
 */
export function generateCustomFormat(
  teams: Team[],
  gamesPerTeam: number
): GeneratedMatch[] {
  if (teams.length < 2 || gamesPerTeam < 1) return []

  const n = teams.length
  // Total matches = (n * gamesPerTeam) / 2
  const totalMatches = Math.floor((n * gamesPerTeam) / 2)

  // Count how many games each team still needs
  const remaining = new Map<string, number>()
  teams.forEach(t => remaining.set(t.id, gamesPerTeam))

  // Generate all possible unique pairs sorted by priority (teams with most remaining games first)
  const matches: GeneratedMatch[] = []
  const played = new Set<string>() // "teamA-teamB" canonical key
  let matchOrder = 0

  let iterations = 0
  const maxIterations = totalMatches * 10

  while (matches.length < totalMatches && iterations < maxIterations) {
    iterations++

    // Sort teams by remaining games descending
    const sorted = [...teams]
      .filter(t => (remaining.get(t.id) ?? 0) > 0)
      .sort((a, b) => (remaining.get(b.id) ?? 0) - (remaining.get(a.id) ?? 0))

    if (sorted.length < 2) break

    let added = false

    outer: for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i]
        const b = sorted[j]
        const key = [a.id, b.id].sort().join('-')

        // Allow multiple meetings if gamesPerTeam > teams-1
        const meetingCount = countMeetings(matches, a.id, b.id)
        const maxMeetings = Math.ceil(gamesPerTeam / (n - 1))

        if (meetingCount >= maxMeetings) continue

        if ((remaining.get(a.id) ?? 0) > 0 && (remaining.get(b.id) ?? 0) > 0) {
          const round = Math.floor(matchOrder / Math.floor(n / 2)) + 1
          matches.push({
            home_team_id: a.id,
            away_team_id: b.id,
            round,
            round_name: `Rodada ${round}`,
            phase: 'round_robin',
            match_order: matchOrder++,
          })
          remaining.set(a.id, (remaining.get(a.id) ?? 0) - 1)
          remaining.set(b.id, (remaining.get(b.id) ?? 0) - 1)
          added = true
          break outer
        }
      }
    }

    if (!added) break
  }

  return matches
}

function countMeetings(matches: GeneratedMatch[], teamA: string, teamB: string): number {
  return matches.filter(m =>
    (m.home_team_id === teamA && m.away_team_id === teamB) ||
    (m.home_team_id === teamB && m.away_team_id === teamA)
  ).length
}
