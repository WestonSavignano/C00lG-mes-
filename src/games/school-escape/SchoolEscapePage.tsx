import GameViewport from '../shared/GameViewport'
import SchoolEscapeGame from './SchoolEscapeGame'

function SchoolEscapePage() {
  return (
    <GameViewport game="school-escape" label="School Escape">
      <SchoolEscapeGame />
    </GameViewport>
  )
}

export default SchoolEscapePage
