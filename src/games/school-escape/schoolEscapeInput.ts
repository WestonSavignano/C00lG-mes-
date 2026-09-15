import type { KeyboardBinding } from '../shared/input/keyboardInput'

export type SchoolEscapeAction = 'sprint' | 'jump'

export const schoolEscapeKeyboardBindings: readonly KeyboardBinding<SchoolEscapeAction>[] = [
  { code: 'KeyW', move: { x: 0, y: -1 }, preventDefault: true },
  { code: 'KeyS', move: { x: 0, y: 1 }, preventDefault: true },
  { code: 'KeyA', move: { x: -1, y: 0 }, preventDefault: true },
  { code: 'KeyD', move: { x: 1, y: 0 }, preventDefault: true },
  { code: 'ShiftLeft', hold: 'sprint', preventDefault: true },
  { code: 'ShiftRight', hold: 'sprint', preventDefault: true },
  { code: 'Space', press: 'jump', preventDefault: true },
]

export type LookDelta = Readonly<{ x: number; y: number }>

export type LookInputReader = {
  consume(): LookDelta
  reset(): void
}

export type LookAccumulator = LookInputReader & {
  add(dx: number, dy: number): void
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function createLookAccumulator(): LookAccumulator {
  let x = 0
  let y = 0

  return {
    add(dx, dy) {
      x += Number.isFinite(dx) ? dx : 0
      y += Number.isFinite(dy) ? dy : 0
    },
    consume() {
      const result = {
        x: clamp(x, -120, 120),
        y: clamp(y, -120, 120),
      }
      x = 0
      y = 0
      return result
    },
    reset() {
      x = 0
      y = 0
    },
  }
}
