import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { GameDefinition } from '../catalog/gameTypes'
import GameOrientationNotice from './GameOrientationNotice'
import './GamePageShell.css'

type GamePageShellProps = {
  children: ReactNode
  game: GameDefinition
}

function GamePageShell({ children, game }: GamePageShellProps) {
  return (
    <main
      className="game-page-shell"
      data-orientation={game.orientation}
      data-testid="game-page-shell"
    >
      <div className="game-page-shell__chrome">
        <Link className="game-page-shell__back" to="/games">
          <ChevronLeft aria-hidden="true" />
          <span>Back to Games</span>
        </Link>
        <div className="game-page-shell__identity">
          <span>{game.category}</span>
          <h1>{game.title}</h1>
        </div>
      </div>

      <div className="game-page-shell__stage">
        <div className="game-page-shell__runtime" data-testid="game-runtime-stage">
          {children}
        </div>
        <GameOrientationNotice orientation={game.orientation} title={game.title} />
      </div>
    </main>
  )
}

export default GamePageShell
