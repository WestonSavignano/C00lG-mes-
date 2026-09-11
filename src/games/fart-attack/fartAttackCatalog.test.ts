import { describe, expect, it } from 'vitest'
import { gameCatalog } from '../catalog/gameCatalog'

describe('Fart Attack catalog registration', () => {
  it('registers Fart Attack as a keyboard and touch landscape game', () => {
    const game = gameCatalog.find((entry) => entry.id === 'fart-attack')

    expect(game).toMatchObject({
      route: '/games/fart-attack',
      title: 'Fart Attack',
      orientation: 'landscape',
    })
    expect(game?.inputs).toEqual(expect.arrayContaining(['keyboard', 'touch']))
  })
})
