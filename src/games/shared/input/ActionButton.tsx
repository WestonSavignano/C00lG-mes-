import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import type { SemanticInputWriter } from './semanticInput'
import './inputControls.css'

export type ActionButtonProps<Action extends string> = {
  writer: Pick<
    SemanticInputWriter<Action>,
    'setActionSource' | 'pulseAction' | 'clearSource'
  >
  sourceId: string
  action: Action
  mode: 'press' | 'hold'
  className?: string
  children: ReactNode
}

function ActionButton<Action extends string>({
  writer,
  sourceId,
  action,
  mode,
  className,
  children,
}: ActionButtonProps<Action>) {
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const ownerPointerIdRef = useRef<number | null>(null)
  const pointerInsideRef = useRef(false)
  const keyboardHeldRef = useRef(false)
  const suppressPointerClickRef = useRef(false)
  const keyboardSourceId = `${sourceId}:keyboard`

  const syncPressedVisual = useCallback(() => {
    const button = buttonRef.current
    if (!button) return

    button.dataset.pressed = String(
      pointerInsideRef.current || keyboardHeldRef.current,
    )
  }, [])

  const isInside = useCallback((clientX: number, clientY: number) => {
    const button = buttonRef.current
    if (!button) return false

    const bounds = button.getBoundingClientRect()
    return (
      clientX >= bounds.left &&
      clientX <= bounds.right &&
      clientY >= bounds.top &&
      clientY <= bounds.bottom
    )
  }, [])

  const clearPointerSource = useCallback(() => {
    ownerPointerIdRef.current = null
    pointerInsideRef.current = false
    writer.clearSource(sourceId)
    syncPressedVisual()
  }, [sourceId, syncPressedVisual, writer])

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (ownerPointerIdRef.current !== null) {
        return
      }

      ownerPointerIdRef.current = event.pointerId
      pointerInsideRef.current = true
      event.currentTarget.setPointerCapture(event.pointerId)
      event.preventDefault()

      if (mode === 'hold') {
        writer.setActionSource(sourceId, action, true)
      }

      syncPressedVisual()
    },
    [action, mode, sourceId, syncPressedVisual, writer],
  )

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (ownerPointerIdRef.current !== event.pointerId) {
        return
      }

      const inside = isInside(event.clientX, event.clientY)
      pointerInsideRef.current = inside

      if (mode === 'hold') {
        writer.setActionSource(sourceId, action, inside)
      }

      syncPressedVisual()
    },
    [action, isInside, mode, sourceId, syncPressedVisual, writer],
  )

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (ownerPointerIdRef.current !== event.pointerId) {
        return
      }

      const inside = isInside(event.clientX, event.clientY)

      if (mode === 'press' && inside) {
        writer.pulseAction(action)
        suppressPointerClickRef.current = true
      }

      clearPointerSource()

      try {
        event.currentTarget.releasePointerCapture(event.pointerId)
      } catch {
        // Capture may already have been released by the browser.
      }
    },
    [action, clearPointerSource, isInside, mode, writer],
  )

  const handlePointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (ownerPointerIdRef.current !== event.pointerId) {
        return
      }

      clearPointerSource()
    },
    [clearPointerSource],
  )

  const handleLostPointerCapture = useCallback(() => {
    if (ownerPointerIdRef.current !== null) {
      clearPointerSource()
    }
  }, [clearPointerSource])

  const handleClick = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (mode !== 'press') {
        return
      }

      if (event.detail > 0 && suppressPointerClickRef.current) {
        suppressPointerClickRef.current = false
        return
      }

      suppressPointerClickRef.current = false
      writer.pulseAction(action)
    },
    [action, mode, writer],
  )

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (mode !== 'hold' || (event.code !== 'Space' && event.code !== 'Enter')) {
        return
      }

      event.preventDefault()
      keyboardHeldRef.current = true
      writer.setActionSource(keyboardSourceId, action, true)
      syncPressedVisual()
    },
    [action, keyboardSourceId, mode, syncPressedVisual, writer],
  )

  const clearKeyboardSource = useCallback(() => {
    keyboardHeldRef.current = false
    writer.clearSource(keyboardSourceId)
    syncPressedVisual()
  }, [keyboardSourceId, syncPressedVisual, writer])

  const handleKeyUp = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (mode !== 'hold' || (event.code !== 'Space' && event.code !== 'Enter')) {
        return
      }

      event.preventDefault()
      clearKeyboardSource()
    },
    [clearKeyboardSource, mode],
  )

  useEffect(
    () => () => {
      writer.clearSource(sourceId)
      writer.clearSource(keyboardSourceId)
    },
    [keyboardSourceId, sourceId, writer],
  )

  const classes = ['semantic-action-button', className]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      className={classes}
      data-mode={mode}
      data-pressed="false"
      onBlur={mode === 'hold' ? clearKeyboardSource : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onLostPointerCapture={handleLostPointerCapture}
      onPointerCancel={handlePointerCancel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      ref={buttonRef}
      type="button"
    >
      {children}
    </button>
  )
}

export default ActionButton
