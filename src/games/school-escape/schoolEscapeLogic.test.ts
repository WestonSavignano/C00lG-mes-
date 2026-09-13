import { describe, expect, it } from 'vitest'
import {
  blendQuality,
  camouflageVisibilityMultiplier,
  nextGamePhase,
  rgbMatchScore,
  updateTeacherState,
} from './schoolEscapeLogic'

describe('School Escape stealth logic', () => {
  it('scores an exact RGB wall match as fully blended', () => {
    expect(rgbMatchScore({ r: 72, g: 96, b: 124 }, { r: 72, g: 96, b: 124 })).toBe(1)
    expect(blendQuality(1)).toBe('blended')
  })

  it('classifies a large color mismatch as poor camouflage', () => {
    const score = rgbMatchScore({ r: 255, g: 0, b: 0 }, { r: 0, g: 255, b: 255 })
    expect(score).toBeLessThan(0.5)
    expect(blendQuality(score)).toBe('poor')
  })

  it('strongly reduces visibility only while still, grounded, and near a well-matched wall', () => {
    expect(
      camouflageVisibilityMultiplier({
        match: 0.96,
        wallDistance: 0.35,
        horizontalSpeed: 0.05,
        grounded: true,
      }),
    ).toBeLessThan(0.15)

    expect(
      camouflageVisibilityMultiplier({
        match: 0.96,
        wallDistance: 0.35,
        horizontalSpeed: 2.4,
        grounded: true,
      }),
    ).toBe(1)
  })

  it('moves from patrol through suspicion into chase as exposure persists', () => {
    const suspicious = updateTeacherState(
      { state: 'patrol', suspicion: 0, lostSightFor: 0, searchElapsed: 0 },
      { visibility: 0.5, hasLineOfSight: true, dt: 0.5 },
    )
    expect(suspicious.state).toBe('suspicious')

    const chasing = updateTeacherState(suspicious, {
      visibility: 0.85,
      hasLineOfSight: true,
      dt: 1,
    })
    expect(chasing.state).toBe('chase')
    expect(chasing.shout).toBe(true)
  })

  it('searches after losing sight during a chase and returns to patrol after five seconds', () => {
    const searching = updateTeacherState(
      { state: 'chase', suspicion: 1, lostSightFor: 0.8, searchElapsed: 0 },
      { visibility: 0, hasLineOfSight: false, dt: 0.6 },
    )
    expect(searching.state).toBe('search')

    const patrolling = updateTeacherState(searching, {
      visibility: 0,
      hasLineOfSight: false,
      dt: 5.1,
    })
    expect(patrolling.state).toBe('patrol')
  })

  it('transitions cleanly through exit, catch, and house game events', () => {
    expect(nextGamePhase('school', 'exit')).toBe('final-chase')
    expect(nextGamePhase('school', 'caught')).toBe('failed')
    expect(nextGamePhase('final-chase', 'caught')).toBe('failed')
    expect(nextGamePhase('final-chase', 'house')).toBe('won')
    expect(nextGamePhase('school', 'house')).toBe('school')
  })
})
