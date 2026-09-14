import { useEffect, useRef, useState } from 'react'
import ActionButton from '../shared/input/ActionButton'
import DirectionalControl from '../shared/input/DirectionalControl'
import useSemanticInput from '../shared/input/useSemanticInput'
import SchoolEscapeLookSurface from './SchoolEscapeLookSurface'
import {
  createLookAccumulator,
  schoolEscapeKeyboardBindings,
  type SchoolEscapeAction,
} from './schoolEscapeInput'
import { createSchoolEscapeRuntime } from './schoolEscapeRuntime'
import './schoolEscape.css'

function SchoolEscapeGame() {
  const input = useSemanticInput<SchoolEscapeAction>(schoolEscapeKeyboardBindings)
  const [look] = useState(createLookAccumulator)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    let disposed = false
    let runtime: Awaited<ReturnType<typeof createSchoolEscapeRuntime>> | null = null

    void createSchoolEscapeRuntime({
      canvas,
      input: input.reader,
      look,
      onFatalError: () => undefined,
    }).then((controller) => {
      if (disposed) {
        controller.dispose()
        return
      }

      runtime = controller
    })

    return () => {
      disposed = true
      runtime?.dispose()
    }
  }, [input.reader, look])

  return (
    <>
      <canvas
        aria-label="School Escape 3D scene"
        className="school-escape__canvas"
        ref={canvasRef}
      />
      <div className="school-escape__controls">
        <SchoolEscapeLookSurface look={look} />
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
    </>
  )
}

export default SchoolEscapeGame
