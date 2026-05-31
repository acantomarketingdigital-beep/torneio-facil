import { type AvailableSlot, type Venue, type GeneratedMatch, type ScheduleConstraints, type ChampionshipBreak } from '@/types'
import { parseISO, addMinutes, format, isBefore, isAfter, differenceInMinutes } from 'date-fns'

interface TimeSlot {
  date: string
  time: string
  venueId: string
  venueName: string
  slotEndTime: string
}

export function scheduleMatches(
  matches: GeneratedMatch[],
  slots: AvailableSlot[],
  venues: Venue[],
  constraints: ScheduleConstraints,
  breaks: ChampionshipBreak[] = [],
  safetyMarginMinutes = 0
): GeneratedMatch[] {
  const { gameDuration, intervalBetweenGames, minRestMinutes, maxGamesPerDayPerTeam } = constraints

  // totalSlotDuration includes safety margin so consecutive slots already have breathing room
  const totalSlotDuration = gameDuration + safetyMarginMinutes + intervalBetweenGames

  // Build available time slots per venue
  const allSlots: TimeSlot[] = []

  const sortedSlots = [...slots].sort((a, b) => {
    const da = `${a.slot_date}T${a.start_time}`
    const db = `${b.slot_date}T${b.start_time}`
    return da < db ? -1 : 1
  })

  for (const slot of sortedSlots) {
    const applicableVenues = slot.venue_id
      ? venues.filter(v => v.id === slot.venue_id && v.is_active)
      : venues.filter(v => v.is_active)

    // Get breaks that apply to this specific date
    const dateBreaks = breaks.filter(b =>
      b.applies_to_all_dates || b.slot_date === slot.slot_date
    ).map(b => ({
      start: parseISO(`${slot.slot_date}T${b.start_time}`),
      end: parseISO(`${slot.slot_date}T${b.end_time}`),
      name: b.name,
    }))

    for (const venue of applicableVenues) {
      const start = parseISO(`${slot.slot_date}T${slot.start_time}`)
      const end = parseISO(`${slot.slot_date}T${slot.end_time}`)

      let current = start
      while (differenceInMinutes(end, current) >= gameDuration) {
        const gameEnd = addMinutes(current, gameDuration)
        const gameEndWithMargin = addMinutes(current, gameDuration + safetyMarginMinutes)

        // Never generate slots that cross midnight
        if (format(gameEnd, 'yyyy-MM-dd') !== slot.slot_date) break

        // Check if current time is inside any break → jump past it
        let jumpedToBreakEnd = false
        for (const brk of dateBreaks) {
          // If the current start falls inside a break, jump to break end
          if (!isBefore(current, brk.start) && isBefore(current, brk.end)) {
            current = brk.end
            jumpedToBreakEnd = true
            break
          }
          // If the game end (with margin) overlaps into a break start, jump past break
          if (isBefore(current, brk.start) && isAfter(gameEndWithMargin, brk.start)) {
            current = brk.end
            jumpedToBreakEnd = true
            break
          }
        }
        if (jumpedToBreakEnd) continue

        allSlots.push({
          date: slot.slot_date,
          time: format(current, 'HH:mm'),
          venueId: venue.id,
          venueName: venue.name,
          slotEndTime: format(gameEnd, 'HH:mm'),
        })
        current = addMinutes(current, totalSlotDuration)
      }
    }
  }

  // Sort slots by date+time so all courts at 08:30 come before all courts at 09:40, etc.
  allSlots.sort((a, b) => {
    const da = `${a.date}T${a.time}`
    const db = `${b.date}T${b.time}`
    if (da !== db) return da < db ? -1 : 1
    return a.venueName < b.venueName ? -1 : a.venueName > b.venueName ? 1 : 0
  })

  // Track usage
  const venueUsed = new Map<string, Set<string>>()
  const teamDayCount = new Map<string, number>()
  const teamLastEnd = new Map<string, Date>()

  function venueKey(venueId: string, date: string, time: string) {
    return `${venueId}||${date}||${time}`
  }

  function teamDayKey(teamId: string, date: string) {
    return `${teamId}||${date}`
  }

  function canSchedule(match: GeneratedMatch, slot: TimeSlot): boolean {
    const { home_team_id, away_team_id } = match
    if (!home_team_id || !away_team_id) return false

    const matchStart = parseISO(`${slot.date}T${slot.time}`)
    const matchEnd = addMinutes(matchStart, gameDuration)

    // Venue conflict
    const vKey = venueKey(slot.venueId, slot.date, slot.time)
    if (venueUsed.get(slot.venueId)?.has(vKey)) return false

    for (const teamId of [home_team_id, away_team_id]) {
      const tDayKey = teamDayKey(teamId, slot.date)
      const dayCount = teamDayCount.get(tDayKey) ?? 0
      if (dayCount >= maxGamesPerDayPerTeam) return false

      const lastEnd = teamLastEnd.get(teamId)
      if (lastEnd && differenceInMinutes(matchStart, lastEnd) < minRestMinutes) return false
    }

    return true
  }

  function markUsed(match: GeneratedMatch, slot: TimeSlot) {
    const { home_team_id, away_team_id } = match
    if (!home_team_id || !away_team_id) return

    const matchStart = parseISO(`${slot.date}T${slot.time}`)
    const matchEnd = addMinutes(matchStart, gameDuration)

    if (!venueUsed.has(slot.venueId)) venueUsed.set(slot.venueId, new Set())
    venueUsed.get(slot.venueId)!.add(venueKey(slot.venueId, slot.date, slot.time))

    for (const teamId of [home_team_id, away_team_id]) {
      const tDayKey = teamDayKey(teamId, slot.date)
      teamDayCount.set(tDayKey, (teamDayCount.get(tDayKey) ?? 0) + 1)

      const prev = teamLastEnd.get(teamId)
      if (!prev || isAfter(matchEnd, prev)) {
        teamLastEnd.set(teamId, matchEnd)
      }
    }
  }

  const sorted = [...matches].sort((a, b) => (a.round ?? 0) - (b.round ?? 0))

  const scheduled: GeneratedMatch[] = []
  const unscheduled: GeneratedMatch[] = []

  for (const match of sorted) {
    if (!match.home_team_id || !match.away_team_id) {
      scheduled.push(match)
      continue
    }

    let assigned = false

    for (const slot of allSlots) {
      if (canSchedule(match, slot)) {
        markUsed(match, slot)
        scheduled.push({
          ...match,
          venue_id: slot.venueId,
          scheduled_date: slot.date,
          scheduled_time: slot.time,
        })
        assigned = true
        break
      }
    }

    if (!assigned) unscheduled.push(match)
  }

  return [...scheduled, ...unscheduled]
}
