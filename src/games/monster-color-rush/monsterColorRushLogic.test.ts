import { describe, expect, it } from 'vitest'
import {
  HAZARD_COUNT,
  REQUIRED_MATCH_COUNT,
  REST_DURATION_SECONDS,
  WAVE_DURATION_SECONDS,
  createWaveObjects,
  getMonsterColorIndex,
  selectFarthestSpawn,
} from './monsterColorRushLogic'

describe('Monster Color Rush logic', () => {
  it('uses the approved round and rest durations', () => {
    expect(WAVE_DURATION_SECONDS).toBe(45)
    expect(REST_DURATION_SECONDS).toBe(7)
  })

  it('rotates monster color across the six-color palette', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(getMonsterColorIndex)).toEqual([
      1, 2, 3, 4, 5, 0, 1,
    ])
  })

  it('creates exactly six matching targets and fourteen wrong-color hazards', () => {
    const monsterColorIndex = 4
    const objects = createWaveObjects({
      monsterColorIndex,
      minX: 80,
      maxX: 720,
      minY: 120,
      maxY: 420,
      random: () => 0.5,
    })

    const required = objects.filter((object) => object.required)
    const hazards = objects.filter((object) => !object.required)

    expect(required).toHaveLength(REQUIRED_MATCH_COUNT)
    expect(hazards).toHaveLength(HAZARD_COUNT)
    expect(required.every((object) => object.colorIndex === monsterColorIndex)).toBe(true)
    expect(hazards.every((object) => object.colorIndex !== monsterColorIndex)).toBe(true)
  })

  it('selects the valid corner farthest from the player', () => {
    expect(
      selectFarthestSpawn(
        { x: 120, y: 120 },
        [
          { x: 80, y: 100 },
          { x: 720, y: 100 },
          { x: 80, y: 420 },
          { x: 720, y: 420 },
        ],
      ),
    ).toEqual({ x: 720, y: 420 })
  })

  it('uses the supplied random source only to break exact farthest-corner ties', () => {
    const candidates = [
      { x: 80, y: 100 },
      { x: 720, y: 100 },
      { x: 80, y: 420 },
      { x: 720, y: 420 },
    ]

    expect(selectFarthestSpawn({ x: 400, y: 260 }, candidates, () => 0)).toEqual(
      candidates[0],
    )
    expect(
      selectFarthestSpawn({ x: 400, y: 260 }, candidates, () => 0.99),
    ).toEqual(candidates[3])
  })
})
