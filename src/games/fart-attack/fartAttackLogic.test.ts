import { describe, expect, it } from 'vitest'
import {
  BOSS_REWARD,
  ENEMY_REWARD,
  SHOP_DURATION_MS,
  SHOP_ITEM_COST,
  applyDamage,
  buyArmor,
  createInitialProgress,
} from './fartAttackLogic'

describe('Fart Attack progression helpers', () => {
  it('uses the approved enemy and boss coin rewards', () => {
    expect(ENEMY_REWARD).toBe(50)
    expect(BOSS_REWARD).toBe(100)
  })

  it('uses a ten-second intermission and 500-coin shop items', () => {
    expect(SHOP_DURATION_MS).toBe(10_000)
    expect(SHOP_ITEM_COST).toBe(500)
  })

  it('equips one armor item for 20% damage reduction', () => {
    const result = buyArmor(createInitialProgress(500), 'gas-mask')

    expect(result.coins).toBe(0)
    expect(result.ownedArmor).toEqual(['gas-mask'])
    expect(result.damageReduction).toBeCloseTo(0.2)
  })

  it('stacks all three armor items to 60% damage reduction', () => {
    const start = createInitialProgress(1_500)
    const withMask = buyArmor(start, 'gas-mask')
    const withSuit = buyArmor(withMask, 'hazmat-suit')
    const withPants = buyArmor(withSuit, 'hazmat-pants')

    expect(withPants.coins).toBe(0)
    expect(withPants.ownedArmor).toEqual([
      'gas-mask',
      'hazmat-suit',
      'hazmat-pants',
    ])
    expect(withPants.damageReduction).toBeCloseTo(0.6)
  })

  it('does not spend coins when an item is already owned or unaffordable', () => {
    const owned = buyArmor(createInitialProgress(500), 'gas-mask')
    expect(buyArmor(owned, 'gas-mask')).toEqual(owned)

    const poor = createInitialProgress(499)
    expect(buyArmor(poor, 'hazmat-suit')).toEqual(poor)
  })

  it('reduces incoming damage without producing negative health', () => {
    expect(applyDamage(100, 25, 0.2)).toBe(80)
    expect(applyDamage(10, 100, 0.6)).toBe(0)
  })
})
