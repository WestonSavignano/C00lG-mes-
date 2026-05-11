import { Maximize2, Minimize2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode, type Ref } from 'react'

type GameViewportProps = {
  children: ReactNode
  game: string
  label: string
  ref?: Ref<HTMLDivElement>
}

function assignRef(ref: Ref<HTMLDivElement> | undefined, value: HTMLDivElement | null) {
  if (!ref) {
    return
  }

  if (typeof ref === 'function') {
    ref(value)
    return
  }

  const mutableRef = ref as { current: HTMLDivElement | null }
  mutableRef.current = value
}

function GameViewport({ children, game, label, ref }: GameViewportProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const setViewportRef = useCallback(
    (node: HTMLDivElement | null) => {
      viewportRef.current = node
      assignRef(ref, node)
    },
    [ref],
  )

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(document.fullscreenElement === viewportRef.current)
      window.dispatchEvent(new Event('resize'))
    }

    document.addEventListener('fullscreenchange', syncFullscreenState)

    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState)
    }
  }, [])

  const handleFullscreenClick = useCallback(async () => {
    const viewport = viewportRef.current

    if (!viewport) {
      return
    }

    if (document.fullscreenElement === viewport) {
      await document.exitFullscreen?.()
      return
    }

    await viewport.requestFullscreen?.()
    viewport.focus({ preventScroll: true })
  }, [])

  const fullscreenLabel = isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'
  const FullscreenIcon = isFullscreen ? Minimize2 : Maximize2

  return (
    <div
      aria-label={label}
      className="game-viewport"
      data-game={game}
      data-testid="game-viewport"
      ref={setViewportRef}
      role="application"
      tabIndex={-1}
    >
      {children}
      <button
        aria-label={fullscreenLabel}
        aria-pressed={isFullscreen}
        className="game-viewport__fullscreen"
        onClick={handleFullscreenClick}
        title={fullscreenLabel}
        type="button"
      >
        <FullscreenIcon aria-hidden="true" />
      </button>
    </div>
  )
}

export default GameViewport
