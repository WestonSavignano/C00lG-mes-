import {
  useCallback,
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type { MovementInputWriter } from './semanticInput'
import './inputControls.css'

export type DirectionalControlProps = {
  writer: MovementInputWriter
  sourceId: string
  label: string
  deadZone?: number
  className?: string
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function DirectionalControl({
  writer,
  sourceId,
  label,
  deadZone = 0.12,
  className,
}: DirectionalControlProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const ownerPointerIdRef = useRef<number | null>(null)

  const setPressedVisual = useCallback((pressed: boolean, x = 0, y = 0) => {
    const root = rootRef.current
    if (!root) return

    root.dataset.pressed = String(pressed)
    root.style.setProperty('--semantic-stick-x', `${x * 28}px`)
    root.style.setProperty('--semantic-stick-y', `${y * 28}px`)
  }, [])

  const clearOwnedPointer = useCallback(() => {
    ownerPointerIdRef.current = null
    writer.clearMoveSource(sourceId)
    setPressedVisual(false)
  }, [setPressedVisual, sourceId, writer])

  const updateFromPointer = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (ownerPointerIdRef.current !== event.pointerId) {
        return
      }

      const root = rootRef.current
      if (!root) {
        return
      }

      const bounds = root.getBoundingClientRect()
      const radius = Math.max(1, Math.min(bounds.width, bounds.height) / 2)
      const centerX = bounds.left + bounds.width / 2
      const centerY = bounds.top + bounds.height / 2
      const dx = (event.clientX - centerX) / radius
      const dy = (event.clientY - centerY) / radius
      const magnitude = Math.hypot(dx, dy)
      const safeDeadZone = clamp(deadZone, 0, 0.95)

      if (magnitude <= safeDeadZone) {
        writer.clearMoveSource(sourceId)
        setPressedVisual(true)
        return
      }

      const directionX = dx / magnitude
      const directionY = dy / magnitude
      const scaledMagnitude = clamp(
        (magnitude - safeDeadZone) / (1 - safeDeadZone),
        0,
        1,
      )
      const x = directionX * scaledMagnitude
      const y = directionY * scaledMagnitude

      writer.setMoveSource(sourceId, x, y)
      setPressedVisual(true, x, y)
    },
    [deadZone, setPressedVisual, sourceId, writer],
  )

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (ownerPointerIdRef.current !== null) {
        return
      }

      ownerPointerIdRef.current = event.pointerId
      event.currentTarget.setPointerCapture(event.pointerId)
      event.preventDefault()
      updateFromPointer(event)
    },
    [updateFromPointer],
  )

  const handlePointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (ownerPointerIdRef.current !== event.pointerId) {
        return
      }

      clearOwnedPointer()

      try {
        event.currentTarget.releasePointerCapture(event.pointerId)
      } catch {
        // Capture may already have been released by the browser.
      }
    },
    [clearOwnedPointer],
  )

  const handleLostPointerCapture = useCallback(() => {
    if (ownerPointerIdRef.current !== null) {
      clearOwnedPointer()
    }
  }, [clearOwnedPointer])

  useEffect(
    () => () => {
      clearOwnedPointer()
    },
    [clearOwnedPointer],
  )

  const classes = ['semantic-directional-control', className]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      aria-label={label}
      className={classes}
      data-pressed="false"
      onLostPointerCapture={handleLostPointerCapture}
      onPointerCancel={handlePointerEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={updateFromPointer}
      onPointerUp={handlePointerEnd}
      ref={rootRef}
      role="group"
    >
      <div aria-hidden="true" className="semantic-directional-control__ring" />
      <div aria-hidden="true" className="semantic-directional-control__thumb" />
    </div>
  )
}

export default DirectionalControl
