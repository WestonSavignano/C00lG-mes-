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

export async function createSchoolEscapeRuntime(
  options: SchoolEscapeRuntimeOptions,
): Promise<SchoolEscapeRuntimeController> {
  const { canvas } = options
  let disposed = false

  const resize = () => {
    if (disposed) {
      return
    }

    const width = Math.max(1, Math.round(canvas.clientWidth || canvas.width || 1))
    const height = Math.max(1, Math.round(canvas.clientHeight || canvas.height || 1))

    if (canvas.width !== width) {
      canvas.width = width
    }
    if (canvas.height !== height) {
      canvas.height = height
    }
  }

  resize()

  return {
    resize,
    pause() {},
    resume() {},
    async restart() {
      if (disposed) {
        return
      }
    },
    dispose() {
      disposed = true
    },
  }
}
