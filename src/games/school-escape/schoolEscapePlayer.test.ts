import { describe, expect, it } from 'vitest'
import { GOLDEN_SLICE_LEVEL } from './schoolEscapeLevel'
import {
  PLAYER_MOVE_SPEED,
  PLAYER_SPRINT_SPEED,
} from './schoolEscapeTypes'
import {
  SchoolEscapePlayerController,
  type SchoolEscapeFrameInput,
} from './schoolEscapePlayer'

const idleInput: SchoolEscapeFrameInput = {
  move: { x: 0, y: 0 },
  sprinting: false,
  jumpPressed: false,
}

function stepMany(
  controller: SchoolEscapePlayerController,
  input: SchoolEscapeFrameInput,
  frames = 120,
  cameraYaw = 0,
) {
  let snapshot = controller.snapshot()
  for (let index = 0; index < frames; index += 1) {
    snapshot = controller.update(1 / 60, input, cameraYaw)
  }
  return snapshot
}

describe('SchoolEscapePlayerController', () => {
  it('moves camera-relative with responsive acceleration', () => {
    const controller = new SchoolEscapePlayerController()
    const snapshot = controller.update(
      1 / 60,
      { ...idleInput, move: { x: 0, y: -1 } },
      0,
    )

    expect(snapshot.position.z).toBeGreaterThan(GOLDEN_SLICE_LEVEL.playerSpawn.z)
    expect(snapshot.horizontalSpeed).toBeGreaterThan(0)
    expect(snapshot.horizontalSpeed).toBeLessThanOrEqual(PLAYER_MOVE_SPEED)
  })

  it('reaches a faster sprint while preserving the approved speed cap', () => {
    const walk = new SchoolEscapePlayerController()
    const sprint = new SchoolEscapePlayerController()

    const walking = stepMany(walk, {
      ...idleInput,
      move: { x: 0, y: -1 },
    })
    const sprinting = stepMany(sprint, {
      ...idleInput,
      move: { x: 0, y: -1 },
      sprinting: true,
    })

    expect(walking.horizontalSpeed).toBeCloseTo(PLAYER_MOVE_SPEED, 4)
    expect(sprinting.horizontalSpeed).toBeCloseTo(PLAYER_SPRINT_SPEED, 4)
    expect(sprinting.horizontalSpeed).toBeGreaterThan(walking.horizontalSpeed)
  })

  it('jumps, applies gravity, and lands back on the floor', () => {
    const controller = new SchoolEscapePlayerController()

    const takeoff = controller.update(
      1 / 60,
      { ...idleInput, jumpPressed: true },
      0,
    )
    expect(takeoff.grounded).toBe(false)
    expect(takeoff.velocity.y).toBeGreaterThan(0)

    const landed = stepMany(controller, idleInput, 120)
    expect(landed.grounded).toBe(true)
    expect(landed.position.y).toBe(0)
    expect(landed.velocity.y).toBe(0)
  })

  it('uses the golden-slice collision geometry instead of tunneling through walls', () => {
    const controller = new SchoolEscapePlayerController({ x: 1, y: 0, z: 8 })

    const snapshot = stepMany(
      controller,
      { ...idleInput, move: { x: 1, y: 0 }, sprinting: true },
      90,
    )

    expect(snapshot.position.x).toBeLessThanOrEqual(1.1)
  })

  it('caps unusually long frame deltas before integrating movement', () => {
    const controller = new SchoolEscapePlayerController()
    const snapshot = controller.update(
      1,
      { ...idleInput, move: { x: 0, y: -1 }, sprinting: true },
      0,
    )

    expect(snapshot.position.z - GOLDEN_SLICE_LEVEL.playerSpawn.z).toBeLessThan(0.3)
  })
})
