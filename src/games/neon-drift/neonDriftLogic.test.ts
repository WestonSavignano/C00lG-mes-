import { describe, expect, it } from 'vitest'
import {
  damageTurret,
  increaseMultiplier,
  nearestWithinRange,
} from './neonDriftLogic'

describe('Neon Drift combat helpers', () => {
  it('selects the nearest target inside the requested range', () => {
    const target = nearestWithinRange(
      { x: 0, y: 0 },
      [
        { id: 1, x: 90, y: 0 },
        { id: 2, x: 25, y: 0 },
        { id: 3, x: 400, y: 0 },
      ],
      120,
    )

    expect(target?.id).toBe(2)
  })

  it('returns no target when every candidate is out of range', () => {
    expect(
      nearestWithinRange({ x: 0, y: 0 }, [{ id: 1, x: 121, y: 0 }], 120),
    ).toBeNull()
  })

  it('caps score multiplier growth at the game maximum', () => {
    expect(increaseMultiplier(5.9, 0.25)).toBe(6)
  })

  it('never lets turret health go below zero', () => {
    expect(damageTurret(12, 28)).toBe(0)
  })
})
