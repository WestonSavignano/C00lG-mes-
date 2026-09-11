import { lazy, Suspense, type ReactNode } from 'react'
import { gameCatalog } from './gameCatalog'
import type { GameDefinition } from './gameTypes'

type GameRouteEntry = {
  game: GameDefinition
  path: GameDefinition['route']
  element: ReactNode
}

function GameRouteLoading({ title }: { title: string }) {
  return (
    <main className="game-route-loading" aria-live="polite">
      <div className="game-route-loading__panel" role="status">
        <span className="game-route-loading__pulse" aria-hidden="true" />
        <span>Loading {title}…</span>
      </div>
    </main>
  )
}

export const gameRouteEntries: readonly GameRouteEntry[] = gameCatalog.map((game) => {
  const GamePage = lazy(game.loadPage)

  return {
    game,
    path: game.route,
    element: (
      <Suspense fallback={<GameRouteLoading title={game.title} />}>
        <GamePage />
      </Suspense>
    ),
  }
})
