import { RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { GameOrientation } from '../catalog/gameTypes'
import { shouldSuggestOrientation } from './orientation'
import './GameOrientationNotice.css'

type GameOrientationNoticeProps = {
  orientation: GameOrientation
  title: string
}

type ViewportState = {
  coarsePointer: boolean
  height: number
  width: number
}

function readViewportState(): ViewportState {
  const coarsePointer =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches

  return {
    coarsePointer,
    height: window.innerHeight,
    width: window.innerWidth,
  }
}

function GameOrientationNotice({
  orientation,
  title,
}: GameOrientationNoticeProps) {
  const [dismissed, setDismissed] = useState(false)
  const [viewport, setViewport] = useState(readViewportState)

  useEffect(() => {
    const handleResize = () => {
      setViewport(readViewportState())
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  const shouldShow =
    !dismissed &&
    shouldSuggestOrientation(
      orientation,
      viewport.width,
      viewport.height,
      viewport.coarsePointer,
    )

  if (!shouldShow || orientation === 'either') {
    return null
  }

  return (
    <div className="game-orientation-notice" role="status" aria-live="polite">
      <div className="game-orientation-notice__panel">
        <RotateCcw aria-hidden="true" className="game-orientation-notice__icon" />
        <div className="game-orientation-notice__copy">
          <strong>Rotate your device</strong>
          <span>
            Rotate your device to play {title} in {orientation}.
          </span>
        </div>
        <button
          className="game-orientation-notice__dismiss"
          onClick={() => setDismissed(true)}
          type="button"
        >
          Play anyway
        </button>
      </div>
    </div>
  )
}

export default GameOrientationNotice
