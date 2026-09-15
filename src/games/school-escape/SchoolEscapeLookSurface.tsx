import {
  useCallback,
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type { LookAccumulator } from './schoolEscapeInput'

type SchoolEscapeLookSurfaceProps = {
  look: LookAccumulator
}

function SchoolEscapeLookSurface({ look }: SchoolEscapeLookSurfaceProps) {
  const ownerPointerIdRef = useRef<number | null>(null)
  const lastPositionRef = useRef<{ x: number; y: number } | null>(null)

  const clearInterruptedLook = useCallback(() => {
    ownerPointerIdRef.current = null
    lastPositionRef.current = null
    look.reset()
  }, [look])

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (ownerPointerIdRef.current !== null) {
        return
      }

      ownerPointerIdRef.current = event.pointerId
      lastPositionRef.current = { x: event.clientX, y: event.clientY }
      event.currentTarget.setPointerCapture(event.pointerId)
      event.preventDefault()
    },
    [],
  )

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (ownerPointerIdRef.current !== event.pointerId) {
        return
      }

      const previous = lastPositionRef.current
      if (!previous) {
        lastPositionRef.current = { x: event.clientX, y: event.clientY }
        return
      }

      look.add(event.clientX - previous.x, event.clientY - previous.y)
      lastPositionRef.current = { x: event.clientX, y: event.clientY }
      event.preventDefault()
    },
    [look],
  )

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (ownerPointerIdRef.current !== event.pointerId) {
        return
      }

      ownerPointerIdRef.current = null
      lastPositionRef.current = null

      try {
        event.currentTarget.releasePointerCapture(event.pointerId)
      } catch {
        // The browser may already have released capture.
      }
    },
    [],
  )

  const handlePointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (ownerPointerIdRef.current !== event.pointerId) {
        return
      }

      clearInterruptedLook()
    },
    [clearInterruptedLook],
  )

  const handleLostPointerCapture = useCallback(() => {
    if (ownerPointerIdRef.current !== null) {
      clearInterruptedLook()
    }
  }, [clearInterruptedLook])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearInterruptedLook()
      }
    }

    window.addEventListener('blur', clearInterruptedLook)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('blur', clearInterruptedLook)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearInterruptedLook()
    }
  }, [clearInterruptedLook])

  return (
    <div
      aria-label="Look around"
      className="school-escape__look-surface"
      onLostPointerCapture={handleLostPointerCapture}
      onPointerCancel={handlePointerCancel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      role="group"
    />
  )
}

export default SchoolEscapeLookSurface
