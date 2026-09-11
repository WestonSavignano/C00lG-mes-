import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  readRecentGameIds,
  recordRecentGame,
  resolveRecentGames,
} from './recentGames'

const storageKey = 'coolgames.recent-games.v1'

describe('recent games', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps the most recent four games in most-recent-first order', () => {
    recordRecentGame('plane-blaster')
    recordRecentGame('donut-run')
    recordRecentGame('neon-drift')
    recordRecentGame('warrior')
    recordRecentGame('warrior2')

    expect(readRecentGameIds()).toEqual([
      'warrior2',
      'warrior',
      'neon-drift',
      'donut-run',
    ])
  })

  it('moves a replayed game to the front without duplicating it', () => {
    recordRecentGame('warrior')
    recordRecentGame('neon-drift')
    recordRecentGame('warrior')

    expect(readRecentGameIds()).toEqual(['warrior', 'neon-drift'])
  })

  it('falls back safely when stored data is corrupt', () => {
    localStorage.setItem(storageKey, '{broken json')

    expect(readRecentGameIds()).toEqual([])
    expect(resolveRecentGames()).toEqual([])
  })

  it('ignores stale ids when resolving catalog entries', () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify(['not-a-game', 'neon-drift', 'warrior']),
    )

    expect(resolveRecentGames().map((game) => game.id)).toEqual([
      'neon-drift',
      'warrior',
    ])
  })

  it('does not break gameplay when browser storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked')
    })

    expect(() => recordRecentGame('warrior')).not.toThrow()
    expect(readRecentGameIds()).toEqual([])
  })
})
