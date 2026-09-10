export type Point = {
  x: number
  y: number
}

export type IdentifiedPoint = Point & {
  id: number
}

export const NEON_DRIFT_RULES = {
  maxMultiplier: 6,
  maxTurrets: 5,
  turretAggroRange: 380,
  turretDamagePerHit: 28,
} as const

export function nearestWithinRange<T extends Point>(
  origin: Point,
  candidates: readonly T[],
  range: number,
): T | null {
  let nearest: T | null = null
  let nearestDistanceSquared = range * range

  for (const candidate of candidates) {
    const dx = candidate.x - origin.x
    const dy = candidate.y - origin.y
    const distanceSquared = dx * dx + dy * dy

    if (distanceSquared < nearestDistanceSquared) {
      nearest = candidate
      nearestDistanceSquared = distanceSquared
    }
  }

  return nearest
}

export function increaseMultiplier(current: number, amount: number): number {
  return Math.min(NEON_DRIFT_RULES.maxMultiplier, current + amount)
}

export function damageTurret(currentHealth: number, damage: number): number {
  return Math.max(0, currentHealth - damage)
}
