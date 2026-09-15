import { Engine } from '@babylonjs/core/Engines/engine'
import { Scene } from '@babylonjs/core/scene'
import type { SemanticInputReader } from '../shared/input/semanticInput'
import type { LookInputReader, SchoolEscapeAction } from './schoolEscapeInput'
import {
  QUALITY_SETTINGS,
  chooseInitialQuality,
  createQualityPolicyState,
  updateQualityPolicy,
  type QualityTier,
} from './schoolEscapeQuality'

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

type NavigatorWithDeviceMemory = Navigator & {
  deviceMemory?: number
}

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error))
}

function readQualityCapabilities() {
  const browserNavigator = navigator as NavigatorWithDeviceMemory

  return {
    deviceMemory: browserNavigator.deviceMemory,
    hardwareConcurrency: browserNavigator.hardwareConcurrency,
    devicePixelRatio: window.devicePixelRatio,
  }
}

function applyRenderQuality(engine: Engine, tier: QualityTier) {
  const devicePixelRatio =
    Number.isFinite(window.devicePixelRatio) && window.devicePixelRatio > 0
      ? window.devicePixelRatio
      : 1
  const cappedDpr = Math.min(devicePixelRatio, QUALITY_SETTINGS[tier].dprCap)

  engine.setHardwareScalingLevel(1 / cappedDpr)
}

export async function createSchoolEscapeRuntime(
  options: SchoolEscapeRuntimeOptions,
): Promise<SchoolEscapeRuntimeController> {
  const engine = new Engine(options.canvas, true)
  const scene = new Scene(engine)
  let disposed = false
  let paused = false
  let failed = false
  let qualityState = createQualityPolicyState(
    chooseInitialQuality(readQualityCapabilities()),
  )
  let previousFrameAt = performance.now()

  const resetQualitySession = () => {
    qualityState = createQualityPolicyState(
      chooseInitialQuality(readQualityCapabilities()),
    )
    previousFrameAt = performance.now()
    applyRenderQuality(engine, qualityState.tier)
  }

  applyRenderQuality(engine, qualityState.tier)

  const renderFrame = () => {
    if (disposed || paused || failed) {
      return
    }

    const frameAt = performance.now()
    const frameTimeMs = Math.max(0, frameAt - previousFrameAt)
    previousFrameAt = frameAt
    const previousTier = qualityState.tier

    qualityState = updateQualityPolicy(qualityState, {
      frameTimeMs,
      dt: frameTimeMs / 1000,
    })

    if (qualityState.tier !== previousTier) {
      applyRenderQuality(engine, qualityState.tier)
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
        previousFrameAt = performance.now()
        paused = false
      }
    },
    async restart() {
      if (disposed) {
        return
      }

      failed = false
      paused = false
      resetQualitySession()
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
