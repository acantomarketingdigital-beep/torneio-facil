import { type Team, type GeneratedMatch } from '@/types'

/**
 * Berger circle algorithm for round-robin scheduling.
 * Generates all matches for a round-robin tournament.
 * If doubleLegged=true, each pair plays twice (home/away swap).
 */
export function generateRoundRobin(
  teams: Team[],
  doubleLegged = false
): GeneratedMatch[] {
  const matches: GeneratedMatch[] = []

  if (teams.length < 2) return matches

  // Add phantom team if odd count
  const working = [...teams]
  const hasBye = working.length % 2 !== 0
  const byeId = hasBye ? '__bye__' : null
  if (hasBye) working.push({ id: '__bye__', name: 'BYE' } as Team)

  const n = working.length
  const rounds = n - 1
  const matchesPerRound = n / 2

  // Fix first team, rotate the rest
  const fixed = working[0]
  const rotating = working.slice(1)

  let matchOrder = 0

  for (let round = 0; round < rounds; round++) {
    const roundTeams = [fixed, ...rotating]
    const roundMatches: GeneratedMatch[] = []

    for (let i = 0; i < matchesPerRound; i++) {
      const home = roundTeams[i]
      const away = roundTeams[n - 1 - i]

      if (home.id === byeId || away.id === byeId) continue

      // Alternate home/away based on round to balance
      const [actualHome, actualAway] = round % 2 === 0
        ? [home, away]
        : [away, home]

      roundMatches.push({
        home_team_id: actualHome.id,
        away_team_id: actualAway.id,
        round: round + 1,
        round_name: `Rodada ${round + 1}`,
        phase: 'round_robin',
        match_order: matchOrder++,
      })
    }

    matches.push(...roundMatches)

    // Rotate: move last to first position of rotating
    rotating.unshift(rotating.pop()!)
  }

  if (doubleLegged) {
    const second = matches.map((m, i) => ({
      ...m,
      home_team_id: m.away_team_id!,
      away_team_id: m.home_team_id,
      round: m.round + rounds,
      round_name: `Rodada ${m.round + rounds}`,
      match_order: matchOrder + i,
    }))
    matches.push(...second)
  }

  return matches
}
