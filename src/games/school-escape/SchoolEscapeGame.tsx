import GameViewport from '../shared/GameViewport'
import './schoolEscape.css'

function SchoolEscapeGame() {
  return (
    <GameViewport game="school-escape" label="School Escape">
      <canvas
        aria-label="School Escape 3D scene"
        className="school-escape__canvas"
      />
    </GameViewport>
  )
}

export default SchoolEscapeGame
