import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import GameViewport from '../shared/GameViewport'
import {
  createBodiIslandScene,
  type BodiIslandSceneController,
} from './bodiIslandScene'
import './bodiIsland.css'

type Direction = 'forward' | 'backward' | 'left' | 'right'
type Action = 'attack' | 'dodge' | 'interact'

type HudProps = {
  complete: boolean
  darkFuzz: number
  hasShadowBoots: boolean
  health: number
  message: string
}

export function BodiIslandHud({
  complete,
  darkFuzz,
  hasShadowBoots,
  health,
  message,
}: HudProps) {
  let objective = 'Collect 10 Dark Fuzz, then return to Blaze.'

  if (darkFuzz >= 10 && !hasShadowBoots) {
    objective = 'Return to Blaze and press Interact.'
  }
  if (hasShadowBoots) {
    objective = 'Cross the shadow ground and follow Captain to the signal.'
  }
  if (complete) {
    objective = 'Signal found! The mystery continues deeper in Bodi Island.'
  }

  return (
    <div className="bodi-island__hud" aria-live="polite">
      <div className="bodi-island__hud-row">
        <span>Health {health}/5</span>
        <span>Dark Fuzz {darkFuzz}/10</span>
        {hasShadowBoots ? <span className="bodi-island__boots">Shadow Boots equipped</span> : null}
      </div>
      <strong>{objective}</strong>
      <span className="bodi-island__message">{message}</span>
    </div>
  )
}

type ControlsProps = {
  onDirectionChange: (direction: Direction, pressed: boolean) => void
  onAction: (action: Action) => void
}

export function BodiIslandControls({ onDirectionChange, onAction }: ControlsProps) {
  const directionHandler = (direction: Direction, pressed: boolean) =>
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault()
      if (pressed) {
        event.currentTarget.setPointerCapture?.(event.pointerId)
      }
      onDirectionChange(direction, pressed)
    }

  return (
    <div className="bodi-island__controls" aria-label="Bodi Island touch controls">
      <div className="bodi-island__dpad" aria-label="Movement controls">
        <button
          aria-label="Move forward"
          className="bodi-island__control bodi-island__control--up"
          onPointerCancel={directionHandler('forward', false)}
          onPointerDown={directionHandler('forward', true)}
          onPointerUp={directionHandler('forward', false)}
          type="button"
        >
          ▲
        </button>
        <button
          aria-label="Move left"
          className="bodi-island__control bodi-island__control--left"
          onPointerCancel={directionHandler('left', false)}
          onPointerDown={directionHandler('left', true)}
          onPointerUp={directionHandler('left', false)}
          type="button"
        >
          ◀
        </button>
        <button
          aria-label="Move right"
          className="bodi-island__control bodi-island__control--right"
          onPointerCancel={directionHandler('right', false)}
          onPointerDown={directionHandler('right', true)}
          onPointerUp={directionHandler('right', false)}
          type="button"
        >
          ▶
        </button>
        <button
          aria-label="Move backward"
          className="bodi-island__control bodi-island__control--down"
          onPointerCancel={directionHandler('backward', false)}
          onPointerDown={directionHandler('backward', true)}
          onPointerUp={directionHandler('backward', false)}
          type="button"
        >
          ▼
        </button>
      </div>

      <div className="bodi-island__actions" aria-label="Action controls">
        <button
          aria-label="Dodge"
          className="bodi-island__action bodi-island__action--dodge"
          onPointerDown={(event) => {
            event.preventDefault()
            onAction('dodge')
          }}
          type="button"
        >
          Dodge
        </button>
        <button
          aria-label="Attack"
          className="bodi-island__action bodi-island__action--attack"
          onPointerDown={(event) => {
            event.preventDefault()
            onAction('attack')
          }}
          type="button"
        >
          Sword
        </button>
        <button
          aria-label="Interact"
          className="bodi-island__action bodi-island__action--interact"
          onPointerDown={(event) => {
            event.preventDefault()
            onAction('interact')
          }}
          type="button"
        >
          Use
        </button>
      </div>
    </div>
  )
}

function shouldIgnoreKeyboardTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tagName = target.tagName.toLowerCase()
  return tagName === 'input' || tagName === 'textarea' || target.isContentEditable
}

function BodiIslandGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const controllerRef = useRef<BodiIslandSceneController | null>(null)
  const [darkFuzz, setDarkFuzz] = useState(0)
  const [hasShadowBoots, setHasShadowBoots] = useState(false)
  const [health, setHealth] = useState(5)
  const [message, setMessage] = useState('Captain hears a strange signal deeper in the forest.')
  const [complete, setComplete] = useState(false)
  const [graphicsError, setGraphicsError] = useState<string | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let controller: BodiIslandSceneController
    try {
      controller = createBodiIslandScene(canvas, {
        onDarkFuzzChange: setDarkFuzz,
        onShadowBootsChange: setHasShadowBoots,
        onHealthChange: setHealth,
        onMessage: setMessage,
        onComplete: () => setComplete(true),
      })
    } catch (error) {
      setGraphicsError(error instanceof Error ? error.message : 'Bodi Island could not start.')
      return
    }

    controllerRef.current = controller

    const handleResize = () => controller.resize()
    window.addEventListener('resize', handleResize)

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(handleResize)
    resizeObserver?.observe(canvas)

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', handleResize)
      controller.dispose()
      controllerRef.current = null
    }
  }, [])

  const setDirection = useCallback((direction: Direction, pressed: boolean) => {
    controllerRef.current?.setInput({ [direction]: pressed })
  }, [])

  const runAction = useCallback((action: Action) => {
    const controller = controllerRef.current
    if (!controller) return

    if (action === 'attack') controller.attack()
    if (action === 'dodge') controller.dodge()
    if (action === 'interact') controller.interact()
  }, [])

  useEffect(() => {
    const directionForKey = (key: string): Direction | null => {
      if (key === 'w' || key === 'arrowup') return 'forward'
      if (key === 's' || key === 'arrowdown') return 'backward'
      if (key === 'a' || key === 'arrowleft') return 'left'
      if (key === 'd' || key === 'arrowright') return 'right'
      return null
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreKeyboardTarget(event.target)) return
      const key = event.key.toLowerCase()
      const direction = directionForKey(key)
      if (direction) {
        event.preventDefault()
        setDirection(direction, true)
        return
      }
      if (event.repeat) return
      if (key === ' ' || event.code === 'Space') {
        event.preventDefault()
        runAction('attack')
      } else if (key === 'shift') {
        event.preventDefault()
        runAction('dodge')
      } else if (key === 'e') {
        event.preventDefault()
        runAction('interact')
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (shouldIgnoreKeyboardTarget(event.target)) return
      const direction = directionForKey(event.key.toLowerCase())
      if (!direction) return
      event.preventDefault()
      setDirection(direction, false)
    }

    const clearDirections = () => {
      for (const direction of ['forward', 'backward', 'left', 'right'] as const) {
        setDirection(direction, false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', clearDirections)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', clearDirections)
    }
  }, [runAction, setDirection])

  return (
    <section className="game-shell bodi-island" aria-label="Bodi Island game">
      <div className="game-shell__header bodi-island__intro">
        <div>
          <span className="eyebrow">3D adventure vertical slice</span>
          <h2>Follow Captain into the forest</h2>
          <p>
            Nobody thinks five-year-old Bodi is ready, but he wants to help. Fight the shadow
            creatures, collect Dark Fuzz, return to Blaze for Shadow Boots, and follow Captain's
            mysterious signal.
          </p>
        </div>
        <dl className="game-controls">
          <div><dt>Move</dt><dd>WASD / arrows / touch pad</dd></div>
          <div><dt>Attack</dt><dd>Space / Sword</dd></div>
          <div><dt>Dodge</dt><dd>Shift / Dodge</dd></div>
          <div><dt>Interact</dt><dd>E / Use</dd></div>
        </dl>
      </div>

      <GameViewport game="bodi-island" label="Bodi Island 3D forest">
        <canvas
          aria-label="Bodi Island 3D scene"
          className="bodi-island__canvas"
          ref={canvasRef}
        />
        <BodiIslandHud
          complete={complete}
          darkFuzz={darkFuzz}
          hasShadowBoots={hasShadowBoots}
          health={health}
          message={message}
        />
        {graphicsError ? (
          <div className="bodi-island__fallback" role="alert">
            <strong>Captain can't see the forest.</strong>
            <span>{graphicsError}</span>
          </div>
        ) : null}
        <BodiIslandControls onAction={runAction} onDirectionChange={setDirection} />
      </GameViewport>
    </section>
  )
}

export default BodiIslandGame
