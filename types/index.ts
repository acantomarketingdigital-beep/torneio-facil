export type ChampionshipFormat = 'round_robin' | 'knockout' | 'group_knockout' | 'custom' | 'auto'
export type ChampionshipStatus = 'draft' | 'published' | 'in_progress' | 'finished'
export type MatchStatus = 'scheduled' | 'in_progress' | 'finished' | 'cancelled' | 'walkover'
export type MatchPhase = 'group' | 'round_robin' | 'round_of_16' | 'quarter_final' | 'semi_final' | 'third_place' | 'final'

export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Championship {
  id: string
  owner_id: string
  name: string
  sport: string
  format: ChampionshipFormat
  status: ChampionshipStatus
  slug: string | null
  description: string | null
  logo_url: string | null
  location: string | null
  start_date: string | null
  end_date: string | null
  game_duration: number
  interval_between_games: number
  min_rest_minutes: number
  max_games_per_day_per_team: number
  custom_games_per_team: number | null
  points_win: number
  points_draw: number
  points_loss: number
  tiebreaker_order: string[]
  allow_draws: boolean
  groups_count: number | null
  teams_advance_per_group: number | null
  is_public: boolean
  regulation: string | null
  courts_count: number
  default_start_time: string
  default_end_time: string
  safety_margin_minutes: number
  created_at: string
  updated_at: string
}

export interface ChampionshipBreak {
  id: string
  championship_id: string
  name: string
  start_time: string
  end_time: string
  applies_to_all_dates: boolean
  slot_date: string | null
  created_at: string
}

export interface Team {
  id: string
  championship_id: string
  name: string
  short_name: string | null
  logo_url: string | null
  color: string
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  seed: number | null
  category: string | null
  gender: string | null
  created_at: string
}

export interface Venue {
  id: string
  championship_id: string
  name: string
  description: string | null
  address: string | null
  is_active: boolean
  created_at: string
}

export interface AvailableSlot {
  id: string
  championship_id: string
  venue_id: string | null
  slot_date: string
  start_time: string
  end_time: string
  created_at: string
  venue?: Venue
}

export interface Group {
  id: string
  championship_id: string
  name: string
  order: number
  teams_advance: number
  created_at: string
  teams?: Team[]
}

export interface GroupTeam {
  id: string
  group_id: string
  team_id: string
  team?: Team
}

export interface Match {
  id: string
  championship_id: string
  group_id: string | null
  round: number | null
  round_name: string | null
  phase: MatchPhase
  home_team_id: string | null
  away_team_id: string | null
  venue_id: string | null
  scheduled_date: string | null
  scheduled_time: string | null
  status: MatchStatus
  home_score: number | null
  away_score: number | null
  winner_id: string | null
  notes: string | null
  match_order: number
  parent_match_id: string | null
  parent_slot: string | null
  is_manual: boolean
  bye_team_id: string | null
  created_at: string
  updated_at: string
  home_team?: Team
  away_team?: Team
  venue?: Venue
  group?: Group
}

export interface Standing {
  id: string
  championship_id: string
  group_id: string | null
  team_id: string
  position: number
  played: number
  wins: number
  draws: number
  losses: number
  goals_for: number
  goals_against: number
  goal_difference: number
  points: number
  updated_at: string
  team?: Team
}

// Generator types
export interface ScheduleConstraints {
  gameDuration: number       // minutes
  intervalBetweenGames: number // minutes
  minRestMinutes: number     // minimum rest between games for same team
  maxGamesPerDayPerTeam: number
}

export interface TimeSlotItem {
  date: string
  time: string
  venueId: string
  venueName: string
}

export interface GeneratorConfig {
  format: ChampionshipFormat
  teams: Team[]
  venues: Venue[]
  slots: AvailableSlot[]
  constraints: ScheduleConstraints
  customGamesPerTeam?: number
  groupsCount?: number
  teamsAdvancePerGroup?: number
  allowDraws?: boolean
}

export interface GeneratedMatch {
  home_team_id: string | null
  away_team_id: string | null
  round: number
  round_name: string
  phase: MatchPhase
  group_id?: string
  venue_id?: string
  scheduled_date?: string
  scheduled_time?: string
  match_order: number
  bye_team_id?: string
}

// Dashboard stats
export interface ChampionshipStats {
  totalTeams: number
  totalMatches: number
  finishedMatches: number
  scheduledMatches: number
  totalVenues: number
}
