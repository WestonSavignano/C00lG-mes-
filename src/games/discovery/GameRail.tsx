import { useId } from 'react'
import type { GameDefinition } from '../catalog/gameTypes'
import GameTile from './GameTile'
import './GameRail.css'

type GameRailProps = {
  games: readonly GameDefinition[]
  title: string
}

function GameRail({ games, title }: GameRailProps) {
  const headingId = useId()

  return (
    <section aria-labelledby={headingId} className="game-rail">
      <div className="game-rail__header">
        <h2 id={headingId}>{title}</h2>
      </div>
      <div className="game-rail__track">
        {games.map((game) => (
          <GameTile game={game} key={game.id} />
        ))}
      </div>
    </section>
  )
}

export default GameRail
