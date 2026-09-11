import { describe, expect, it, vi } from 'vitest'
import { createSemanticInput } from '../shared/input/semanticInput'
import {
  neonDriftKeyboardBindings,
  processNeonDriftControlIntents,
  type NeonDriftAction,
  type NeonDriftControlRuntime,
} from './neonDriftInput'

function createRuntime({
  running = false,
  paused = false,
  gameOver = false,
}: {
  running?: boolean
  paused?: boolean
  gameOver?: boolean
} = {}) {
  const state = { running, paused, gameOver }
  const start = vi.fn(() => {
    state.running = true
    state.paused = false
    state.gameOver = false
  })
  const togglePause = vi.fn(() => {
    state.paused = !state.paused
  })
  const deploy = vi.fn()
  const runtime: NeonDriftControlRuntime = {
    isRunning: () => state.running,
    isPaused: () => state.paused,
    isGameOver: () => state.gameOver,
    start,
    togglePause,
    deploy,
  }

  return { deploy, runtime, start, state, togglePause }
}

function createInput() {
  return createSemanticInput<NeonDriftAction>()
}

describe('Neon Drift semantic input', () => {
  it('maps existing desktop controls to semantic intent', () => {
    expect(neonDriftKeyboardBindings).toEqual([
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
    ])
  })

  it('starts or restarts while simulation is not running', () => {
    const input = createInput()
    const stopped = createRuntime()
    input.writer.pulseAction('start')

    processNeonDriftControlIntents(input.reader, stopped.runtime)

    expect(stopped.start).toHaveBeenCalledTimes(1)
    expect(stopped.state.running).toBe(true)

    const over = createRuntime({ gameOver: true })
    input.writer.pulseAction('start')
    processNeonDriftControlIntents(input.reader, over.runtime)
    expect(over.start).toHaveBeenCalledTimes(1)
  })

  it('uses the same pause action to pause and resume a running game', () => {
    const input = createInput()
    const game = createRuntime({ running: true })

    input.writer.pulseAction('pause')
    processNeonDriftControlIntents(input.reader, game.runtime)
    expect(game.state.paused).toBe(true)

    input.writer.pulseAction('pause')
    processNeonDriftControlIntents(input.reader, game.runtime)
    expect(game.state.paused).toBe(false)
    expect(game.togglePause).toHaveBeenCalledTimes(2)
  })

  it('consumes invalid deploy while paused so it cannot fire after resume', () => {
    const input = createInput()
    const game = createRuntime({ running: true, paused: true })

    input.writer.pulseAction('deploy')
    processNeonDriftControlIntents(input.reader, game.runtime)
    expect(game.deploy).not.toHaveBeenCalled()

    input.writer.pulseAction('pause')
    processNeonDriftControlIntents(input.reader, game.runtime)
    expect(game.state.paused).toBe(false)
    expect(game.deploy).not.toHaveBeenCalled()
  })

  it('re-reads state after pause so same-frame resume can permit deploy', () => {
    const input = createInput()
    const game = createRuntime({ running: true, paused: true })

    input.writer.pulseAction('pause')
    input.writer.pulseAction('deploy')
    processNeonDriftControlIntents(input.reader, game.runtime)

    expect(game.state.paused).toBe(false)
    expect(game.deploy).toHaveBeenCalledTimes(1)
  })

  it('processes start before later control-state checks', () => {
    const input = createInput()
    const game = createRuntime()

    input.writer.pulseAction('start')
    input.writer.pulseAction('deploy')
    processNeonDriftControlIntents(input.reader, game.runtime)

    expect(game.start).toHaveBeenCalledTimes(1)
    expect(game.deploy).toHaveBeenCalledTimes(1)
  })
})
