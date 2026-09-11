import { describe, expect, it } from 'vitest'
import { featuredGame, gameCatalog, getGameByRoute } from './gameCatalog'

describe('game catalog', () => {
  it('registers each current game exactly once with unique ids and routes', () => {
    expect(gameCatalog).toHaveLength(6)
    expect(new Set(gameCatalog.map((game) => game.id)).size).toBe(gameCatalog.length)
    expect(new Set(gameCatalog.map((game) => game.route)).size).toBe(gameCatalog.length)
    expect(gameCatalog.every((game) => game.route === game.route.trim())).toBe(true)
  })

  it('defines one featured game and resolves games by route', () => {
    expect(gameCatalog.filter((game) => game.featured)).toHaveLength(1)
    expect(featuredGame.title).toBe('Neon Drift')
    expect(getGameByRoute('/games/neon-drift')?.id).toBe('neon-drift')
    expect(getGameByRoute('/games/not-real')).toBeUndefined()
  })
})
