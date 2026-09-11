import type { GameDefinition } from '../catalog/gameTypes'
import './GameRouteLoading.css'

type GameRouteLoadingProps = {
  game: GameDefinition
}

function GameRouteLoading({ game }: GameRouteLoadingProps) {
  return (
    <div className="game-route-loading" aria-live="polite">
      <div className="game-route-loading__panel" role="status">
        <span aria-hidden="true" className="game-route-loading__pulse" />
        <span>Loading {game.title}…</span>
      </div>
    </div>
  )
}

export default GameRouteLoading
