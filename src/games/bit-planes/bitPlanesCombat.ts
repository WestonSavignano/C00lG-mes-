export type CombatStats = {
  lives: number
  score: number
}

export const BIT_PLANES_COMBAT = {
  enemyFireDelayMs: 1250,
  enemyScore: 100,
  enemySpawnDelayMs: 1200,
  initialLives: 3,
  maxEnemies: 5,
  playerHitCooldownMs: 900,
} as const

export const GAME_OVER_RESTART_PROMPT = 'Game Over\nClick or press R to restart'

const ENEMY_LANE_COUNT = 4

export function createInitialCombatStats(): CombatStats {
  return {
    lives: BIT_PLANES_COMBAT.initialLives,
    score: 0,
  }
}

export function destroyEnemy(stats: CombatStats): CombatStats {
  return {
    ...stats,
    score: stats.score + BIT_PLANES_COMBAT.enemyScore,
  }
}

export function damagePlayer(stats: CombatStats): CombatStats {
  return {
    ...stats,
    lives: Math.max(0, stats.lives - 1),
  }
}

export function isGameOver(stats: CombatStats) {
  return stats.lives <= 0
}

export function getEnemySpawnLane(playfieldHeight: number, spawnIndex: number) {
  const topSafeArea = Math.round(playfieldHeight * 0.237)
  const bottomSafeArea = Math.round(playfieldHeight * 0.202)
  const laneIndex = spawnIndex % ENEMY_LANE_COUNT
  const laneSpacing =
    (playfieldHeight - topSafeArea - bottomSafeArea) / (ENEMY_LANE_COUNT - 1)

  return Math.round(topSafeArea + laneSpacing * laneIndex)
}
