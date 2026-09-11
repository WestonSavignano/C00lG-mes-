import { Link } from 'react-router-dom'
import type { GameDefinition } from '../catalog/gameTypes'
import GameArtwork from './GameArtwork'
import './GameTile.css'

type GameTileProps = {
  game: GameDefinition
}

function GameTile({ game }: GameTileProps) {
  return (
    <article className="game-tile" data-testid="game-tile">
      <Link
        aria-label={`Play ${game.title}`}
        className="game-tile__link"
        to={game.route}
      >
        <GameArtwork game={game} />
        <div className="game-tile__body">
          <div className="game-tile__meta">
            <span>{game.category}</span>
            <span className="game-tile__badges" aria-hidden="true">
              {game.new ? <span className="game-badge">New</span> : null}
              {game.multiplayer ? <span className="game-badge">Multi</span> : null}
            </span>
          </div>
          <h3>{game.title}</h3>
        </div>
      </Link>
    </article>
  )
}

export default GameTile
