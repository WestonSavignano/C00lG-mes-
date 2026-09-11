import { useId } from 'react'
import type { GameDefinition } from '../catalog/gameTypes'
import GameTile from './GameTile'

type GameRailProps = {
  games: readonly GameDefinition[]
  title: string
}

function GameRail({ games, title }: GameRailProps) {
  const headingId = useId()

  return (
    <section aria-labelledby={headingId} className="game-rail">
      <header className="game-rail__header">
        <h2 id={headingId}>{title}</h2>
      </header>
      <div className="game-rail__track">
        {games.map((game) => (
          <GameTile game={game} key={game.id} />
        ))}
      </div>
    </section>
  )
}

export default GameRail
