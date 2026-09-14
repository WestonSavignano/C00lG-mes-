import { describe, expect, it } from 'vitest'
import {
  camouflageVisibilityMultiplier,
  colorMatchScore,
  computeTeacherVisibility,
  displayedClothingColor,
  mixPaint,
  srgbToOklab,
  stepScalarSpeed,
  updateTeacherState,
} from './schoolEscapeLogic'
import {
  EMPTY_PAINT_MIX,
  PLAYER_SPRINT_SPEED,
  TEACHER_CHASE_SPEED,
  type PaintMix,
  type SrgbColor,
  type TeacherSnapshot,
} from './schoolEscapeTypes'

function luminance(color: SrgbColor) {
  return color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722
}

function paint(overrides: Partial<PaintMix>): PaintMix {
  return { ...EMPTY_PAINT_MIX, ...overrides }
}

const PATROL: TeacherSnapshot = {
  state: 'patrol',
  suspicion: 0,
  lostSightFor: 0,
  stateElapsed: 0,
  shout: false,
}

describe('School Escape paint and camouflage rules', () => {
  it('mixes the five pigments predictably and deterministically', () => {
    const orange = mixPaint(paint({ red: 1, yellow: 1 }))
    const green = mixPaint(paint({ yellow: 1, blue: 1 }))
    const purple = mixPaint(paint({ red: 1, blue: 1 }))
    const red = mixPaint(paint({ red: 1 }))
    const lightRed = mixPaint(paint({ red: 1, white: 0.6 }))
    const darkRed = mixPaint(paint({ red: 1, black: 0.6 }))

    expect(orange.r).toBeGreaterThan(orange.g)
    expect(orange.g).toBeGreaterThan(orange.b)
    expect(green.g).toBeGreaterThan(green.r)
    expect(green.g).toBeGreaterThan(green.b)
    expect(purple.r).toBeGreaterThan(purple.g)
    expect(purple.b).toBeGreaterThan(purple.g)
    expect(luminance(lightRed)).toBeGreaterThan(luminance(red))
    expect(luminance(darkRed)).toBeLessThan(luminance(red))
    expect(mixPaint(paint({ red: 0.35, yellow: 0.6, blue: 0.1 }))).toEqual(
      mixPaint(paint({ red: 0.35, yellow: 0.6, blue: 0.1 })),
    )
  })

  it('uses deterministic OKLab color matching', () => {
    const color = displayedClothingColor(paint({ red: 0.7, yellow: 0.4 }))

    expect(srgbToOklab(color)).toEqual(srgbToOklab(color))
    expect(colorMatchScore(color, color)).toBeCloseTo(1, 6)
    expect(colorMatchScore(color, { r: 0, g: 0, b: 1 })).toBeLessThan(1)
  })

  it('requires good cover conditions for camouflage benefit', () => {
    expect(
      camouflageVisibilityMultiplier({
        match: 1,
        surfaceDistance: 0.2,
        horizontalSpeed: 0.01,
        grounded: true,
      }),
    ).toBeLessThan(0.25)

    expect(
      camouflageVisibilityMultiplier({
        match: 1,
        surfaceDistance: 0.2,
        horizontalSpeed: PLAYER_SPRINT_SPEED,
        grounded: true,
      }),
    ).toBe(1)
  })

  it('keeps perception geometric and lets camouflage reduce rather than erase visibility', () => {
    const base = {
      distance: 4,
      sightRange: 14,
      viewAlignment: 1,
      speed: 0.01,
      sprinting: false,
      camouflageMultiplier: 1,
    }

    expect(computeTeacherVisibility({ ...base, hasLineOfSight: false })).toBe(0)

    const still = computeTeacherVisibility({ ...base, hasLineOfSight: true })
    const sprinting = computeTeacherVisibility({
      ...base,
      hasLineOfSight: true,
      speed: PLAYER_SPRINT_SPEED,
      sprinting: true,
    })
    const camouflaged = computeTeacherVisibility({
      ...base,
      hasLineOfSight: true,
      camouflageMultiplier: 0.12,
    })

    expect(sprinting).toBeGreaterThan(still)
    expect(camouflaged).toBeGreaterThan(0)
    expect(camouflaged).toBeLessThan(still)
  })
})

describe('School Escape teacher and movement rules', () => {
  it('moves through readable suspicion, chase, search, recover, and patrol states', () => {
    const suspicious = updateTeacherState(PATROL, {
      visibility: 0.2,
      hasLineOfSight: true,
      dt: 1,
    })
    expect(suspicious.state).toBe('suspicious')
    expect(suspicious.shout).toBe(false)

    const chase = updateTeacherState(suspicious, {
      visibility: 0.8,
      hasLineOfSight: true,
      dt: 1,
    })
    expect(chase.state).toBe('chase')
    expect(chase.shout).toBe(true)

    const search = updateTeacherState(chase, {
      visibility: 0,
      hasLineOfSight: false,
      dt: 1.3,
    })
    expect(search.state).toBe('search')
    expect(search.shout).toBe(false)

    const recover = updateTeacherState(search, {
      visibility: 0,
      hasLineOfSight: false,
      dt: 5.1,
    })
    expect(recover.state).toBe('recover')

    const patrol = updateTeacherState(recover, {
      visibility: 0,
      hasLineOfSight: false,
      dt: 1.6,
    })
    expect(patrol.state).toBe('patrol')
  })

  it('keeps the teacher slower than a clean player sprint', () => {
    expect(TEACHER_CHASE_SPEED).toBeLessThan(PLAYER_SPRINT_SPEED)
  })

  it('steps scalar speed toward a target without overshoot', () => {
    expect(stepScalarSpeed(0, 4, 1)).toBe(1)
    expect(stepScalarSpeed(3.5, 4, 1)).toBe(4)
    expect(stepScalarSpeed(4, 0, 1)).toBe(3)
  })
})
