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
import {
  createSchoolEscapeRuntime,
  type SchoolEscapeRuntimeController,
} from './schoolEscapeRuntime'
import './schoolEscape.css'

type SchoolEscapeGameProps = {
  runtimeEnabled?: boolean
}

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error))
}

function attachRuntimeLifecycle(runtime: SchoolEscapeRuntimeController) {
  const resize = () => runtime.resize()
  const pause = () => runtime.pause()
  const resumeIfVisible = () => {
    if (document.visibilityState !== 'hidden') {
      runtime.resume()
    }
  }
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      runtime.pause()
    } else {
      runtime.resume()
    }
  }

  window.addEventListener('resize', resize)
  window.addEventListener('orientationchange', resize)
  window.addEventListener('blur', pause)
  window.addEventListener('focus', resumeIfVisible)
  document.addEventListener('fullscreenchange', resize)
  document.addEventListener('visibilitychange', handleVisibilityChange)

  return () => {
    window.removeEventListener('resize', resize)
    window.removeEventListener('orientationchange', resize)
    window.removeEventListener('blur', pause)
    window.removeEventListener('focus', resumeIfVisible)
    document.removeEventListener('fullscreenchange', resize)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
}

function SchoolEscapeGame({
  runtimeEnabled = import.meta.env.MODE !== 'test',
}: SchoolEscapeGameProps) {
  const input = useSemanticInput<SchoolEscapeAction>(schoolEscapeKeyboardBindings)
  const [look] = useState(createLookAccumulator)
  const [runtimeError, setRuntimeError] = useState<Error | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !runtimeEnabled) {
      return
    }

    let disposed = false
    let runtime: SchoolEscapeRuntimeController | null = null
    let detachRuntimeLifecycle: (() => void) | null = null

    const reportFatalError = (error: unknown) => {
      if (!disposed) {
        setRuntimeError(toError(error))
      }
    }

    void createSchoolEscapeRuntime({
      canvas,
      input: input.reader,
      look,
      onFatalError: reportFatalError,
    })
      .then((controller) => {
        if (disposed) {
          controller.dispose()
          return
        }

        runtime = controller
        detachRuntimeLifecycle = attachRuntimeLifecycle(controller)
      })
      .catch(reportFatalError)

    return () => {
      disposed = true
      detachRuntimeLifecycle?.()
      runtime?.dispose()
    }
  }, [input.reader, look, runtimeEnabled])

  return (
    <>
      <canvas
        aria-label="School Escape 3D scene"
        className="school-escape__canvas"
        ref={canvasRef}
      />
      {runtimeError ? (
        <div className="school-escape__runtime-error" role="alert">
          <strong>School Escape could not start.</strong>
          <span>
            The 3D renderer was unavailable. Try reloading the preview or using a
            browser with WebGL enabled.
          </span>
        </div>
      ) : null}
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
