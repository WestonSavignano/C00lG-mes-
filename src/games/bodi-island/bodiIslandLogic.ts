export const DARK_FUZZ_REQUIRED = 10

export type EnemyKind = 'shadow-bug' | 'dark-matter'

export type ProgressionState = {
  darkFuzz: number
  hasShadowBoots: boolean
}

export function collectDarkFuzz(
  current: number,
  enemyKind: EnemyKind,
  hasShadowBoots: boolean,
) {
  if (enemyKind !== 'dark-matter' || hasShadowBoots) {
    return current
  }

  return Math.min(DARK_FUZZ_REQUIRED, current + 1)
}

export function canCraftShadowBoots(state: ProgressionState) {
  return !state.hasShadowBoots && state.darkFuzz >= DARK_FUZZ_REQUIRED
}

export function craftShadowBoots(state: ProgressionState): ProgressionState {
  if (!canCraftShadowBoots(state)) {
    return state
  }

  return {
    darkFuzz: 0,
    hasShadowBoots: true,
  }
}

export function canCrossShadowGround(hasShadowBoots: boolean) {
  return hasShadowBoots
}

export function movementSpeed(hasShadowBoots: boolean) {
  return hasShadowBoots ? 7.4 : 5.2
}
