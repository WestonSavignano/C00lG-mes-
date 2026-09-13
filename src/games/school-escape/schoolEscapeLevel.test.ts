import { describe, expect, it } from 'vitest'
import {
  HOUSE_TRIGGER,
  SCHOOL_EXIT,
  SCHOOL_START,
  WALLS,
  hasLineOfSight,
  nearestCamouflageWall,
  resolveCircleAgainstWalls,
} from './schoolEscapeLevel'

describe('School Escape fixed level', () => {
  it('keeps the start, school exit, and house meaningfully separated', () => {
    expect(Math.hypot(SCHOOL_EXIT.x - SCHOOL_START.x, SCHOOL_EXIT.z - SCHOOL_START.z)).toBeGreaterThan(15)
    expect(HOUSE_TRIGGER.z).toBeGreaterThan(SCHOOL_EXIT.z + 10)
  })

  it('resolves a player circle out of solid wall geometry', () => {
    const wall = WALLS[0]!
    const inside = { x: wall.x, z: wall.z }
    const resolved = resolveCircleAgainstWalls(inside, 0.45, [wall])
    const halfWidth = wall.width / 2 + 0.45
    const halfDepth = wall.depth / 2 + 0.45

    expect(
      Math.abs(resolved.x - wall.x) >= halfWidth ||
      Math.abs(resolved.z - wall.z) >= halfDepth,
    ).toBe(true)
  })

  it('blocks teacher line of sight when a wall sits between two points', () => {
    const blocker = { id: 'blocker', x: 0, z: 0, width: 2, depth: 6, height: 3, color: { r: 80, g: 90, b: 100 }, camouflage: true }
    expect(hasLineOfSight({ x: -4, z: 0 }, { x: 4, z: 0 }, [blocker])).toBe(false)
    expect(hasLineOfSight({ x: -4, z: 5 }, { x: 4, z: 5 }, [blocker])).toBe(true)
  })

  it('returns the nearest camouflage wall with its color and distance', () => {
    const sampleWalls = [
      { id: 'far', x: 5, z: 0, width: 1, depth: 4, height: 3, color: { r: 20, g: 30, b: 40 }, camouflage: true },
      { id: 'near', x: 1, z: 0, width: 1, depth: 4, height: 3, color: { r: 100, g: 110, b: 120 }, camouflage: true },
    ]
    const result = nearestCamouflageWall({ x: 0, z: 0 }, sampleWalls)

    expect(result?.wall.id).toBe('near')
    expect(result?.wall.color).toEqual({ r: 100, g: 110, b: 120 })
    expect(result?.distance).toBeCloseTo(0.5)
  })
})
