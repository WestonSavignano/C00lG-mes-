import { describe, expect, it } from 'vitest'
import { gameCatalog } from './gameCatalog'
import { gameRouteEntries } from './gameRoutes'

describe('game route entries', () => {
  it('derives every game route from the catalog', () => {
    expect(gameRouteEntries.map((entry) => entry.path)).toEqual(
      gameCatalog.map((game) => game.route),
    )
  })
})
