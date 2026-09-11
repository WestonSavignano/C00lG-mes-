export const ENEMY_REWARD = 50
export const BOSS_REWARD = 100
export const SHOP_DURATION_MS = 10_000
export const SHOP_ITEM_COST = 500
export const ARMOR_DAMAGE_REDUCTION = 0.2

export type ArmorId = 'gas-mask' | 'hazmat-suit' | 'hazmat-pants'

export type FartAttackProgress = {
  coins: number
  ownedArmor: ArmorId[]
  damageReduction: number
}

export function createInitialProgress(coins = 0): FartAttackProgress {
  return {
    coins,
    ownedArmor: [],
    damageReduction: 0,
  }
}

export function buyArmor(
  progress: FartAttackProgress,
  armorId: ArmorId,
): FartAttackProgress {
  if (
    progress.coins < SHOP_ITEM_COST ||
    progress.ownedArmor.includes(armorId)
  ) {
    return progress
  }

  const ownedArmor = [...progress.ownedArmor, armorId]

  return {
    coins: progress.coins - SHOP_ITEM_COST,
    ownedArmor,
    damageReduction: Math.min(
      0.6,
      ownedArmor.length * ARMOR_DAMAGE_REDUCTION,
    ),
  }
}

export function applyDamage(
  health: number,
  incomingDamage: number,
  damageReduction: number,
): number {
  const clampedReduction = Math.max(0, Math.min(1, damageReduction))
  return Math.max(0, health - incomingDamage * (1 - clampedReduction))
}
