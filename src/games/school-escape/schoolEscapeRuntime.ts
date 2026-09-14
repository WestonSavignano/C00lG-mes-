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
  _options: SchoolEscapeRuntimeOptions,
): Promise<SchoolEscapeRuntimeController> {
  let disposed = false

  return {
    resize() {},
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
