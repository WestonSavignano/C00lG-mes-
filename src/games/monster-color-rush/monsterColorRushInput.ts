import type { KeyboardBinding } from '../shared/input/keyboardInput'

export type MonsterColorRushAction = 'start'

export const monsterColorRushKeyboardBindings: readonly KeyboardBinding<MonsterColorRushAction>[] = [
  { code: 'KeyW', move: { x: 0, y: -1 } },
  { code: 'ArrowUp', move: { x: 0, y: -1 }, preventDefault: true },
  { code: 'KeyA', move: { x: -1, y: 0 } },
  { code: 'ArrowLeft', move: { x: -1, y: 0 }, preventDefault: true },
  { code: 'KeyS', move: { x: 0, y: 1 } },
  { code: 'ArrowDown', move: { x: 0, y: 1 }, preventDefault: true },
  { code: 'KeyD', move: { x: 1, y: 0 } },
  { code: 'ArrowRight', move: { x: 1, y: 0 }, preventDefault: true },
  { code: 'Space', press: 'start', preventDefault: true },
  { code: 'Enter', press: 'start' },
]
