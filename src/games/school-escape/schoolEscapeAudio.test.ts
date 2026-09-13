import { describe, expect, it } from 'vitest'
import {
  footstepCadence,
  soundProfile,
  teacherStateCue,
} from './schoolEscapeAudio'

describe('School Escape audio cues', () => {
  it('uses quicker footsteps during a chase', () => {
    expect(footstepCadence('chase')).toBeLessThan(footstepCadence('patrol'))
    expect(footstepCadence('search')).toBeGreaterThan(footstepCadence('chase'))
  })

  it('fires the chase cue only when entering chase', () => {
    expect(teacherStateCue('patrol', 'chase')).toBe('detection')
    expect(teacherStateCue('chase', 'chase')).toBeNull()
    expect(teacherStateCue('search', 'patrol')).toBeNull()
  })

  it('defines bounded procedural profiles for the required school cues', () => {
    for (const cue of ['teacher-step', 'door', 'mutter', 'detection', 'win', 'fail'] as const) {
      const profile = soundProfile(cue)
      expect(profile.duration).toBeGreaterThan(0)
      expect(profile.duration).toBeLessThanOrEqual(0.5)
      expect(profile.gain).toBeGreaterThan(0)
      expect(profile.gain).toBeLessThanOrEqual(0.18)
    }
  })
})
