import type { GameDefinition } from '../catalog/gameTypes'
import './GameArtwork.css'

type GameArtworkProps = {
  game: GameDefinition
}

function GameArtwork({ game }: GameArtworkProps) {
  return (
    <div
      aria-hidden="true"
      className={`game-artwork game-artwork--${game.artwork.theme}`}
      data-artwork-theme={game.artwork.theme}
    >
      <span className="game-artwork__atmosphere" />
      <span className="game-artwork__horizon" />
      <span className="game-artwork__subject" />
      <span className="game-artwork__accent" />
    </div>
  )
}

export default GameArtwork
