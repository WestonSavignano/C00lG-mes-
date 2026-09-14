import { Engine } from '@babylonjs/core/Engines/engine'
import { Scene } from '@babylonjs/core/scene'
import type { SemanticInputReader } from '../shared/input/semanticInput'
import type { LookInputReader, SchoolEscapeAction } from './schoolEscapeInput'

export type SchoolEscapeRuntimeController = {
  resize(): void
  pause(): void
  resume(): void
  restart(): Promise<void>
  dispose(): void
}

export type SchoolEscapeRuntimeOptions = {
  canvas: HTMLCanvasElement
  input: SemanticInputReader<SchoolEscapeAction>
  look: LookInputReader
  onFatalError(error: Error): void
}

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error))
}

export async function createSchoolEscapeRuntime(
  options: SchoolEscapeRuntimeOptions,
): Promise<SchoolEscapeRuntimeController> {
  const engine = new Engine(options.canvas, true)
  const scene = new Scene(engine)
  let disposed = false
  let paused = false
  let failed = false

  const renderFrame = () => {
    if (disposed || paused || failed) {
      return
    }

    try {
      scene.render()
    } catch (error) {
      failed = true
      options.onFatalError(toError(error))
    }
  }

  engine.runRenderLoop(renderFrame)

  return {
    resize() {
      if (!disposed) {
        engine.resize()
      }
    },
    pause() {
      paused = true
    },
    resume() {
      if (!disposed && !failed) {
        paused = false
      }
    },
    async restart() {
      if (disposed) {
        return
      }

      failed = false
      paused = false
    },
    dispose() {
      if (disposed) {
        return
      }

      disposed = true
      engine.stopRenderLoop()
      scene.dispose()
      engine.dispose()
    },
  }
}
