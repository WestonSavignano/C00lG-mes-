import type { LookDelta } from './schoolEscapeInput'
import type { SchoolEscapePlayerSnapshot } from './schoolEscapePlayer'
import type { WorldPoint } from './schoolEscapeLevel'

export type SchoolEscapeCameraSnapshot = Readonly<{
  position: WorldPoint
  target: WorldPoint
  yaw: number
  pitch: number
  distance: number
  fovDegrees: number
}>

const PREFERRED_DISTANCE = 4.5
const PIVOT_HEIGHT = 1.45
const NORMAL_FOV = 55
const SPRINT_FOV = 62
const YAW_SENSITIVITY = 0.0035
const PITCH_SENSITIVITY = 0.0028
const MIN_PITCH = -0.55
const MAX_PITCH = 0.85
const FOLLOW_SHARPNESS = 12
const FOV_SHARPNESS = 8
const DISTANCE_RETURN_SHARPNESS = 10
const OCCLUSION_PADDING = 0.25
const MIN_DISTANCE = 0.75
const MAX_FRAME_DT = 0.05

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function safeDt(dt: number) {
  return Number.isFinite(dt) ? clamp(dt, 0, MAX_FRAME_DT) : 0
}

function exponentialStep(current: number, target: number, sharpness: number, dt: number) {
  if (dt <= 0) {
    return current
  }
  const t = 1 - Math.exp(-sharpness * dt)
  return current + (target - current) * t
}

function exponentialPoint(
  current: WorldPoint,
  target: WorldPoint,
  sharpness: number,
  dt: number,
): WorldPoint {
  return {
    x: exponentialStep(current.x, target.x, sharpness, dt),
    y: exponentialStep(current.y, target.y, sharpness, dt),
    z: exponentialStep(current.z, target.z, sharpness, dt),
  }
}

export class SchoolEscapeCameraController {
  private yaw = 0
  private pitch = 0.18
  private distance = PREFERRED_DISTANCE
  private fovDegrees = NORMAL_FOV
  private target: WorldPoint | null = null

  update(
    dt: number,
    player: SchoolEscapePlayerSnapshot,
    sprinting: boolean,
    lookDelta: LookDelta,
    obstructionDistance: number | null = null,
  ): SchoolEscapeCameraSnapshot {
    const frameDt = safeDt(dt)
    const lookX = Number.isFinite(lookDelta.x) ? lookDelta.x : 0
    const lookY = Number.isFinite(lookDelta.y) ? lookDelta.y : 0

    this.yaw += lookX * YAW_SENSITIVITY
    this.pitch = clamp(
      this.pitch + lookY * PITCH_SENSITIVITY,
      MIN_PITCH,
      MAX_PITCH,
    )

    const desiredTarget: WorldPoint = {
      x: player.position.x,
      y: player.position.y + PIVOT_HEIGHT,
      z: player.position.z,
    }
    this.target = this.target
      ? exponentialPoint(this.target, desiredTarget, FOLLOW_SHARPNESS, frameDt)
      : desiredTarget

    const targetFov = sprinting ? SPRINT_FOV : NORMAL_FOV
    this.fovDegrees = exponentialStep(
      this.fovDegrees,
      targetFov,
      FOV_SHARPNESS,
      frameDt,
    )

    const hasObstruction =
      obstructionDistance !== null &&
      Number.isFinite(obstructionDistance) &&
      obstructionDistance >= 0
    const desiredDistance = hasObstruction
      ? clamp(
          (obstructionDistance as number) - OCCLUSION_PADDING,
          MIN_DISTANCE,
          PREFERRED_DISTANCE,
        )
      : PREFERRED_DISTANCE

    if (desiredDistance < this.distance) {
      // Pull inward immediately to prevent wall clipping. Ease outward so camera
      // recovery does not pop after clearing a doorway or corner.
      this.distance = desiredDistance
    } else {
      this.distance = exponentialStep(
        this.distance,
        desiredDistance,
        DISTANCE_RETURN_SHARPNESS,
        frameDt,
      )
    }

    const horizontalDistance = Math.cos(this.pitch) * this.distance
    const position: WorldPoint = {
      x: this.target.x - Math.sin(this.yaw) * horizontalDistance,
      y: this.target.y + Math.sin(this.pitch) * this.distance,
      z: this.target.z - Math.cos(this.yaw) * horizontalDistance,
    }

    return {
      position,
      target: { ...this.target },
      yaw: this.yaw,
      pitch: this.pitch,
      distance: this.distance,
      fovDegrees: this.fovDegrees,
    }
  }
}
