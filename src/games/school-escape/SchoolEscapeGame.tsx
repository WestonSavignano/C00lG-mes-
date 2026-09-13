import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import GameViewport from '../shared/GameViewport'
import ActionButton from '../shared/input/ActionButton'
import DirectionalControl from '../shared/input/DirectionalControl'
import useSemanticInput from '../shared/input/useSemanticInput'
import {
  SCHOOL_ESCAPE_KEYBOARD_BINDINGS,
  type SchoolEscapeAction,
} from './schoolEscapeInput'
import {
  createSchoolEscapeScene,
  type SchoolEscapeSceneCallbacks,
  type SchoolEscapeSceneController,
} from './schoolEscapeScene'
import type { BlendQuality, GamePhase, RGBColor } from './schoolEscapeLogic'
import './schoolEscape.css'

const INITIAL_CAMOUFLAGE: RGBColor = { r: 30, g: 30, b: 34 }

type SceneFactory = typeof createSchoolEscapeScene

type SchoolEscapeGameProps = {
  sceneFactory?: SceneFactory
}

type CameraDrag = {
  pointerId: number
  x: number
  y: number
}

function qualityLabel(quality: BlendQuality) {
  return quality.toUpperCase()
}

function SchoolEscapeGame({
  sceneFactory = createSchoolEscapeScene,
}: SchoolEscapeGameProps) {
  const input = useSemanticInput<SchoolEscapeAction>(SCHOOL_ESCAPE_KEYBOARD_BINDINGS)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const sceneRef = useRef<SchoolEscapeSceneController | null>(null)
  const cameraDragRef = useRef<CameraDrag | null>(null)
  const [phase, setPhase] = useState<GamePhase>('school')
  const [camouflage, setCamouflage] = useState<RGBColor>(INITIAL_CAMOUFLAGE)
  const [blend, setBlend] = useState<BlendQuality>('poor')
  const [blendScore, setBlendScore] = useState(0)
  const [teacherState, setTeacherState] = useState('patrol')
  const [subtitle, setSubtitle] = useState(
    'Match the wall color. Stay still. Find the exit.',
  )
  const [webGLAvailable, setWebGLAvailable] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const callbacks: SchoolEscapeSceneCallbacks = {
      onPhaseChange: setPhase,
      onBlendChange(quality, score) {
        setBlend(quality)
        setBlendScore(score)
      },
      onTeacherStateChange: setTeacherState,
      onSubtitle: setSubtitle,
      onWebGLUnavailable() {
        setWebGLAvailable(false)
      },
    }

    const scene = sceneFactory(canvas, input.reader, callbacks)
    sceneRef.current = scene
    scene?.setCamouflageColor(INITIAL_CAMOUFLAGE)

    return () => {
      sceneRef.current = null
      scene?.dispose()
    }
  }, [input.reader, sceneFactory])

  const setChannel = useCallback(
    (channel: keyof RGBColor, event: ChangeEvent<HTMLInputElement>) => {
      const value = Number(event.target.value)
      setCamouflage((current) => {
        const next = { ...current, [channel]: value }
        sceneRef.current?.setCamouflageColor(next)
        return next
      })
    },
    [],
  )

  const beginCameraDrag = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (cameraDragRef.current) return
      cameraDragRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      }
      event.currentTarget.setPointerCapture(event.pointerId)
      event.preventDefault()
    },
    [],
  )

  const moveCameraDrag = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const drag = cameraDragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return

      const deltaX = event.clientX - drag.x
      const deltaY = event.clientY - drag.y
      drag.x = event.clientX
      drag.y = event.clientY
      sceneRef.current?.setCameraDrag(deltaX, deltaY)
      event.preventDefault()
    },
    [],
  )

  const endCameraDrag = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const drag = cameraDragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return

      cameraDragRef.current = null
      try {
        event.currentTarget.releasePointerCapture(event.pointerId)
      } catch {
        // The browser may already have released capture after interruption.
      }
    },
    [],
  )

  const restart = useCallback(() => {
    input.writer.reset()
    setPhase('school')
    setCamouflage(INITIAL_CAMOUFLAGE)
    setBlend('poor')
    setBlendScore(0)
    setTeacherState('patrol')
    setSubtitle('Match the wall color. Stay still. Find the exit.')
    setWebGLAvailable(true)
    sceneRef.current?.setCamouflageColor(INITIAL_CAMOUFLAGE)
    sceneRef.current?.restart()
  }, [input.writer])

  const inputOverlay = (
    <div className="school-escape-overlay">
      <section className="school-escape-hud" aria-label="Camouflage controls">
        <div className="school-escape-hud__status">
          <strong>Blend: {qualityLabel(blend)}</strong>
          <span>{Math.round(blendScore * 100)}%</span>
          <span className={`school-escape-hud__teacher school-escape-hud__teacher--${teacherState}`}>
            Teacher: {teacherState.toUpperCase()}
          </span>
        </div>
        <div className="school-escape-rgb">
          <label>
            <span>R</span>
            <input
              aria-label="Red camouflage"
              max="255"
              min="0"
              onChange={(event) => setChannel('r', event)}
              type="range"
              value={camouflage.r}
            />
          </label>
          <label>
            <span>G</span>
            <input
              aria-label="Green camouflage"
              max="255"
              min="0"
              onChange={(event) => setChannel('g', event)}
              type="range"
              value={camouflage.g}
            />
          </label>
          <label>
            <span>B</span>
            <input
              aria-label="Blue camouflage"
              max="255"
              min="0"
              onChange={(event) => setChannel('b', event)}
              type="range"
              value={camouflage.b}
            />
          </label>
          <span
            aria-label="Current camouflage color"
            className="school-escape-rgb__swatch"
            style={{
              backgroundColor: `rgb(${camouflage.r} ${camouflage.g} ${camouflage.b})`,
            }}
          />
        </div>
      </section>

      <div className="school-escape-subtitle" aria-live="polite">
        {subtitle}
      </div>

      <div className="school-escape-touch-controls" aria-label="Touch controls">
        <DirectionalControl
          className="school-escape-touch-controls__move"
          label="Move"
          sourceId="school-escape:touch-move"
          writer={input.writer}
        />
        <div className="school-escape-touch-controls__actions">
          <ActionButton
            action="sprint"
            mode="hold"
            sourceId="school-escape:touch-sprint"
            writer={input.writer}
          >
            Sprint
          </ActionButton>
          <ActionButton
            action="jump"
            mode="press"
            sourceId="school-escape:touch-jump"
            writer={input.writer}
          >
            Jump
          </ActionButton>
        </div>
      </div>

      {phase === 'failed' ? (
        <div className="school-escape-result school-escape-result--failed">
          <div>
            <p className="school-escape-result__eyebrow">PRINCIPAL'S OFFICE</p>
            <h2>Caught!</h2>
            <p>The principal is yelling. Try another route and blend sooner.</p>
            <button type="button" onClick={restart}>Retry</button>
          </div>
        </div>
      ) : null}

      {phase === 'won' ? (
        <div className="school-escape-result school-escape-result--won">
          <div>
            <p className="school-escape-result__eyebrow">HOME SAFE</p>
            <h2>YOU ESCAPED</h2>
            <p>You made it inside before the teacher caught you.</p>
            <button type="button" onClick={restart}>Play Again</button>
          </div>
        </div>
      ) : null}

      {!webGLAvailable ? (
        <div className="school-escape-result">
          <div>
            <h2>3D unavailable</h2>
            <p>This browser or device could not start the WebGL game.</p>
          </div>
        </div>
      ) : null}
    </div>
  )

  return (
    <GameViewport
      game="school-escape"
      inputOverlay={inputOverlay}
      label="School Escape game"
    >
      <div className="school-escape-stage">
        <canvas
          aria-label="School Escape 3D scene"
          className="school-escape-canvas"
          onLostPointerCapture={() => {
            cameraDragRef.current = null
          }}
          onPointerCancel={endCameraDrag}
          onPointerDown={beginCameraDrag}
          onPointerMove={moveCameraDrag}
          onPointerUp={endCameraDrag}
          ref={canvasRef}
        />
      </div>
    </GameViewport>
  )
}

export default SchoolEscapeGame
