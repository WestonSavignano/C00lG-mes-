import { describe, expect, it } from 'vitest'

const modulePath = './bodiIslandLogic'

async function loadLogic() {
  try {
    return await import(/* @vite-ignore */ modulePath)
  } catch {
    return null
  }
}

describe('Bodi Island progression', () => {
  it('collects Dark Fuzz only from Dark Matters and caps it at the boots requirement', async () => {
    const logic = await loadLogic()

    expect(logic).not.toBeNull()
    if (!logic) return

    expect(logic.collectDarkFuzz(0, 'shadow-bug', false)).toBe(0)
    expect(logic.collectDarkFuzz(0, 'dark-matter', false)).toBe(1)
    expect(logic.collectDarkFuzz(9, 'dark-matter', false)).toBe(10)
    expect(logic.collectDarkFuzz(10, 'dark-matter', false)).toBe(10)
    expect(logic.DARK_FUZZ_REQUIRED).toBe(10)
  })

  it('stops Dark Fuzz drops once the Shadow Boots have been crafted', async () => {
    const logic = await loadLogic()

    expect(logic).not.toBeNull()
    if (!logic) return

    expect(logic.collectDarkFuzz(0, 'dark-matter', true)).toBe(0)
  })

  it('allows Blaze to craft Shadow Boots once Bodi has 10 Dark Fuzz', async () => {
    const logic = await loadLogic()

    expect(logic).not.toBeNull()
    if (!logic) return

    expect(logic.canCraftShadowBoots({ darkFuzz: 9, hasShadowBoots: false })).toBe(false)
    expect(logic.canCraftShadowBoots({ darkFuzz: 10, hasShadowBoots: false })).toBe(true)
    expect(logic.canCraftShadowBoots({ darkFuzz: 10, hasShadowBoots: true })).toBe(false)

    expect(logic.craftShadowBoots({ darkFuzz: 10, hasShadowBoots: false })).toEqual({
      darkFuzz: 0,
      hasShadowBoots: true,
    })
  })

  it('keeps shadow ground blocked until the boots are crafted', async () => {
    const logic = await loadLogic()

    expect(logic).not.toBeNull()
    if (!logic) return

    expect(logic.canCrossShadowGround(false)).toBe(false)
    expect(logic.canCrossShadowGround(true)).toBe(true)
  })

  it('makes Bodi faster while wearing Shadow Boots', async () => {
    const logic = await loadLogic()

    expect(logic).not.toBeNull()
    if (!logic) return

    expect(logic.movementSpeed(true)).toBeGreaterThan(logic.movementSpeed(false))
  })
})
