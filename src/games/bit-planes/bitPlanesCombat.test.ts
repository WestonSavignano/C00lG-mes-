import { describe, expect, it } from 'vitest'
import {
  BIT_PLANES_COMBAT,
  createInitialCombatStats,
  damagePlayer,
  destroyEnemy,
  GAME_OVER_RESTART_PROMPT,
  getEnemySpawnLane,
  isGameOver,
} from './bitPlanesCombat'

describe('bitPlanesCombat', () => {
  it('scores enemy defeats and tracks player lives', () => {
    const startingStats = createInitialCombatStats()

    expect(destroyEnemy(startingStats)).toEqual({
      lives: 3,
      score: 100,
    })
    expect(damagePlayer(startingStats)).toEqual({
      lives: 2,
      score: 0,
    })
    expect(damagePlayer({ lives: 0, score: 300 })).toEqual({
      lives: 0,
      score: 300,
    })
  })

  it('defines the game-over restart state', () => {
    expect(createInitialCombatStats()).toEqual({
      lives: BIT_PLANES_COMBAT.initialLives,
      score: 0,
    })
    expect(isGameOver({ lives: 0, score: 500 })).toBe(true)
    expect(isGameOver(createInitialCombatStats())).toBe(false)
    expect(GAME_OVER_RESTART_PROMPT).toContain('restart')
  })

  it('spawns enemies in repeatable vertical lanes inside the playfield', () => {
    expect(getEnemySpawnLane(540, 0)).toBe(128)
    expect(getEnemySpawnLane(540, 1)).toBe(229)
    expect(getEnemySpawnLane(540, 2)).toBe(330)
    expect(getEnemySpawnLane(540, 3)).toBe(431)
    expect(getEnemySpawnLane(540, 4)).toBe(128)
  })
})
