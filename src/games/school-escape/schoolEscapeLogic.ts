import {
  BASE_OUTFIT_COLOR,
  type CamouflageSample,
  type OklabColor,
  type PaintMix,
  type SrgbColor,
  type TeacherPerceptionSample,
  type TeacherSnapshot,
  type TeacherVisibilitySample,
} from './schoolEscapeTypes'

const RYB_CUBE = {
  white: { r: 1, g: 1, b: 1 },
  blue: { r: 0.163, g: 0.373, b: 0.6 },
  yellow: { r: 1, g: 1, b: 0 },
  green: { r: 0, g: 0.66, b: 0.2 },
  red: { r: 1, g: 0, b: 0 },
  purple: { r: 0.5, g: 0, b: 0.5 },
  orange: { r: 1, g: 0.5, b: 0 },
  brown: { r: 0.2, g: 0.094, b: 0 },
} as const

const MAX_HIDE_DISTANCE = 0.8
const MAX_HIDE_SPEED = 0.18
const DIRECT_CHASE_VISIBILITY = 0.75
const SUSPICION_VISIBILITY = 0.08
const SUSPICION_GAIN_PER_SECOND = 1.5
const SUSPICION_DECAY_PER_SECOND = 0.5
const LOST_SIGHT_TO_SEARCH_SECONDS = 1.25
const SEARCH_SECONDS = 5
const RECOVER_SECONDS = 1.5
const OKLAB_MAX_GAME_DISTANCE = 0.55

function clamp(value: number, min = 0, max = 1) {
  const safeValue = Number.isFinite(value) ? value : min
  return Math.max(min, Math.min(max, safeValue))
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function lerpColor(a: SrgbColor, b: SrgbColor, t: number): SrgbColor {
  return {
    r: lerp(a.r, b.r, t),
    g: lerp(a.g, b.g, t),
    b: lerp(a.b, b.b, t),
  }
}

function bilerpColor(
  c00: SrgbColor,
  c10: SrgbColor,
  c01: SrgbColor,
  c11: SrgbColor,
  x: number,
  y: number,
) {
  return lerpColor(lerpColor(c00, c10, x), lerpColor(c01, c11, x), y)
}

function trilinearRyb(red: number, yellow: number, blue: number): SrgbColor {
  const lowBlue = bilerpColor(
    RYB_CUBE.white,
    RYB_CUBE.red,
    RYB_CUBE.yellow,
    RYB_CUBE.orange,
    red,
    yellow,
  )
  const highBlue = bilerpColor(
    RYB_CUBE.blue,
    RYB_CUBE.purple,
    RYB_CUBE.green,
    RYB_CUBE.brown,
    red,
    yellow,
  )

  return lerpColor(lowBlue, highBlue, blue)
}

export function mixPaint(mix: PaintMix): SrgbColor {
  const red = clamp(mix.red)
  const yellow = clamp(mix.yellow)
  const blue = clamp(mix.blue)
  const white = clamp(mix.white)
  const black = clamp(mix.black)
  const strongestPrimary = Math.max(red, yellow, blue)

  const primaryColor = strongestPrimary > 0
    ? trilinearRyb(
        red / strongestPrimary,
        yellow / strongestPrimary,
        blue / strongestPrimary,
      )
    : RYB_CUBE.white

  return lerpColor(
    lerpColor(primaryColor, RYB_CUBE.white, white),
    { r: 0, g: 0, b: 0 },
    black,
  )
}

export function displayedClothingColor(mix: PaintMix): SrgbColor {
  const totalPaint =
    clamp(mix.red) +
    clamp(mix.yellow) +
    clamp(mix.blue) +
    clamp(mix.white) +
    clamp(mix.black)
  const coverage = clamp(totalPaint / 1.25)

  return lerpColor(BASE_OUTFIT_COLOR, mixPaint(mix), coverage)
}

function srgbChannelToLinear(channel: number) {
  const value = clamp(channel)
  return value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4
}

export function srgbToOklab(color: SrgbColor): OklabColor {
  const r = srgbChannelToLinear(color.r)
  const g = srgbChannelToLinear(color.g)
  const b = srgbChannelToLinear(color.b)

  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b

  const lRoot = Math.cbrt(l)
  const mRoot = Math.cbrt(m)
  const sRoot = Math.cbrt(s)

  return {
    l: 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
    a: 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
    b: 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
  }
}

export function colorMatchScore(a: SrgbColor, b: SrgbColor) {
  const left = srgbToOklab(a)
  const right = srgbToOklab(b)
  const distance = Math.hypot(
    left.l - right.l,
    left.a - right.a,
    left.b - right.b,
  )

  return 1 - clamp(distance / OKLAB_MAX_GAME_DISTANCE)
}

export function camouflageVisibilityMultiplier(sample: CamouflageSample) {
  const eligible =
    sample.grounded &&
    sample.surfaceDistance <= MAX_HIDE_DISTANCE &&
    sample.horizontalSpeed < MAX_HIDE_SPEED

  if (!eligible) {
    return 1
  }

  const progress = clamp((sample.match - 0.72) / 0.28)
  return lerp(1, 0.12, progress)
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = clamp((value - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

export function computeTeacherVisibility(sample: TeacherVisibilitySample) {
  if (!sample.hasLineOfSight) {
    return 0
  }

  const sightRange = Math.max(0.001, sample.sightRange)
  const distanceFactor = clamp(1 - Math.max(0, sample.distance) / sightRange)
  const angleFactor = smoothstep(0.25, 0.8, sample.viewAlignment)
  const movementFactor = sample.sprinting
    ? 1
    : sample.speed > MAX_HIDE_SPEED
      ? 0.72
      : 0.32

  return clamp(
    distanceFactor *
      angleFactor *
      movementFactor *
      clamp(sample.camouflageMultiplier),
  )
}

function nextSnapshot(
  previous: TeacherSnapshot,
  patch: Partial<TeacherSnapshot>,
): TeacherSnapshot {
  return { ...previous, ...patch }
}

function enterChase(previous: TeacherSnapshot): TeacherSnapshot {
  return nextSnapshot(previous, {
    state: 'chase',
    suspicion: 1,
    lostSightFor: 0,
    stateElapsed: 0,
    shout: true,
  })
}

export function updateTeacherState(
  previous: TeacherSnapshot,
  sample: TeacherPerceptionSample,
): TeacherSnapshot {
  const dt = Math.max(0, Number.isFinite(sample.dt) ? sample.dt : 0)
  const visibility = clamp(sample.visibility)

  if (previous.state === 'patrol') {
    if (sample.hasLineOfSight && visibility >= DIRECT_CHASE_VISIBILITY) {
      return enterChase(previous)
    }

    if (sample.hasLineOfSight && visibility >= SUSPICION_VISIBILITY) {
      return nextSnapshot(previous, {
        state: 'suspicious',
        suspicion: clamp(visibility * SUSPICION_GAIN_PER_SECOND * dt),
        stateElapsed: 0,
        lostSightFor: 0,
        shout: false,
      })
    }

    return nextSnapshot(previous, {
      suspicion: 0,
      lostSightFor: 0,
      stateElapsed: previous.stateElapsed + dt,
      shout: false,
    })
  }

  if (previous.state === 'suspicious') {
    if (sample.hasLineOfSight && visibility >= DIRECT_CHASE_VISIBILITY) {
      return enterChase(previous)
    }

    const suspicion = sample.hasLineOfSight && visibility >= SUSPICION_VISIBILITY
      ? clamp(previous.suspicion + visibility * SUSPICION_GAIN_PER_SECOND * dt)
      : clamp(previous.suspicion - SUSPICION_DECAY_PER_SECOND * dt)

    if (suspicion >= 1) {
      return enterChase(previous)
    }

    if (suspicion <= 0) {
      return {
        state: 'patrol',
        suspicion: 0,
        lostSightFor: 0,
        stateElapsed: 0,
        shout: false,
      }
    }

    return nextSnapshot(previous, {
      suspicion,
      stateElapsed: previous.stateElapsed + dt,
      shout: false,
    })
  }

  if (previous.state === 'chase') {
    if (sample.hasLineOfSight && visibility >= SUSPICION_VISIBILITY) {
      return nextSnapshot(previous, {
        suspicion: 1,
        lostSightFor: 0,
        stateElapsed: previous.stateElapsed + dt,
        shout: false,
      })
    }

    const lostSightFor = previous.lostSightFor + dt
    if (lostSightFor >= LOST_SIGHT_TO_SEARCH_SECONDS) {
      return {
        state: 'search',
        suspicion: 0.55,
        lostSightFor: 0,
        stateElapsed: 0,
        shout: false,
      }
    }

    return nextSnapshot(previous, {
      lostSightFor,
      stateElapsed: previous.stateElapsed + dt,
      shout: false,
    })
  }

  if (previous.state === 'search') {
    if (sample.hasLineOfSight && visibility >= DIRECT_CHASE_VISIBILITY) {
      return enterChase(previous)
    }

    if (sample.hasLineOfSight && visibility >= SUSPICION_VISIBILITY) {
      return nextSnapshot(previous, {
        suspicion: clamp(
          previous.suspicion + visibility * SUSPICION_GAIN_PER_SECOND * dt,
        ),
        stateElapsed: 0,
        shout: false,
      })
    }

    const stateElapsed = previous.stateElapsed + dt
    if (stateElapsed >= SEARCH_SECONDS) {
      return {
        state: 'recover',
        suspicion: 0,
        lostSightFor: 0,
        stateElapsed: 0,
        shout: false,
      }
    }

    return nextSnapshot(previous, {
      stateElapsed,
      shout: false,
    })
  }

  if (sample.hasLineOfSight && visibility >= DIRECT_CHASE_VISIBILITY) {
    return enterChase(previous)
  }

  if (sample.hasLineOfSight && visibility >= SUSPICION_VISIBILITY) {
    return {
      state: 'suspicious',
      suspicion: clamp(visibility * SUSPICION_GAIN_PER_SECOND * dt),
      lostSightFor: 0,
      stateElapsed: 0,
      shout: false,
    }
  }

  const stateElapsed = previous.stateElapsed + dt
  if (stateElapsed >= RECOVER_SECONDS) {
    return {
      state: 'patrol',
      suspicion: 0,
      lostSightFor: 0,
      stateElapsed: 0,
      shout: false,
    }
  }

  return nextSnapshot(previous, {
    stateElapsed,
    shout: false,
  })
}

export function stepScalarSpeed(current: number, target: number, maxDelta: number) {
  const safeCurrent = Number.isFinite(current) ? current : 0
  const safeTarget = Number.isFinite(target) ? target : 0
  const safeDelta = Math.max(0, Number.isFinite(maxDelta) ? maxDelta : 0)
  const difference = safeTarget - safeCurrent

  if (Math.abs(difference) <= safeDelta) {
    return safeTarget
  }

  return safeCurrent + Math.sign(difference) * safeDelta
}
