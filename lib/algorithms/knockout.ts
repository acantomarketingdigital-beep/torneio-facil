import { type Team, type GeneratedMatch, type MatchPhase } from '@/types'

function nextPowerOf2(n: number): number {
  return Math.pow(2, Math.ceil(Math.log2(n)))
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Distribute seeds into bracket positions so top seeds meet late.
 * Seeds 1 and 2 go to opposite halves, 3/4 spread to quarterfinals, etc.
 */
function distributeSeeds(teams: Team[], size: number): (Team | null)[] {
  const bracket: (Team | null)[] = new Array(size).fill(null)

  if (teams.length === 0) return bracket

  // Classic seeding positions for powers of 2
  const positions = getSeedPositions(size)

  teams.forEach((team, index) => {
    if (positions[index] !== undefined) {
      bracket[positions[index]] = team
    }
  })

  return bracket
}

function getSeedPositions(size: number): number[] {
  if (size === 2) return [0, 1]
  if (size === 4) return [0, 3, 1, 2]
  if (size === 8) return [0, 7, 3, 4, 1, 6, 2, 5]
  if (size === 16) return [0, 15, 7, 8, 3, 12, 4, 11, 1, 14, 6, 9, 2, 13, 5, 10]

  // Generic: spread recursively
  const half = getSeedPositions(size / 2)
  const result: number[] = []
  half.forEach((pos, i) => {
    result.push(pos)
    result.push(size - 1 - pos)
  })
  return result
}

function phaseNameForRound(totalRounds: number, round: number): MatchPhase {
  const roundsFromFinal = totalRounds - round
  if (roundsFromFinal === 0) return 'final'
  if (roundsFromFinal === 1) return 'semi_final'
  if (roundsFromFinal === 2) return 'quarter_final'
  if (roundsFromFinal === 3) return 'round_of_16'
  return 'round_robin' // generic for earlier rounds
}

function phaseLabel(phase: MatchPhase): string {
  const labels: Record<string, string> = {
    final: 'Final',
    semi_final: 'Semifinal',
    quarter_final: 'Quartas de Final',
    round_of_16: 'Oitavas de Final',
    round_robin: 'Fase Inicial',
  }
  return labels[phase] ?? phase
}

/**
 * Generates a single-elimination knockout bracket.
 * Returns first-round matches only; subsequent rounds are created as TBD
 * slots that will be filled in as results come in.
 */
export function generateKnockout(
  teams: Team[],
  useSeed = true,
  includeThirdPlace = true
): GeneratedMatch[] {
  if (teams.length < 2) return []

  const size = nextPowerOf2(teams.length)
  const byeCount = size - teams.length
  const totalRounds = Math.log2(size)

  const sorted = useSeed
    ? [...teams].sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999))
    : shuffle(teams)

  const bracket = distributeSeeds(sorted, size)
  const matches: GeneratedMatch[] = []
  let matchOrder = 0

  // Round 1 — some may be byes
  const round1Ids: string[] = []
  for (let i = 0; i < size / 2; i++) {
    const home = bracket[i * 2]
    const away = bracket[i * 2 + 1]

    if (!home && !away) continue

    if (!home || !away) {
      // Bye: the present team advances automatically
      const byeTeam = home ?? away
      round1Ids.push(`bye_${byeTeam?.id}`)
      matches.push({
        home_team_id: byeTeam?.id ?? null,
        away_team_id: null,
        round: 1,
        round_name: 'Primeira Fase',
        phase: phaseNameForRound(totalRounds, 1),
        match_order: matchOrder++,
        bye_team_id: byeTeam?.id,
      } as GeneratedMatch)
    } else {
      round1Ids.push(`match_${i}`)
      const phase = phaseNameForRound(totalRounds, 1)
      matches.push({
        home_team_id: home.id,
        away_team_id: away.id,
        round: 1,
        round_name: phaseLabel(phase),
        phase,
        match_order: matchOrder++,
      })
    }
  }

  // Create subsequent rounds as TBD (null team IDs, will be updated as results arrive)
  for (let round = 2; round <= totalRounds; round++) {
    const matchesInRound = size / Math.pow(2, round)
    const phase = phaseNameForRound(totalRounds, round)

    for (let i = 0; i < matchesInRound; i++) {
      matches.push({
        home_team_id: null,
        away_team_id: null,
        round,
        round_name: phaseLabel(phase),
        phase,
        match_order: matchOrder++,
      })
    }
  }

  // Third place match
  if (includeThirdPlace && size >= 4) {
    matches.push({
      home_team_id: null,
      away_team_id: null,
      round: totalRounds,
      round_name: 'Disputa de 3º Lugar',
      phase: 'third_place',
      match_order: matchOrder++,
    })
  }

  return matches
}
