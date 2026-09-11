import type { GameDefinition } from '../catalog/gameTypes'
import GameTile from './GameTile'

type GameGridProps = {
  games: readonly GameDefinition[]
}

function GameGrid({ games }: GameGridProps) {
  return (
    <div className="game-grid">
      {games.map((game) => (
        <GameTile game={game} key={game.id} />
      ))}
    </div>
  )
}

export default GameGrid
