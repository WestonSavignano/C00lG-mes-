export type RGBColor = Readonly<{ r: number; g: number; b: number }>
export type BlendQuality = 'poor' | 'close' | 'blended'
export type TeacherState = 'patrol' | 'suspicious' | 'chase' | 'search'
export type GamePhase = 'school' | 'final-chase' | 'failed' | 'won'
export type GameEvent = 'exit' | 'caught' | 'house'

export type CamouflageSample = {
  match: number
  wallDistance: number
  horizontalSpeed: number
  grounded: boolean
}

export type TeacherStateSnapshot = {
  state: TeacherState
  suspicion: number
  lostSightFor: number
  searchElapsed: number
  shout?: boolean
}

export type TeacherPerceptionSample = {
  visibility: number
  hasLineOfSight: boolean
  dt: number
}

const MAX_RGB_DISTANCE = Math.sqrt(3 * 255 * 255)
const EXCELLENT_MATCH = 0.92
const PARTIAL_MATCH = 0.84
const MAX_HIDE_DISTANCE = 0.8
const MAX_HIDE_SPEED = 0.18
const DIRECT_CHASE_VISIBILITY = 0.82
const SUSPICION_VISIBILITY = 0.12
const CHASE_SUSPICION = 1
const LOST_SIGHT_TO_SEARCH_SECONDS = 1.25
const SEARCH_SECONDS = 5

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function clampChannel(value: number) {
  return clamp(Number.isFinite(value) ? value : 0, 0, 255)
}

export function rgbMatchScore(player: RGBColor, wall: RGBColor) {
  const dr = clampChannel(player.r) - clampChannel(wall.r)
  const dg = clampChannel(player.g) - clampChannel(wall.g)
  const db = clampChannel(player.b) - clampChannel(wall.b)
  return clamp(1 - Math.hypot(dr, dg, db) / MAX_RGB_DISTANCE, 0, 1)
}

export function blendQuality(match: number): BlendQuality {
  if (match >= EXCELLENT_MATCH) return 'blended'
  if (match >= PARTIAL_MATCH) return 'close'
  return 'poor'
}

export function camouflageVisibilityMultiplier(sample: CamouflageSample) {
  const eligible =
    sample.grounded &&
    sample.wallDistance <= MAX_HIDE_DISTANCE &&
    sample.horizontalSpeed < MAX_HIDE_SPEED

  if (!eligible || sample.match < PARTIAL_MATCH) return 1

  if (sample.match >= EXCELLENT_MATCH) {
    return clamp(0.1 - (sample.match - EXCELLENT_MATCH) * 0.5, 0.04, 0.1)
  }

  const progress = (sample.match - PARTIAL_MATCH) / (EXCELLENT_MATCH - PARTIAL_MATCH)
  return 0.55 - progress * 0.35
}

export function updateTeacherState(
  previous: TeacherStateSnapshot,
  sample: TeacherPerceptionSample,
): TeacherStateSnapshot {
  const dt = Math.max(0, Number.isFinite(sample.dt) ? sample.dt : 0)
  const visibility = clamp(sample.visibility, 0, 1)

  if (previous.state === 'patrol') {
    if (sample.hasLineOfSight && visibility >= DIRECT_CHASE_VISIBILITY) {
      return {
        state: 'chase',
        suspicion: CHASE_SUSPICION,
        lostSightFor: 0,
        searchElapsed: 0,
        shout: true,
      }
    }

    if (sample.hasLineOfSight && visibility >= SUSPICION_VISIBILITY) {
      return {
        state: 'suspicious',
        suspicion: clamp(visibility * dt * 2.4, 0.05, CHASE_SUSPICION),
        lostSightFor: 0,
        searchElapsed: 0,
      }
    }

    return { ...previous, suspicion: 0, lostSightFor: 0, searchElapsed: 0 }
  }

  if (previous.state === 'suspicious') {
    const nextSuspicion = sample.hasLineOfSight
      ? clamp(previous.suspicion + visibility * dt * 2.4, 0, CHASE_SUSPICION)
      : clamp(previous.suspicion - dt * 0.75, 0, CHASE_SUSPICION)

    if (sample.hasLineOfSight && visibility >= DIRECT_CHASE_VISIBILITY) {
      return {
        state: 'chase',
        suspicion: CHASE_SUSPICION,
        lostSightFor: 0,
        searchElapsed: 0,
        shout: true,
      }
    }

    if (nextSuspicion >= CHASE_SUSPICION) {
      return {
        state: 'chase',
        suspicion: CHASE_SUSPICION,
        lostSightFor: 0,
        searchElapsed: 0,
        shout: true,
      }
    }

    if (nextSuspicion === 0) {
      return { state: 'patrol', suspicion: 0, lostSightFor: 0, searchElapsed: 0 }
    }

    return { ...previous, suspicion: nextSuspicion }
  }

  if (previous.state === 'chase') {
    if (sample.hasLineOfSight && visibility > 0.05) {
      return { ...previous, suspicion: 1, lostSightFor: 0, shout: false }
    }

    const lostSightFor = previous.lostSightFor + dt
    if (lostSightFor >= LOST_SIGHT_TO_SEARCH_SECONDS) {
      return {
        state: 'search',
        suspicion: 0.55,
        lostSightFor: 0,
        searchElapsed: 0,
      }
    }

    return { ...previous, lostSightFor, shout: false }
  }

  if (sample.hasLineOfSight && visibility >= 0.38) {
    return {
      state: 'chase',
      suspicion: 1,
      lostSightFor: 0,
      searchElapsed: 0,
      shout: true,
    }
  }

  const searchElapsed = previous.searchElapsed + dt
  if (searchElapsed >= SEARCH_SECONDS) {
    return { state: 'patrol', suspicion: 0, lostSightFor: 0, searchElapsed: 0 }
  }

  return { ...previous, searchElapsed, shout: false }
}

export function nextGamePhase(phase: GamePhase, event: GameEvent): GamePhase {
  if ((phase === 'school' || phase === 'final-chase') && event === 'caught') {
    return 'failed'
  }
  if (phase === 'school' && event === 'exit') return 'final-chase'
  if (phase === 'final-chase' && event === 'house') return 'won'
  return phase
}
