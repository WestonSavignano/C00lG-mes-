import GameViewport from '../shared/GameViewport'
import ActionButton from '../shared/input/ActionButton'
import DirectionalControl from '../shared/input/DirectionalControl'
import useSemanticInput from '../shared/input/useSemanticInput'
import {
  schoolEscapeKeyboardBindings,
  type SchoolEscapeAction,
} from './schoolEscapeInput'
import './schoolEscape.css'

function SchoolEscapeGame() {
  const input = useSemanticInput<SchoolEscapeAction>(schoolEscapeKeyboardBindings)

  const inputOverlay = (
    <div className="school-escape__controls">
      <DirectionalControl
        className="school-escape__move-control"
        label="Move"
        sourceId="school-escape-touch-move"
        writer={input.writer}
      />
      <div className="school-escape__actions">
        <ActionButton
          action="sprint"
          className="school-escape__action"
          mode="hold"
          sourceId="school-escape-touch-sprint"
          writer={input.writer}
        >
          Sprint
        </ActionButton>
        <ActionButton
          action="jump"
          className="school-escape__action"
          mode="press"
          sourceId="school-escape-touch-jump"
          writer={input.writer}
        >
          Jump
        </ActionButton>
      </div>
    </div>
  )

  return (
    <GameViewport
      game="school-escape"
      inputOverlay={inputOverlay}
      label="School Escape"
    >
      <canvas
        aria-label="School Escape 3D scene"
        className="school-escape__canvas"
      />
    </GameViewport>
  )
}

export default SchoolEscapeGame
