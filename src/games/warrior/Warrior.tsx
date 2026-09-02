import { useEffect, useRef } from 'react'
import GameViewport from '../shared/GameViewport'
import './Warrior.css'
import { createWarriorGame } from './warriorGame'

function Warrior() {
  const canvasRef =
    useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas) {
      return
    }

    const game =
      createWarriorGame(canvas)

    return () => {
      game.destroy()
    }
  }, [])

  return (
    <GameViewport
      game="warrior"
      label="Warrior"
    >
      <canvas
        aria-label="Stick Guy vs Dark Matter game"
        ref={canvasRef}
      />
    </GameViewport>
  )
}

export default Warrior