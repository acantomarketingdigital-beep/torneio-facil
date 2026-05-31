import { type Team } from '@/types'

export interface Division {
  key: string        // e.g. "SUB 14|FEM"
  category: string
  gender: string
  teams: Team[]
}

export interface AutoKey {
  id: string         // temp id like "__key_SUB14|FEM_0__"
  name: string       // e.g. "SUB 14 FEM - Chave A"
  divisionKey: string
  category: string
  gender: string
  teams: Team[]
}

/** Groups teams by (category, gender). Teams without both fields go into a single fallback group. */
export function groupByDivision(teams: Team[]): Division[] {
  const map = new Map<string, Division>()

  for (const team of teams) {
    const cat = team.category?.trim() ?? ''
    const gen = team.gender?.trim() ?? ''
    const key = `${cat}|${gen}`
    if (!map.has(key)) {
      map.set(key, { key, category: cat, gender: gen, teams: [] })
    }
    map.get(key)!.teams.push(team)
  }

  return [...map.values()].sort((a, b) => {
    const k = a.category.localeCompare(b.category)
    return k !== 0 ? k : a.gender.localeCompare(b.gender)
  })
}

/** Calculates how many keys a division of N teams should have. */
export function calcKeysCount(n: number): number {
  if (n <= 5) return 1
  if (n <= 8) return 2
  if (n <= 12) return 3
  if (n <= 16) return 4
  if (n <= 20) return 5
  return Math.ceil(n / 5)
}

/** Distributes teams into K keys using snake-draft so sizes are balanced. */
export function distributeIntoKeys(teams: Team[], keysCount: number): Team[][] {
  const keys: Team[][] = Array.from({ length: keysCount }, () => [])
  const sorted = [...teams].sort((a, b) => {
    if (a.seed != null && b.seed != null) return a.seed - b.seed
    if (a.seed != null) return -1
    if (b.seed != null) return 1
    return a.name.localeCompare(b.name, 'pt-BR')
  })

  sorted.forEach((team, i) => {
    const row = Math.floor(i / keysCount)
    const col = i % keysCount
    const target = row % 2 === 0 ? col : keysCount - 1 - col
    keys[target].push(team)
  })

  return keys
}

/** Splits a division into auto-generated keys. */
export function buildAutoKeys(division: Division): AutoKey[] {
  const keysCount = calcKeysCount(division.teams.length)
  const buckets = distributeIntoKeys(division.teams, keysCount)

  return buckets.map((teams, i) => {
    const letter = keysCount === 1 ? '' : ` - Chave ${String.fromCharCode(65 + i)}`
    const label = [division.category, division.gender].filter(Boolean).join(' ') || 'Geral'
    return {
      id: `__key_${division.key}_${i}__`,
      name: `${label}${letter}`,
      divisionKey: division.key,
      category: division.category,
      gender: division.gender,
      teams,
    }
  })
}

/** Full pipeline: teams → divisions → keys. */
export function buildAllKeys(teams: Team[]): AutoKey[] {
  const divisions = groupByDivision(teams)
  return divisions.flatMap(div => buildAutoKeys(div))
}
