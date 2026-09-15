import { describe, expect, it } from 'vitest'
import type { SchoolEscapePlayerSnapshot } from './schoolEscapePlayer'
import { SchoolEscapeCameraController } from './schoolEscapeCamera'

const player: SchoolEscapePlayerSnapshot = {
  position: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
  grounded: true,
  horizontalSpeed: 0,
  sprinting: false,
}

describe('SchoolEscapeCameraController', () => {
  it('orbits from look input while clamping pitch', () => {
    const camera = new SchoolEscapeCameraController()

    const moved = camera.update(1 / 60, player, false, { x: 100, y: 1000 })

    expect(moved.yaw).toBeCloseTo(0.35, 4)
    expect(moved.pitch).toBeLessThanOrEqual(0.85)
  })

  it('trails behind the player at the preferred distance with an elevated pivot', () => {
    const camera = new SchoolEscapeCameraController()
    const snapshot = camera.update(1 / 60, player, false, { x: 0, y: 0 })

    expect(snapshot.target.y).toBeGreaterThan(player.position.y)
    expect(snapshot.distance).toBeCloseTo(4.5, 4)
    expect(snapshot.position.z).toBeLessThan(snapshot.target.z)
  })

  it('widens FOV while sprinting and eases back afterward', () => {
    const camera = new SchoolEscapeCameraController()
    let sprintFov = 0

    for (let index = 0; index < 60; index += 1) {
      sprintFov = camera.update(
        1 / 60,
        player,
        true,
        { x: 0, y: 0 },
      ).fovDegrees
    }

    expect(sprintFov).toBeGreaterThan(60)
    expect(sprintFov).toBeLessThanOrEqual(62)

    const relaxed = camera.update(1 / 60, player, false, { x: 0, y: 0 })
    expect(relaxed.fovDegrees).toBeLessThan(sprintFov)
  })

  it('pulls inward before an obstruction and returns toward the preferred distance', () => {
    const camera = new SchoolEscapeCameraController()

    const occluded = camera.update(
      1 / 30,
      player,
      false,
      { x: 0, y: 0 },
      2.2,
    )
    expect(occluded.distance).toBeLessThan(4.5)
    expect(occluded.distance).toBeLessThanOrEqual(1.95)

    let clear = occluded
    for (let index = 0; index < 90; index += 1) {
      clear = camera.update(1 / 60, player, false, { x: 0, y: 0 }, null)
    }
    expect(clear.distance).toBeCloseTo(4.5, 2)
  })
})
