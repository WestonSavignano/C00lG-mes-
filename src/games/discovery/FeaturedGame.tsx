import { Play } from 'lucide-react'
import { useId } from 'react'
import { Link } from 'react-router-dom'
import type { GameDefinition } from '../catalog/gameTypes'
import GameArtwork from './GameArtwork'
import './FeaturedGame.css'

type FeaturedGameProps = {
  game: GameDefinition
}

function FeaturedGame({ game }: FeaturedGameProps) {
  const headingId = useId()

  return (
    <section aria-labelledby={headingId} className="featured-game">
      <GameArtwork game={game} />
      <div className="featured-game__content">
        <p className="featured-game__eyebrow">
          Featured · {game.category}
        </p>
        <h2 id={headingId}>{game.title}</h2>
        <p className="featured-game__description">{game.shortDescription}</p>
        <div className="featured-game__actions">
          <Link
            aria-label={`Play ${game.title}`}
            className="arcade-button"
            to={game.route}
          >
            <Play aria-hidden="true" size={17} fill="currentColor" />
            <span>Play now</span>
          </Link>
        </div>
      </div>
    </section>
  )
}

export default FeaturedGame
