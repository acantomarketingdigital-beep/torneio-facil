import { type Team, type Group, type GeneratedMatch } from '@/types'
import { generateRoundRobin } from './round-robin'
import { generateKnockout } from './knockout'

interface GroupWithTeams extends Group {
  teams: Team[]
}

/**
 * Divides teams into groups as evenly as possible.
 */
export function distributeTeamsIntoGroups(
  teams: Team[],
  groupCount: number
): GroupWithTeams[] {
  const shuffled = [...teams].sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999))
  const groups: GroupWithTeams[] = []

  for (let i = 0; i < groupCount; i++) {
    groups.push({
      id: `__group_${i}__`,
      championship_id: '',
      name: `Grupo ${String.fromCharCode(65 + i)}`,
      order: i,
      teams_advance: 2,
      created_at: new Date().toISOString(),
      teams: [],
    })
  }

  // Snake-draft distribution: seeds distributed across groups
  shuffled.forEach((team, index) => {
    const groupIndex = index % groupCount
    const row = Math.floor(index / groupCount)
    const actualIndex = row % 2 === 0 ? groupIndex : groupCount - 1 - groupIndex
    groups[actualIndex].teams.push(team)
  })

  return groups
}

/**
 * Generates group stage + knockout tournament.
 * Group phase uses round-robin within each group.
 * Knockout uses top N teams per group.
 */
export function generateGroupKnockout(
  teams: Team[],
  groupCount: number,
  teamsAdvancePerGroup: number,
  existingGroups?: GroupWithTeams[]
): {
  groups: GroupWithTeams[]
  groupMatches: GeneratedMatch[]
  knockoutMatches: GeneratedMatch[]
} {
  const groups = existingGroups ?? distributeTeamsIntoGroups(teams, groupCount)

  let matchOrder = 0
  const groupMatches: GeneratedMatch[] = []

  groups.forEach(group => {
    const rrMatches = generateRoundRobin(group.teams)
    rrMatches.forEach(m => {
      groupMatches.push({
        ...m,
        group_id: group.id,
        phase: 'group',
        round_name: `${group.name} - ${m.round_name}`,
        match_order: matchOrder++,
      })
    })
  })

  // Placeholder teams for knockout (will be determined by standings)
  const totalAdvancing = groups.length * teamsAdvancePerGroup
  const placeholderTeams: Team[] = Array.from({ length: totalAdvancing }, (_, i) => ({
    id: `__advancing_${i}__`,
    championship_id: '',
    name: `Classificado ${i + 1}`,
    short_name: null,
    logo_url: null,
    color: '#3B82F6',
    contact_name: null,
    contact_phone: null,
    contact_email: null,
    seed: i + 1,
    category: null,
    gender: null,
    created_at: new Date().toISOString(),
  }))

  const knockoutMatches = generateKnockout(placeholderTeams, true, true).map((m, i) => ({
    ...m,
    // Mark as TBD — home/away_team_id will be null
    home_team_id: null,
    away_team_id: null,
    match_order: matchOrder + i,
  }))

  return { groups, groupMatches, knockoutMatches }
}
