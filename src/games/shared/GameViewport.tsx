import { Maximize2, Minimize2 } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type Ref,
} from 'react'
import './GameViewport.css'

type GameViewportProps = {
  children: ReactNode
  game: string
  inputOverlay?: ReactNode
  label: string
  ref?: Ref<HTMLDivElement>
}

const interactiveSelector =
  'button, a, input, select, textarea, [contenteditable="true"]'

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

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(interactiveSelector))
}

function GameViewport({
  children,
  game,
  inputOverlay,
  label,
  ref,
}: GameViewportProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const setViewportRef = useCallback(
    (node: HTMLDivElement | null) => {
      viewportRef.current = node
      assignRef(ref, node)
    },
    [ref],
  )

  const focusViewport = useCallback(() => {
    viewportRef.current?.focus({ preventScroll: true })
  }, [])

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

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isInteractiveTarget(event.target)) {
        focusViewport()
      }
    },
    [focusViewport],
  )

  const handleFullscreenClick = useCallback(async () => {
    const viewport = viewportRef.current

    if (!viewport) {
      return
    }

    try {
      if (document.fullscreenElement === viewport) {
        await document.exitFullscreen?.()
      } else {
        await viewport.requestFullscreen?.()
      }
    } catch {
      // Fullscreen is progressive enhancement. Keep gameplay usable if the
      // browser, embed, or platform rejects the request.
    } finally {
      viewport.focus({ preventScroll: true })
    }
  }, [])

  const fullscreenLabel = isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'
  const FullscreenIcon = isFullscreen ? Minimize2 : Maximize2

  return (
    <div
      aria-label={label}
      className="game-viewport"
      data-game={game}
      data-testid="game-viewport"
      onPointerDown={handlePointerDown}
      ref={setViewportRef}
      role="application"
      tabIndex={-1}
    >
      {children}
      {inputOverlay ? (
        <div
          className="game-viewport__input-overlay"
          data-testid="game-input-overlay"
        >
          {inputOverlay}
        </div>
      ) : null}
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
