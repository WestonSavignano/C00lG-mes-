import type { KeyboardBinding } from '../shared/input/keyboardInput'

export type SchoolEscapeAction = 'sprint' | 'jump'

export const SCHOOL_ESCAPE_KEYBOARD_BINDINGS = [
  { code: 'KeyW', move: { x: 0, y: -1 }, preventDefault: true },
  { code: 'KeyS', move: { x: 0, y: 1 }, preventDefault: true },
  { code: 'KeyA', move: { x: -1, y: 0 }, preventDefault: true },
  { code: 'KeyD', move: { x: 1, y: 0 }, preventDefault: true },
  { code: 'ShiftLeft', hold: 'sprint' },
  { code: 'ShiftRight', hold: 'sprint' },
  { code: 'Space', press: 'jump', preventDefault: true },
] as const satisfies readonly KeyboardBinding<SchoolEscapeAction>[]
