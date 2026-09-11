import { gameCatalog } from '../catalog/gameCatalog'
import type { GameDefinition } from '../catalog/gameTypes'

const RECENT_GAMES_KEY = 'coolgames.recent-games.v1'
const MAX_RECENT_GAMES = 4

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function readRecentGameIds(): string[] {
  const storage = getStorage()

  if (!storage) {
    return []
  }

  try {
    const stored = storage.getItem(RECENT_GAMES_KEY)

    if (!stored) {
      return []
    }

    const parsed: unknown = JSON.parse(stored)

    if (!Array.isArray(parsed)) {
      return []
    }

    return [...new Set(parsed.filter((value): value is string => typeof value === 'string'))]
      .slice(0, MAX_RECENT_GAMES)
  } catch {
    return []
  }
}

export function recordRecentGame(gameId: string): void {
  const storage = getStorage()

  if (!storage) {
    return
  }

  const nextIds = [
    gameId,
    ...readRecentGameIds().filter((storedId) => storedId !== gameId),
  ].slice(0, MAX_RECENT_GAMES)

  try {
    storage.setItem(RECENT_GAMES_KEY, JSON.stringify(nextIds))
  } catch {
    // Recent-play history is optional convenience state.
  }
}

export function resolveRecentGames(): GameDefinition[] {
  return readRecentGameIds()
    .map((gameId) => gameCatalog.find((game) => game.id === gameId))
    .filter((game): game is GameDefinition => game !== undefined)
}
