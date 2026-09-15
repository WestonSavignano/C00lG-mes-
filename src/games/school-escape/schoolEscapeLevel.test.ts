import { describe, expect, it } from 'vitest'
import {
  GOLDEN_SLICE_LEVEL,
  crossedNearMissTrigger,
  hasLineOfSight,
  isInsideCompletionTrigger,
  nearestHideSurface,
  resolvePlayerCollision,
} from './schoolEscapeLevel'

describe('School Escape golden-slice level geometry', () => {
  it('keeps the player spawn clear and the classroom doorway traversable', () => {
    expect(resolvePlayerCollision(GOLDEN_SLICE_LEVEL.playerSpawn)).toEqual(
      GOLDEN_SLICE_LEVEL.playerSpawn,
    )

    const doorway = { x: 0, y: 0, z: 4.05 }
    expect(resolvePlayerCollision(doorway)).toEqual(doorway)
  })

  it('keeps the player out of hallway walls with the gameplay collision radius', () => {
    const resolved = resolvePlayerCollision({ x: 1.3, y: 0, z: 8 })

    expect(resolved.x).toBeLessThanOrEqual(1.1)
    expect(resolved.y).toBe(0)
    expect(resolved.z).toBe(8)
  })

  it('keeps authored teacher traversal segments unobstructed', () => {
    const points = GOLDEN_SLICE_LEVEL.teacherPatrolPoints

    for (let index = 1; index < points.length; index += 1) {
      expect(hasLineOfSight(points[index - 1], points[index])).toBe(true)
    }
  })

  it('uses the same wall geometry to block LOS while leaving open corridors visible', () => {
    expect(
      hasLineOfSight(
        { x: 0, y: 1.2, z: 9 },
        { x: -3, y: 1.2, z: 9 },
      ),
    ).toBe(false)

    expect(
      hasLineOfSight(
        { x: -6.5, y: 1.2, z: 20 },
        { x: 6.5, y: 1.2, z: 20 },
      ),
    ).toBe(true)
  })

  it('returns the blue locker hide surface only inside its cover distance', () => {
    expect(
      nearestHideSurface({ x: 4.8, y: 0, z: 14.7 })?.id,
    ).toBe('locker-blue')
    expect(nearestHideSurface({ x: 4.5, y: 0, z: 14.7 })).toBeNull()
  })

  it('defines the near-miss lesson before the completion zone', () => {
    expect(crossedNearMissTrigger(7.8, 8.1)).toBe(true)
    expect(crossedNearMissTrigger(8.1, 8.4)).toBe(false)

    expect(GOLDEN_SLICE_LEVEL.completionTrigger.minZ).toBeGreaterThan(
      GOLDEN_SLICE_LEVEL.nearMissTriggerZ,
    )
    expect(
      isInsideCompletionTrigger({ x: 3.2, y: 0, z: 17.7 }),
    ).toBe(true)
    expect(
      isInsideCompletionTrigger({ x: 0, y: 0, z: 17.7 }),
    ).toBe(false)
  })
})
