import { Engine } from '@babylonjs/core/Engines/engine'
import { Scene } from '@babylonjs/core/scene'
import type { SemanticInputReader } from '../shared/input/semanticInput'
import { SchoolEscapeCameraController } from './schoolEscapeCamera'
import type { LookInputReader, SchoolEscapeAction } from './schoolEscapeInput'
import {
  hasLineOfSight,
  nearestHideSurface,
  type HideSurfaceHit,
  type WorldPoint,
} from './schoolEscapeLevel'
import {
  camouflageVisibilityMultiplier,
  colorMatchScore,
  computeTeacherVisibility,
  displayedClothingColor,
} from './schoolEscapeLogic'
import { SchoolEscapePlayerController } from './schoolEscapePlayer'
import {
  QUALITY_SETTINGS,
  chooseInitialQuality,
  createQualityPolicyState,
  updateQualityPolicy,
  type QualityTier,
} from './schoolEscapeQuality'
import {
  SchoolEscapeTeacherController,
  type TeacherAlert as TeacherAlertState,
} from './schoolEscapeTeacher'
import { EMPTY_PAINT_MIX, type PaintMix } from './schoolEscapeTypes'

export type TeacherAlert = TeacherAlertState
export type SchoolEscapePhase = 'loading' | 'playing' | 'caught' | 'complete' | 'error'

export type SchoolEscapeUiSnapshot = Readonly<{
  nearbySurfaceId: string | null
  matchScore: number | null
  teacherAlert: TeacherAlert
  subtitle: string | null
  phase: SchoolEscapePhase
}>

export type SchoolEscapeRuntimeController = {
  setPaintMix(mix: PaintMix): void
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
  onUiSnapshot?(snapshot: SchoolEscapeUiSnapshot): void
}

type NavigatorWithDeviceMemory = Navigator & {
  deviceMemory?: number
}

const MAX_SIMULATION_DT = 1 / 15
const TEACHER_SIGHT_RANGE = 14
const UI_EMIT_INTERVAL_SECONDS = 0.1
const TEACHER_SUBTITLE_SECONDS = 2
const EPSILON = 1e-8

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

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function sanitizePaintMix(mix: PaintMix): PaintMix {
  return {
    red: clamp01(mix.red),
    yellow: clamp01(mix.yellow),
    blue: clamp01(mix.blue),
    white: clamp01(mix.white),
    black: clamp01(mix.black),
  }
}

function distanceXZ(from: WorldPoint, to: WorldPoint) {
  return Math.hypot(to.x - from.x, to.z - from.z)
}

function viewAlignment(
  teacherPosition: WorldPoint,
  teacherFacing: Readonly<{ x: number; z: number }>,
  playerPosition: WorldPoint,
) {
  const dx = playerPosition.x - teacherPosition.x
  const dz = playerPosition.z - teacherPosition.z
  const distance = Math.hypot(dx, dz)

  if (distance < EPSILON) {
    return 1
  }

  return (teacherFacing.x * dx + teacherFacing.z * dz) / distance
}

function sameUiSnapshot(
  left: SchoolEscapeUiSnapshot,
  right: SchoolEscapeUiSnapshot,
) {
  return (
    left.nearbySurfaceId === right.nearbySurfaceId &&
    left.matchScore === right.matchScore &&
    left.teacherAlert === right.teacherAlert &&
    left.subtitle === right.subtitle &&
    left.phase === right.phase
  )
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
  let player = new SchoolEscapePlayerController()
  let camera = new SchoolEscapeCameraController()
  let teacher = new SchoolEscapeTeacherController()
  let cameraYaw = 0
  let paintMix: PaintMix = { ...EMPTY_PAINT_MIX }
  let phase: SchoolEscapePhase = 'playing'
  let subtitleSeconds = 0
  let simulationElapsedSeconds = 0
  let lastUiEmitSeconds = 0
  let nearbySurface: HideSurfaceHit | null = null
  let matchScore: number | null = null
  let lastUiSnapshot: SchoolEscapeUiSnapshot = {
    nearbySurfaceId: null,
    matchScore: null,
    teacherAlert: 'none',
    subtitle: null,
    phase: 'playing',
  }

  const currentUiSnapshot = (): SchoolEscapeUiSnapshot => ({
    nearbySurfaceId: nearbySurface?.id ?? null,
    matchScore,
    teacherAlert: teacher.snapshot().alert,
    subtitle: subtitleSeconds > 0 ? 'Come back here!' : null,
    phase,
  })

  const emitUiSnapshot = (force = false) => {
    if (!options.onUiSnapshot) {
      return
    }

    const snapshot = currentUiSnapshot()
    const enoughTimeElapsed =
      simulationElapsedSeconds - lastUiEmitSeconds >= UI_EMIT_INTERVAL_SECONDS

    if (!force && (!enoughTimeElapsed || sameUiSnapshot(snapshot, lastUiSnapshot))) {
      return
    }

    lastUiSnapshot = snapshot
    lastUiEmitSeconds = simulationElapsedSeconds
    options.onUiSnapshot(snapshot)
  }

  const resetGameplaySession = () => {
    player = new SchoolEscapePlayerController()
    camera = new SchoolEscapeCameraController()
    teacher = new SchoolEscapeTeacherController()
    cameraYaw = 0
    paintMix = { ...EMPTY_PAINT_MIX }
    phase = 'playing'
    subtitleSeconds = 0
    simulationElapsedSeconds = 0
    lastUiEmitSeconds = 0
    nearbySurface = null
    matchScore = null
    lastUiSnapshot = currentUiSnapshot()
  }

  const resetQualitySession = () => {
    qualityState = createQualityPolicyState(
      chooseInitialQuality(readQualityCapabilities()),
    )
    previousFrameAt = performance.now()
    applyRenderQuality(engine, qualityState.tier)
  }

  const stepGameplay = (dt: number) => {
    if (phase !== 'playing') {
      return
    }

    simulationElapsedSeconds += dt
    subtitleSeconds = Math.max(0, subtitleSeconds - dt)

    const playerSnapshot = player.update(
      dt,
      {
        move: options.input.move,
        sprinting: options.input.isHeld('sprint'),
        jumpPressed: options.input.consumePress('jump'),
      },
      cameraYaw,
    )

    const cameraSnapshot = camera.update(
      dt,
      playerSnapshot,
      playerSnapshot.sprinting,
      options.look.consume(),
    )
    cameraYaw = cameraSnapshot.yaw

    nearbySurface = nearestHideSurface(playerSnapshot.position)
    matchScore = nearbySurface
      ? colorMatchScore(
          displayedClothingColor(paintMix),
          nearbySurface.canonicalColor,
        )
      : null

    const camouflageMultiplier = nearbySurface && matchScore !== null
      ? camouflageVisibilityMultiplier({
          match: matchScore,
          surfaceDistance: nearbySurface.distance,
          horizontalSpeed: playerSnapshot.horizontalSpeed,
          grounded: playerSnapshot.grounded,
        })
      : 1

    const teacherBefore = teacher.snapshot()
    const lineOfSight = hasLineOfSight(
      teacherBefore.position,
      playerSnapshot.position,
    )
    const visibility = computeTeacherVisibility({
      distance: distanceXZ(teacherBefore.position, playerSnapshot.position),
      sightRange: TEACHER_SIGHT_RANGE,
      viewAlignment: viewAlignment(
        teacherBefore.position,
        teacherBefore.facing,
        playerSnapshot.position,
      ),
      speed: playerSnapshot.horizontalSpeed,
      sprinting: playerSnapshot.sprinting,
      camouflageMultiplier,
      hasLineOfSight: lineOfSight,
    })
    const teacherSnapshot = teacher.update(dt, {
      playerPosition: playerSnapshot.position,
      visibility,
      hasLineOfSight: lineOfSight,
    })

    if (teacherSnapshot.events.shout) {
      subtitleSeconds = TEACHER_SUBTITLE_SECONDS
    }
    if (teacherSnapshot.events.caught) {
      phase = 'caught'
    } else if (teacherSnapshot.events.complete) {
      phase = 'complete'
    }

    emitUiSnapshot()
  }

  applyRenderQuality(engine, qualityState.tier)
  options.onUiSnapshot?.(lastUiSnapshot)

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

    const simulationDt = Math.min(frameTimeMs / 1000, MAX_SIMULATION_DT)

    try {
      stepGameplay(simulationDt)
      scene.render()
    } catch (error) {
      failed = true
      phase = 'error'
      emitUiSnapshot(true)
      options.onFatalError(toError(error))
    }
  }

  engine.runRenderLoop(renderFrame)

  return {
    setPaintMix(mix) {
      paintMix = sanitizePaintMix(mix)
    },
    resize() {
      if (!disposed) {
        applyRenderQuality(engine, qualityState.tier)
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
      options.look.reset()
      resetGameplaySession()
      resetQualitySession()
      emitUiSnapshot(true)
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
