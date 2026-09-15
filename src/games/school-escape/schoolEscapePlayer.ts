import {
  GOLDEN_SLICE_LEVEL,
  resolvePlayerCollision,
  type WorldPoint,
} from './schoolEscapeLevel'
import {
  PLAYER_MOVE_SPEED,
  PLAYER_SPRINT_SPEED,
} from './schoolEscapeTypes'

export type SchoolEscapeFrameInput = Readonly<{
  move: Readonly<{ x: number; y: number }>
  sprinting: boolean
  jumpPressed: boolean
}>

export type SchoolEscapePlayerSnapshot = Readonly<{
  position: WorldPoint
  velocity: WorldPoint
  grounded: boolean
  horizontalSpeed: number
  sprinting: boolean
}>

const ACCELERATION = 16
const DECELERATION = 20
const JUMP_VELOCITY = 5.2
const GRAVITY = -14
const MAX_FRAME_DT = 0.05
const EPSILON = 1e-8

function clampFrameDt(dt: number) {
  if (!Number.isFinite(dt)) {
    return 0
  }
  return Math.max(0, Math.min(MAX_FRAME_DT, dt))
}

function safeAxis(value: number) {
  return Number.isFinite(value) ? value : 0
}

function approachVelocity(
  currentX: number,
  currentZ: number,
  targetX: number,
  targetZ: number,
  maxDelta: number,
) {
  const dx = targetX - currentX
  const dz = targetZ - currentZ
  const distance = Math.hypot(dx, dz)

  if (distance <= maxDelta || distance < EPSILON) {
    return { x: targetX, z: targetZ }
  }

  const scale = maxDelta / distance
  return {
    x: currentX + dx * scale,
    z: currentZ + dz * scale,
  }
}

export class SchoolEscapePlayerController {
  private position: { x: number; y: number; z: number }
  private velocity = { x: 0, y: 0, z: 0 }
  private grounded = true
  private sprinting = false

  constructor(start: WorldPoint = GOLDEN_SLICE_LEVEL.playerSpawn) {
    this.position = { ...start }
    this.grounded = start.y <= 0
  }

  snapshot(): SchoolEscapePlayerSnapshot {
    return {
      position: { ...this.position },
      velocity: { ...this.velocity },
      grounded: this.grounded,
      horizontalSpeed: Math.hypot(this.velocity.x, this.velocity.z),
      sprinting: this.sprinting,
    }
  }

  update(
    dt: number,
    input: SchoolEscapeFrameInput,
    cameraYaw: number,
  ): SchoolEscapePlayerSnapshot {
    const frameDt = clampFrameDt(dt)
    const moveX = safeAxis(input.move.x)
    const moveY = safeAxis(input.move.y)
    const rawMagnitude = Math.hypot(moveX, moveY)
    const analogMagnitude = Math.min(1, rawMagnitude)
    const hasMovement = rawMagnitude > EPSILON
    const yaw = Number.isFinite(cameraYaw) ? cameraYaw : 0

    let directionX = 0
    let directionZ = 0

    if (hasMovement) {
      const normalizedX = moveX / rawMagnitude
      const normalizedY = moveY / rawMagnitude
      const forwardX = Math.sin(yaw)
      const forwardZ = Math.cos(yaw)
      const rightX = Math.cos(yaw)
      const rightZ = -Math.sin(yaw)

      directionX = rightX * normalizedX + forwardX * -normalizedY
      directionZ = rightZ * normalizedX + forwardZ * -normalizedY
    }

    this.sprinting = Boolean(input.sprinting && hasMovement)
    const speedLimit = this.sprinting ? PLAYER_SPRINT_SPEED : PLAYER_MOVE_SPEED
    const targetSpeed = speedLimit * analogMagnitude
    const targetX = directionX * targetSpeed
    const targetZ = directionZ * targetSpeed
    const acceleration = hasMovement ? ACCELERATION : DECELERATION
    const horizontal = approachVelocity(
      this.velocity.x,
      this.velocity.z,
      targetX,
      targetZ,
      acceleration * frameDt,
    )

    this.velocity.x = horizontal.x
    this.velocity.z = horizontal.z

    if (this.grounded && input.jumpPressed) {
      this.velocity.y = JUMP_VELOCITY
      this.grounded = false
    }

    if (!this.grounded) {
      this.velocity.y += GRAVITY * frameDt
    }

    const desiredPosition = {
      x: this.position.x + this.velocity.x * frameDt,
      y: this.position.y + this.velocity.y * frameDt,
      z: this.position.z + this.velocity.z * frameDt,
    }

    if (desiredPosition.y <= 0) {
      desiredPosition.y = 0
      this.velocity.y = 0
      this.grounded = true
    }

    const collisionResolved = resolvePlayerCollision(
      desiredPosition,
      GOLDEN_SLICE_LEVEL.playerRadius,
    )

    if (collisionResolved.x !== desiredPosition.x) {
      this.velocity.x = 0
    }
    if (collisionResolved.z !== desiredPosition.z) {
      this.velocity.z = 0
    }

    this.position = { ...collisionResolved }
    return this.snapshot()
  }
}
