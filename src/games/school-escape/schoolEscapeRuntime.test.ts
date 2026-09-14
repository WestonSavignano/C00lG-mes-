import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSemanticInput } from '../shared/input/semanticInput'
import { createLookAccumulator, type SchoolEscapeAction } from './schoolEscapeInput'
import { createSchoolEscapeRuntime } from './schoolEscapeRuntime'

const babylon = vi.hoisted(() => {
  const render = vi.fn()
  const disposeScene = vi.fn()
  const resize = vi.fn()
  const disposeEngine = vi.fn()
  const stopRenderLoop = vi.fn()
  let renderLoop: (() => void) | null = null

  const Engine = vi.fn(function EngineMock() {
    return {
      runRenderLoop(callback: () => void) {
        renderLoop = callback
      },
      stopRenderLoop,
      resize,
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
    getRenderLoop: () => renderLoop,
    resetRenderLoop: () => {
      renderLoop = null
    },
  }
})

vi.mock('@babylonjs/core/Engines/engine', () => ({ Engine: babylon.Engine }))
vi.mock('@babylonjs/core/scene', () => ({ Scene: babylon.Scene }))

describe('School Escape Babylon runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    babylon.resetRenderLoop()
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
})
