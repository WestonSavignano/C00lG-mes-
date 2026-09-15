import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSemanticInput } from '../shared/input/semanticInput'
import { createLookAccumulator, type SchoolEscapeAction } from './schoolEscapeInput'
import { createSchoolEscapeRuntime } from './schoolEscapeRuntime'

const babylon = vi.hoisted(() => {
  const render = vi.fn()
  const disposeScene = vi.fn()
  const resize = vi.fn()
  const disposeEngine = vi.fn()
  const stopRenderLoop = vi.fn()
  const setHardwareScalingLevel = vi.fn()
  let renderLoop: (() => void) | null = null

  const Engine = vi.fn(function EngineMock() {
    return {
      runRenderLoop(callback: () => void) {
        renderLoop = callback
      },
      stopRenderLoop,
      resize,
      setHardwareScalingLevel,
      dispose: disposeEngine,
    }
  })

  const Scene = vi.fn(function SceneMock() {
    return {
      render,
      dispose: disposeScene,
    }
  })

  return {
    Engine,
    Scene,
    render,
    disposeScene,
    resize,
    disposeEngine,
    stopRenderLoop,
    setHardwareScalingLevel,
    getRenderLoop: () => renderLoop,
    resetRenderLoop: () => {
      renderLoop = null
    },
  }
})

vi.mock('@babylonjs/core/Engines/engine', () => ({ Engine: babylon.Engine }))
vi.mock('@babylonjs/core/scene', () => ({ Scene: babylon.Scene }))

function setHardwareCapabilities({
  deviceMemory = 16,
  hardwareConcurrency = 12,
  devicePixelRatio = 1,
}: {
  deviceMemory?: number
  hardwareConcurrency?: number
  devicePixelRatio?: number
} = {}) {
  Object.defineProperty(navigator, 'deviceMemory', {
    configurable: true,
    value: deviceMemory,
  })
  Object.defineProperty(navigator, 'hardwareConcurrency', {
    configurable: true,
    value: hardwareConcurrency,
  })
  Object.defineProperty(window, 'devicePixelRatio', {
    configurable: true,
    value: devicePixelRatio,
  })
}

function createRuntimeOptions() {
  return {
    canvas: document.createElement('canvas'),
    input: createSemanticInput<SchoolEscapeAction>().reader,
    look: createLookAccumulator(),
    onFatalError: vi.fn(),
  }
}

describe('School Escape Babylon runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    babylon.resetRenderLoop()
    setHardwareCapabilities()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('owns the Babylon engine/scene lifecycle and pauses rendering explicitly', async () => {
    const canvas = document.createElement('canvas')
    const input = createSemanticInput<SchoolEscapeAction>()
    const look = createLookAccumulator()

    const runtime = await createSchoolEscapeRuntime({
      canvas,
      input: input.reader,
      look,
      onFatalError: vi.fn(),
    })

    expect(babylon.Engine).toHaveBeenCalledTimes(1)
    expect(babylon.Engine).toHaveBeenCalledWith(canvas, true)
    expect(babylon.Scene).toHaveBeenCalledTimes(1)

    const renderLoop = babylon.getRenderLoop()
    expect(renderLoop).not.toBeNull()

    renderLoop?.()
    expect(babylon.render).toHaveBeenCalledTimes(1)

    runtime.pause()
    renderLoop?.()
    expect(babylon.render).toHaveBeenCalledTimes(1)

    runtime.resume()
    renderLoop?.()
    expect(babylon.render).toHaveBeenCalledTimes(2)

    runtime.resize()
    expect(babylon.resize).toHaveBeenCalledTimes(1)

    runtime.dispose()
    expect(babylon.stopRenderLoop).toHaveBeenCalledTimes(1)
    expect(babylon.disposeScene).toHaveBeenCalledTimes(1)
    expect(babylon.disposeEngine).toHaveBeenCalledTimes(1)
  })

  it('caps initial DPR and applies a sustained quality downgrade without touching gameplay', async () => {
    setHardwareCapabilities({
      deviceMemory: 16,
      hardwareConcurrency: 12,
      devicePixelRatio: 2,
    })

    let now = 0
    vi.spyOn(performance, 'now').mockImplementation(() => now)

    const runtime = await createSchoolEscapeRuntime(createRuntimeOptions())

    expect(babylon.setHardwareScalingLevel).toHaveBeenCalledWith(1 / 1.75)

    const renderLoop = babylon.getRenderLoop()
    expect(renderLoop).not.toBeNull()

    for (let frame = 0; frame < 320; frame += 1) {
      now += 26
      renderLoop?.()
    }

    expect(babylon.setHardwareScalingLevel).toHaveBeenLastCalledWith(1 / 1.35)

    runtime.dispose()
  })

  it('resets frame timing on resume so background time cannot trigger a downgrade', async () => {
    setHardwareCapabilities({
      deviceMemory: 16,
      hardwareConcurrency: 12,
      devicePixelRatio: 2,
    })

    let now = 0
    vi.spyOn(performance, 'now').mockImplementation(() => now)

    const runtime = await createSchoolEscapeRuntime(createRuntimeOptions())
    const renderLoop = babylon.getRenderLoop()

    for (let frame = 0; frame < 190; frame += 1) {
      now += 16
      renderLoop?.()
    }

    expect(babylon.setHardwareScalingLevel).toHaveBeenCalledTimes(1)

    runtime.pause()
    now += 5_000
    runtime.resume()
    now += 16
    renderLoop?.()

    expect(babylon.setHardwareScalingLevel).toHaveBeenCalledTimes(1)
    expect(babylon.setHardwareScalingLevel).toHaveBeenLastCalledWith(1 / 1.75)

    runtime.dispose()
  })

  it('restarts adaptive quality as a fresh session at the hardware-selected tier', async () => {
    setHardwareCapabilities({
      deviceMemory: 16,
      hardwareConcurrency: 12,
      devicePixelRatio: 2,
    })

    let now = 0
    vi.spyOn(performance, 'now').mockImplementation(() => now)

    const runtime = await createSchoolEscapeRuntime(createRuntimeOptions())
    const renderLoop = babylon.getRenderLoop()

    for (let frame = 0; frame < 320; frame += 1) {
      now += 26
      renderLoop?.()
    }

    expect(babylon.setHardwareScalingLevel).toHaveBeenLastCalledWith(1 / 1.35)

    await runtime.restart()

    expect(babylon.setHardwareScalingLevel).toHaveBeenLastCalledWith(1 / 1.75)

    for (let frame = 0; frame < 120; frame += 1) {
      now += 35
      renderLoop?.()
    }

    expect(babylon.setHardwareScalingLevel).toHaveBeenLastCalledWith(1 / 1.75)

    runtime.dispose()
  })
})
