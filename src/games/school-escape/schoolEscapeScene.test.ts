import { describe, expect, it } from 'vitest'
import {
  PLAYER_SPRINT_SPEED,
  TEACHER_CHASE_SPEED,
  createInitialSceneState,
  resolveScenePhase,
} from './schoolEscapeScene'
import { HOUSE_TRIGGER, SCHOOL_EXIT } from './schoolEscapeLevel'

describe('School Escape scene state', () => {
  it('keeps a clean sprint slightly faster than the chasing teacher', () => {
    expect(PLAYER_SPRINT_SPEED).toBeGreaterThan(TEACHER_CHASE_SPEED)
    expect(PLAYER_SPRINT_SPEED - TEACHER_CHASE_SPEED).toBeLessThan(1)
  })

  it('starts the outdoor finale only when the school exit is reached during school play', () => {
    expect(
      resolveScenePhase('school', SCHOOL_EXIT, { x: -8, z: -8 }),
    ).toBe('final-chase')
    expect(
      resolveScenePhase('final-chase', SCHOOL_EXIT, { x: -8, z: -8 }),
    ).toBe('final-chase')
  })

  it('fails when the teacher reaches catch radius', () => {
    expect(
      resolveScenePhase('school', { x: 1, z: 1 }, { x: 1.4, z: 1.2 }),
    ).toBe('failed')
  })

  it('wins when the player reaches home during the final chase', () => {
    expect(
      resolveScenePhase('final-chase', HOUSE_TRIGGER, { x: 8, z: 39 }),
    ).toBe('won')
  })

  it('recreates a clean run with patrol state and default camouflage', () => {
    const state = createInitialSceneState()
    expect(state.phase).toBe('school')
    expect(state.teacher.mode.state).toBe('patrol')
    expect(state.teacher.mode.suspicion).toBe(0)
    expect(state.camouflage).toEqual({ r: 30, g: 30, b: 34 })
    expect(state.player.x).not.toBe(state.teacher.x)
  })
})
