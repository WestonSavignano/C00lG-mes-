import { describe, expect, it } from 'vitest'
import { featuredGame, gameCatalog, getGameByRoute } from './gameCatalog'

describe('game catalog', () => {
  it('registers each current game exactly once with unique ids and routes', () => {
    expect(gameCatalog).toHaveLength(7)
    expect(new Set(gameCatalog.map((game) => game.id)).size).toBe(gameCatalog.length)
    expect(new Set(gameCatalog.map((game) => game.route)).size).toBe(gameCatalog.length)
    expect(gameCatalog.every((game) => game.route === game.route.trim())).toBe(true)
  })

  it('defines one featured game and resolves games by route', () => {
    expect(gameCatalog.filter((game) => game.featured)).toHaveLength(1)
    expect(featuredGame.title).toBe('Neon Drift')
    expect(getGameByRoute('/games/neon-drift')?.id).toBe('neon-drift')
    expect(getGameByRoute('/games/monster-color-rush')?.id).toBe(
      'monster-color-rush',
    )
    expect(getGameByRoute('/games/not-real')).toBeUndefined()
  })

  it('gives Monster Color Rush distinct discovery artwork', () => {
    expect(getGameByRoute('/games/neon-drift')?.artwork.theme).toBe('neon')
    expect(getGameByRoute('/games/monster-color-rush')?.artwork.theme).toBe(
      'color-rush',
    )
  })

  it('advertises touch and keyboard for migrated semantic-input games', () => {
    expect(getGameByRoute('/games/donut-run')?.inputs).toEqual([
      'touch',
      'keyboard',
    ])
    expect(getGameByRoute('/games/neon-drift')?.inputs).toEqual([
      'touch',
      'keyboard',
    ])
    expect(getGameByRoute('/games/monster-color-rush')?.inputs).toEqual([
      'touch',
      'keyboard',
    ])
  })
})
