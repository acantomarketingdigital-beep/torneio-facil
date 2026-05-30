import { type GeneratorConfig, type GeneratedMatch } from '@/types'
import { generateRoundRobin } from './round-robin'
import { generateKnockout } from './knockout'
import { generateGroupKnockout } from './group-knockout'
import { generateCustomFormat } from './custom'
import { scheduleMatches } from './scheduler'

export { generateRoundRobin, generateKnockout, generateGroupKnockout, generateCustomFormat, scheduleMatches }

export function generateMatches(config: GeneratorConfig): GeneratedMatch[] {
  const { format, teams, venues, slots, constraints, customGamesPerTeam, groupsCount, teamsAdvancePerGroup } = config

  let matches: GeneratedMatch[] = []

  switch (format) {
    case 'round_robin':
      matches = generateRoundRobin(teams)
      break

    case 'knockout':
      matches = generateKnockout(teams, true, true)
      break

    case 'group_knockout':
      const { groupMatches, knockoutMatches } = generateGroupKnockout(
        teams,
        groupsCount ?? 4,
        teamsAdvancePerGroup ?? 2
      )
      matches = [...groupMatches, ...knockoutMatches]
      break

    case 'custom':
      matches = generateCustomFormat(teams, customGamesPerTeam ?? 3)
      break

    default:
      matches = generateRoundRobin(teams)
  }

  if (slots.length > 0 && venues.length > 0) {
    matches = scheduleMatches(matches, slots, venues, constraints)
  }

  return matches
}
