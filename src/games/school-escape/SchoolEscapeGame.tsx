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
  type SchoolEscapeUiSnapshot,
} from './schoolEscapeRuntime'
import {
  EMPTY_PAINT_MIX,
  type PaintMix,
  type Pigment,
} from './schoolEscapeTypes'
import './schoolEscape.css'

type SchoolEscapeGameProps = {
  runtimeEnabled?: boolean
}

const INITIAL_UI_SNAPSHOT: SchoolEscapeUiSnapshot = {
  nearbySurfaceId: null,
  matchScore: null,
  teacherAlert: 'none',
  subtitle: null,
  phase: 'playing',
}

const PIGMENTS: readonly Readonly<{
  id: Pigment
  label: string
}>[] = [
  { id: 'red', label: 'Red' },
  { id: 'yellow', label: 'Yellow' },
  { id: 'blue', label: 'Blue' },
  { id: 'white', label: 'White' },
  { id: 'black', label: 'Black' },
]

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error))
}

function freshEmptyPaintMix(): PaintMix {
  return { ...EMPTY_PAINT_MIX }
}

function paintMatchLabel(score: number | null) {
  if (score === null) {
    return null
  }

  if (score >= 0.8) {
    return 'Paint match strong'
  }

  if (score >= 0.55) {
    return 'Paint match improving'
  }

  return 'Paint match weak'
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
  const [retryVersion, setRetryVersion] = useState(0)
  const [paintMix, setPaintMix] = useState<PaintMix>(freshEmptyPaintMix)
  const [uiSnapshot, setUiSnapshot] = useState<SchoolEscapeUiSnapshot>(
    INITIAL_UI_SNAPSHOT,
  )
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const runtimeRef = useRef<SchoolEscapeRuntimeController | null>(null)
  const paintMixRef = useRef<PaintMix>(paintMix)

  useEffect(() => {
    paintMixRef.current = paintMix
    runtimeRef.current?.setPaintMix(paintMix)
  }, [paintMix])

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
      onUiSnapshot(snapshot) {
        if (!disposed) {
          setUiSnapshot(snapshot)
        }
      },
    })
      .then((controller) => {
        if (disposed) {
          controller.dispose()
          return
        }

        runtime = controller
        runtimeRef.current = controller
        controller.setPaintMix(paintMixRef.current)
        detachRuntimeLifecycle = attachRuntimeLifecycle(controller)
      })
      .catch(reportFatalError)

    return () => {
      disposed = true
      detachRuntimeLifecycle?.()
      if (runtimeRef.current === runtime) {
        runtimeRef.current = null
      }
      runtime?.dispose()
    }
  }, [input.reader, look, retryVersion, runtimeEnabled])

  const restartGameplay = () => {
    const runtime = runtimeRef.current
    const emptyPaint = freshEmptyPaintMix()

    setRuntimeError(null)
    setPaintMix(emptyPaint)
    paintMixRef.current = emptyPaint
    setUiSnapshot(INITIAL_UI_SNAPSHOT)

    if (!runtime) {
      setRetryVersion((version) => version + 1)
      return
    }

    runtime.setPaintMix(emptyPaint)
    void runtime.restart().catch((error) => {
      setRuntimeError(toError(error))
    })
  }

  const addPigment = (pigment: Pigment) => {
    setPaintMix((current) => ({
      ...current,
      [pigment]: Math.min(1, current[pigment] + 0.1),
    }))
  }

  const cleanPaint = () => {
    setPaintMix(freshEmptyPaintMix())
  }

  const isPlaying = uiSnapshot.phase === 'playing'
  const showPaintControls = isPlaying && uiSnapshot.nearbySurfaceId !== null
  const matchLabel = showPaintControls
    ? paintMatchLabel(uiSnapshot.matchScore)
    : null
  const teacherAlertLabel =
    uiSnapshot.teacherAlert === 'suspicious'
      ? 'Teacher noticed something'
      : uiSnapshot.teacherAlert === 'alert'
        ? 'Teacher is closing in'
        : null

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
            The 3D renderer was unavailable. Try again or return to Games.
          </span>
          <div className="school-escape__runtime-error-actions">
            <button
              className="school-escape__runtime-error-action"
              onClick={restartGameplay}
              type="button"
            >
              Retry
            </button>
            <a
              className="school-escape__runtime-error-action school-escape__runtime-error-action--secondary"
              href="/games"
            >
              Return to Games
            </a>
          </div>
        </div>
      ) : (
        <>
          {isPlaying ? (
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
          ) : null}

          <div className="school-escape__hud">
            {showPaintControls ? (
              <div
                aria-label="Mix paint"
                className="school-escape__paint"
                role="group"
              >
                <div className="school-escape__pigments">
                  {PIGMENTS.map(({ id, label }) => (
                    <button
                      aria-label={label}
                      aria-pressed={paintMix[id] > 0}
                      className="school-escape__pigment"
                      data-pigment={id}
                      key={id}
                      onClick={() => addPigment(id)}
                      type="button"
                    />
                  ))}
                  <button
                    aria-label="Clean paint"
                    className="school-escape__paint-clean"
                    onClick={cleanPaint}
                    type="button"
                  >
                    Clean
                  </button>
                </div>
                {matchLabel ? (
                  <div
                    aria-label={matchLabel}
                    className="school-escape__paint-match"
                    role="img"
                  />
                ) : null}
              </div>
            ) : null}

            {teacherAlertLabel ? (
              <div
                aria-label={teacherAlertLabel}
                className="school-escape__teacher-alert"
                role="img"
              >
                !
              </div>
            ) : null}

            {uiSnapshot.subtitle ? (
              <div
                aria-live="polite"
                className="school-escape__subtitle"
                role="status"
              >
                {uiSnapshot.subtitle}
              </div>
            ) : null}
          </div>

          {uiSnapshot.phase === 'caught' ? (
            <div className="school-escape__outcome" role="dialog">
              <h2>Caught</h2>
              <p>The teacher caught up. Try the route again.</p>
              <div className="school-escape__outcome-actions">
                <button onClick={restartGameplay} type="button">
                  Retry
                </button>
                <a href="/games">Return to Games</a>
              </div>
            </div>
          ) : null}

          {uiSnapshot.phase === 'complete' ? (
            <div className="school-escape__outcome" role="dialog">
              <h2>Golden slice complete</h2>
              <p>You made the near-miss and found cover.</p>
              <div className="school-escape__outcome-actions">
                <button onClick={restartGameplay} type="button">
                  Play again
                </button>
                <a href="/games">Return to Games</a>
              </div>
            </div>
          ) : null}
        </>
      )}
    </>
  )
}

export default SchoolEscapeGame
