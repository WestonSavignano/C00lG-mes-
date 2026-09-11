import { describe, expect, it } from 'vitest'

const modulePath = './bodiIslandScene'

async function loadSceneModule() {
  try {
    return await import(/* @vite-ignore */ modulePath)
  } catch {
    return null
  }
}

describe('Bodi Island forest scene', () => {
  it('provides enough Dark Matters to earn the first Shadow Boots', async () => {
    const scene = await loadSceneModule()

    expect(scene).not.toBeNull()
    if (!scene) return

    const darkMatters = scene.FOREST_ENEMY_SPAWNS.filter(
      (spawn: { kind: string }) => spawn.kind === 'dark-matter',
    )
    const shadowBugs = scene.FOREST_ENEMY_SPAWNS.filter(
      (spawn: { kind: string }) => spawn.kind === 'shadow-bug',
    )

    expect(darkMatters.length).toBeGreaterThanOrEqual(10)
    expect(shadowBugs.length).toBeGreaterThanOrEqual(1)
  })

  it('defeats a Shadow Bug in one sword hit without a drop', async () => {
    const scene = await loadSceneModule()

    expect(scene).not.toBeNull()
    if (!scene) return

    const result = scene.applyEnemyHit({ kind: 'shadow-bug', health: 1 })

    expect(result).toEqual({
      enemy: { kind: 'shadow-bug', health: 0 },
      defeated: true,
      drop: null,
    })
  })

  it('requires two sword hits for a Dark Matter and drops Dark Fuzz', async () => {
    const scene = await loadSceneModule()

    expect(scene).not.toBeNull()
    if (!scene) return

    const first = scene.applyEnemyHit({ kind: 'dark-matter', health: 2 })
    const second = scene.applyEnemyHit(first.enemy)

    expect(first.defeated).toBe(false)
    expect(first.drop).toBeNull()
    expect(second).toEqual({
      enemy: { kind: 'dark-matter', health: 0 },
      defeated: true,
      drop: 'dark-fuzz',
    })
  })

  it('keeps forest coordinates inside the intended bounded play space', async () => {
    const scene = await loadSceneModule()

    expect(scene).not.toBeNull()
    if (!scene) return

    for (const spawn of scene.FOREST_ENEMY_SPAWNS) {
      expect(Math.abs(spawn.x)).toBeLessThanOrEqual(scene.FOREST_HALF_WIDTH)
      expect(spawn.z).toBeGreaterThanOrEqual(scene.FOREST_START_Z)
      expect(spawn.z).toBeLessThanOrEqual(scene.FOREST_END_Z)
    }
  })
})
