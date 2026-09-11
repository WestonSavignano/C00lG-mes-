import { lazy, Suspense, type ReactNode } from 'react'
import GamePageShell from '../shared/GamePageShell'
import GameRouteLoading from '../shared/GameRouteLoading'
import GameRuntimeErrorBoundary from '../shared/GameRuntimeErrorBoundary'
import { gameCatalog } from './gameCatalog'
import type { GameDefinition } from './gameTypes'

type GameRouteEntry = {
  game: GameDefinition
  path: GameDefinition['route']
  element: ReactNode
}

export const gameRouteEntries: readonly GameRouteEntry[] = gameCatalog.map((game) => {
  const GamePage = lazy(game.loadPage)

  return {
    game,
    path: game.route,
    element: (
      <GamePageShell game={game}>
        <GameRuntimeErrorBoundary game={game}>
          <Suspense fallback={<GameRouteLoading game={game} />}>
            <GamePage />
          </Suspense>
        </GameRuntimeErrorBoundary>
      </GamePageShell>
    ),
  }
})
