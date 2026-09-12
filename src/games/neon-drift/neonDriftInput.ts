import type { KeyboardBinding } from '../shared/input/keyboardInput'
import type { SemanticInputReader } from '../shared/input/semanticInput'

export type NeonDriftAction = 'boost' | 'deploy' | 'start' | 'pause'

export const neonDriftKeyboardBindings: readonly KeyboardBinding<NeonDriftAction>[] = [
  { code: 'KeyW', move: { x: 0, y: -1 } },
  { code: 'ArrowUp', move: { x: 0, y: -1 }, preventDefault: true },
  { code: 'KeyA', move: { x: -1, y: 0 } },
  { code: 'ArrowLeft', move: { x: -1, y: 0 }, preventDefault: true },
  { code: 'KeyS', move: { x: 0, y: 1 } },
  { code: 'ArrowDown', move: { x: 0, y: 1 }, preventDefault: true },
  { code: 'KeyD', move: { x: 1, y: 0 } },
  { code: 'ArrowRight', move: { x: 1, y: 0 }, preventDefault: true },
  {
    code: 'Space',
    hold: 'boost',
    press: 'start',
    preventDefault: true,
  },
  { code: 'Enter', press: 'start' },
  { code: 'KeyR', press: 'deploy' },
  { code: 'KeyP', press: 'pause' },
]

export type NeonDriftControlRuntime = {
  isRunning(): boolean
  isPaused(): boolean
  isGameOver(): boolean
  start(): void
  togglePause(): void
  deploy(): void
}

export function processNeonDriftControlIntents(
  reader: SemanticInputReader<NeonDriftAction>,
  runtime: NeonDriftControlRuntime,
): void {
  const startPressed = reader.consumePress('start')
  if (startPressed && (!runtime.isRunning() || runtime.isGameOver())) {
    runtime.start()
  }

  const pausePressed = reader.consumePress('pause')
  if (pausePressed && runtime.isRunning() && !runtime.isGameOver()) {
    runtime.togglePause()
  }

  const deployPressed = reader.consumePress('deploy')
  if (
    deployPressed &&
    runtime.isRunning() &&
    !runtime.isPaused() &&
    !runtime.isGameOver()
  ) {
    runtime.deploy()
  }
}
