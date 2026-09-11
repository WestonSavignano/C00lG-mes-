import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import GameViewport from '../shared/GameViewport'
import {
  createFartAttackGame,
  type FartAttackGameController,
  type MovementDirection,
} from './fartAttackGame'
import './fartAttack.css'

function FartAttack() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const gameRef = useRef<FartAttackGameController | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas) {
      return
    }

    const game = createFartAttackGame(canvas)
    gameRef.current = game

    return () => {
      game.destroy()
      gameRef.current = null
    }
  }, [])

  const handleMovementStart =
    (direction: MovementDirection) =>
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault()
      event.currentTarget.setPointerCapture?.(event.pointerId)
      gameRef.current?.setMovement(direction, true)
    }

  const handleMovementEnd =
    (direction: MovementDirection) =>
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault()
      gameRef.current?.setMovement(direction, false)
    }

  return (
    <div className="fart-attack">
      <GameViewport game="fart-attack" label="Fart Attack game">
        <canvas
          aria-label="Fart Attack playfield"
          className="fart-attack__canvas"
          ref={canvasRef}
        />
      </GameViewport>

      <div aria-label="Touch controls" className="fart-attack__touch-controls">
        <div className="fart-attack__dpad">
          <button
            aria-label="Move up"
            className="fart-attack__control fart-attack__control--up"
            onPointerCancel={handleMovementEnd('up')}
            onPointerDown={handleMovementStart('up')}
            onPointerUp={handleMovementEnd('up')}
            type="button"
          >
            ↑
          </button>
          <button
            aria-label="Move left"
            className="fart-attack__control fart-attack__control--left"
            onPointerCancel={handleMovementEnd('left')}
            onPointerDown={handleMovementStart('left')}
            onPointerUp={handleMovementEnd('left')}
            type="button"
          >
            ←
          </button>
          <button
            aria-label="Move down"
            className="fart-attack__control fart-attack__control--down"
            onPointerCancel={handleMovementEnd('down')}
            onPointerDown={handleMovementStart('down')}
            onPointerUp={handleMovementEnd('down')}
            type="button"
          >
            ↓
          </button>
          <button
            aria-label="Move right"
            className="fart-attack__control fart-attack__control--right"
            onPointerCancel={handleMovementEnd('right')}
            onPointerDown={handleMovementStart('right')}
            onPointerUp={handleMovementEnd('right')}
            type="button"
          >
            →
          </button>
        </div>

        <div className="fart-attack__actions">
          <button
            aria-label="Fart attack"
            className="fart-attack__control fart-attack__control--fart"
            onPointerDown={(event) => {
              event.preventDefault()
              gameRef.current?.fart()
            }}
            type="button"
          >
            FART
          </button>
          <button
            aria-label="Restart game"
            className="fart-attack__control fart-attack__control--restart"
            onClick={() => gameRef.current?.restart()}
            type="button"
          >
            R
          </button>
        </div>
      </div>

      <p className="fart-attack__keyboard-hint">
        WASD move · F fart · R restart · Shop: 1, 2, 3 or tap an item
      </p>
    </div>
  )
}

export default FartAttack
