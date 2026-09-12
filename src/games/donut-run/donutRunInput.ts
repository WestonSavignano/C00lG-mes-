import type { KeyboardBinding } from '../shared/input/keyboardInput'

export type DonutRunAction = 'jump'

export const donutRunKeyboardBindings: readonly KeyboardBinding<DonutRunAction>[] = [
  { code: 'Space', press: 'jump', preventDefault: true },
  { code: 'ArrowUp', press: 'jump', preventDefault: true },
]
