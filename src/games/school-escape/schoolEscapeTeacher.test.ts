import { describe, expect, it } from 'vitest'
import { GOLDEN_SLICE_LEVEL, type WorldPoint } from './schoolEscapeLevel'
import { SchoolEscapeTeacherController } from './schoolEscapeTeacher'

function perception(
  playerPosition: WorldPoint,
  overrides: Partial<{
    visibility: number
    hasLineOfSight: boolean
  }> = {},
) {
  return {
    playerPosition,
    visibility: 0,
    hasLineOfSight: false,
    ...overrides,
  }
}

function finishNearMiss(controller: SchoolEscapeTeacherController) {
  controller.update(
    0.05,
    perception({ x: 0, y: 0, z: GOLDEN_SLICE_LEVEL.nearMissTriggerZ + 0.1 }),
  )

  for (let frame = 0; frame < 160; frame += 1) {
    controller.update(0.05, perception({ x: 0, y: 0, z: 10 }))
  }
}

describe('SchoolEscapeTeacherController', () => {
  it('waits off-screen, emits one approaching event, and traverses the authored near-miss path', () => {
    const controller = new SchoolEscapeTeacherController()

    const waiting = controller.update(
      0.05,
      perception({ x: 0, y: 0, z: GOLDEN_SLICE_LEVEL.nearMissTriggerZ - 0.1 }),
    )

    expect(waiting.position).toEqual(GOLDEN_SLICE_LEVEL.teacherStart)
    expect(waiting.animation).toBe('Idle')
    expect(waiting.events.teacherApproaching).toBe(false)

    const started = controller.update(
      0.05,
      perception({ x: 0, y: 0, z: GOLDEN_SLICE_LEVEL.nearMissTriggerZ + 0.1 }),
    )

    expect(started.nearMissStarted).toBe(true)
    expect(started.events.teacherApproaching).toBe(true)
    expect(started.position.x).toBeGreaterThan(GOLDEN_SLICE_LEVEL.teacherStart.x)
    expect(started.animation).toBe('Walk')

    const next = controller.update(0.05, perception({ x: 0, y: 0, z: 10 }))
    expect(next.events.teacherApproaching).toBe(false)

    finishNearMiss(controller)
    const resolved = controller.snapshot()
    const endpoint = GOLDEN_SLICE_LEVEL.teacherPatrolPoints.at(-1)

    expect(resolved.nearMissResolved).toBe(true)
    expect(resolved.position).toEqual(endpoint)
    expect(resolved.animation).toBe('Idle')
  })

  it('chases the last visible player position, shouts only on entry, and catches only inside the catch radius', () => {
    const controller = new SchoolEscapeTeacherController()
    const player = { x: -4, y: 0, z: 20 }

    const chase = controller.update(
      0.05,
      perception(player, { visibility: 0.9, hasLineOfSight: true }),
    )

    expect(chase.teacher.state).toBe('chase')
    expect(chase.events.shout).toBe(true)
    expect(chase.events.alertChanged).toBe('alert')
    expect(chase.events.caught).toBe(false)
    expect(chase.animation).toBe('Run')
    expect(chase.position.x).toBeGreaterThan(GOLDEN_SLICE_LEVEL.teacherStart.x)

    const lostSight = controller.update(
      0.05,
      perception({ x: 6, y: 0, z: 14 }, { visibility: 0, hasLineOfSight: false }),
    )

    expect(lostSight.events.shout).toBe(false)
    expect(lostSight.position.x).toBeGreaterThan(chase.position.x)
    expect(lostSight.position.x).toBeLessThanOrEqual(player.x)

    let caught = false
    for (let frame = 0; frame < 80; frame += 1) {
      const update = controller.update(
        0.05,
        perception(player, { visibility: 0.9, hasLineOfSight: true }),
      )
      caught ||= update.events.caught
      if (caught) {
        break
      }
    }

    expect(caught).toBe(true)
  })

  it('moves from chase through search and recovery back to patrol after LOS stays broken', () => {
    const controller = new SchoolEscapeTeacherController()
    const visiblePlayer = { x: 0, y: 0, z: 20 }

    controller.update(
      0.05,
      perception(visiblePlayer, { visibility: 0.9, hasLineOfSight: true }),
    )

    let snapshot = controller.snapshot()
    for (let frame = 0; frame < 30; frame += 1) {
      snapshot = controller.update(
        0.05,
        perception({ x: 4, y: 0, z: 14 }),
      )
    }

    expect(snapshot.teacher.state).toBe('search')
    expect(snapshot.animation).toBe('Search')

    for (let frame = 0; frame < 110; frame += 1) {
      snapshot = controller.update(
        0.05,
        perception({ x: 4, y: 0, z: 14 }),
      )
    }

    expect(snapshot.teacher.state).toBe('recover')
    expect(snapshot.animation).toBe('Recover')

    for (let frame = 0; frame < 35; frame += 1) {
      snapshot = controller.update(
        0.05,
        perception({ x: 4, y: 0, z: 14 }),
      )
    }

    expect(snapshot.teacher.state).toBe('patrol')
    expect(snapshot.alert).toBe('none')
  })

  it('emits golden-slice completion once only after the near-miss has resolved', () => {
    const controller = new SchoolEscapeTeacherController()
    const completionPosition = { x: 3, y: 0, z: 17.8 }

    const tooEarly = controller.update(0.05, perception(completionPosition))
    expect(tooEarly.events.complete).toBe(false)

    finishNearMiss(controller)

    const complete = controller.update(0.05, perception(completionPosition))
    expect(complete.nearMissResolved).toBe(true)
    expect(complete.events.complete).toBe(true)

    const repeated = controller.update(0.05, perception(completionPosition))
    expect(repeated.events.complete).toBe(false)
  })
})
