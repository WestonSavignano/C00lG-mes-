import {
  GOLDEN_SLICE_LEVEL,
  crossedNearMissTrigger,
  isInsideCompletionTrigger,
  type WorldPoint,
} from './schoolEscapeLevel'
import { updateTeacherState } from './schoolEscapeLogic'
import {
  TEACHER_CHASE_SPEED,
  TEACHER_PATROL_SPEED,
  type TeacherSnapshot,
  type TeacherState,
} from './schoolEscapeTypes'

export type TeacherAlert = 'none' | 'suspicious' | 'alert'

export type TeacherAnimation =
  | 'Idle'
  | 'Walk'
  | 'Suspicious'
  | 'Search'
  | 'Run'
  | 'Recover'

export type TeacherEncounterPerception = Readonly<{
  playerPosition: WorldPoint
  visibility: number
  hasLineOfSight: boolean
}>

export type TeacherEncounterEvents = Readonly<{
  teacherApproaching: boolean
  shout: boolean
  caught: boolean
  alertChanged: TeacherAlert | null
  complete: boolean
}>

export type SchoolEscapeTeacherSnapshot = Readonly<{
  position: WorldPoint
  facing: Readonly<{ x: number; z: number }>
  teacher: TeacherSnapshot
  alert: TeacherAlert
  animation: TeacherAnimation
  nearMissStarted: boolean
  nearMissResolved: boolean
  events: TeacherEncounterEvents
}>

const MAX_FRAME_DT = 0.05
const CATCH_RADIUS = 0.7
const TRACKING_VISIBILITY = 0.08
const EPSILON = 1e-8

const PATROL: TeacherSnapshot = {
  state: 'patrol',
  suspicion: 0,
  lostSightFor: 0,
  stateElapsed: 0,
  shout: false,
}

const NO_EVENTS: TeacherEncounterEvents = {
  teacherApproaching: false,
  shout: false,
  caught: false,
  alertChanged: null,
  complete: false,
}

function clampFrameDt(dt: number) {
  if (!Number.isFinite(dt)) {
    return 0
  }

  return Math.max(0, Math.min(MAX_FRAME_DT, dt))
}

function alertForState(state: TeacherState): TeacherAlert {
  if (state === 'chase') {
    return 'alert'
  }

  if (state === 'suspicious' || state === 'search') {
    return 'suspicious'
  }

  return 'none'
}

function animationForState(state: TeacherState, moved: boolean): TeacherAnimation {
  if (state === 'chase') {
    return 'Run'
  }

  if (state === 'suspicious') {
    return 'Suspicious'
  }

  if (state === 'search') {
    return 'Search'
  }

  if (state === 'recover') {
    return 'Recover'
  }

  return moved ? 'Walk' : 'Idle'
}

function distanceXZ(left: WorldPoint, right: WorldPoint) {
  return Math.hypot(right.x - left.x, right.z - left.z)
}

function moveToward(
  position: WorldPoint,
  target: WorldPoint,
  maxDistance: number,
) {
  const dx = target.x - position.x
  const dz = target.z - position.z
  const distance = Math.hypot(dx, dz)

  if (distance < EPSILON) {
    return {
      position: { ...target },
      moved: false,
      reached: true,
      facing: null,
    } as const
  }

  const step = Math.min(distance, Math.max(0, maxDistance))
  const reached = step >= distance - EPSILON
  const scale = step / distance

  return {
    position: reached
      ? { ...target }
      : {
          x: position.x + dx * scale,
          y: position.y + (target.y - position.y) * scale,
          z: position.z + dz * scale,
        },
    moved: step > EPSILON,
    reached,
    facing: {
      x: dx / distance,
      z: dz / distance,
    },
  } as const
}

export class SchoolEscapeTeacherController {
  private position: WorldPoint = { ...GOLDEN_SLICE_LEVEL.teacherStart }
  private facing = { x: 1, z: 0 }
  private teacher: TeacherSnapshot = { ...PATROL }
  private animation: TeacherAnimation = 'Idle'
  private previousPlayerZ = GOLDEN_SLICE_LEVEL.playerSpawn.z
  private nearMissStarted = false
  private nearMissResolved = false
  private patrolWaypointIndex = 1
  private searchWaypointIndex = 0
  private lastKnownPlayerPosition: WorldPoint | null = null
  private caughtEmitted = false
  private completionEmitted = false

  snapshot(): SchoolEscapeTeacherSnapshot {
    return this.buildSnapshot(NO_EVENTS)
  }

  update(
    dt: number,
    perception: TeacherEncounterPerception,
  ): SchoolEscapeTeacherSnapshot {
    const frameDt = clampFrameDt(dt)
    const previousAlert = alertForState(this.teacher.state)
    const previousState = this.teacher.state
    let teacherApproaching = false

    if (
      !this.nearMissStarted &&
      crossedNearMissTrigger(this.previousPlayerZ, perception.playerPosition.z)
    ) {
      this.nearMissStarted = true
      teacherApproaching = true
    }
    this.previousPlayerZ = perception.playerPosition.z

    this.teacher = updateTeacherState(this.teacher, {
      visibility: perception.visibility,
      hasLineOfSight: perception.hasLineOfSight,
      dt: frameDt,
    })

    if (
      perception.hasLineOfSight &&
      perception.visibility >= TRACKING_VISIBILITY
    ) {
      this.lastKnownPlayerPosition = { ...perception.playerPosition }
    }

    if (previousState !== 'search' && this.teacher.state === 'search') {
      this.searchWaypointIndex = 0
    }

    let moved = false

    if (this.teacher.state === 'chase') {
      const target = this.lastKnownPlayerPosition
      if (target) {
        moved = this.moveToward(target, TEACHER_CHASE_SPEED * frameDt).moved
      }
    } else if (this.teacher.state === 'search') {
      const points = GOLDEN_SLICE_LEVEL.teacherSearchPoints
      const target = points[this.searchWaypointIndex]
      const movement = this.moveToward(target, TEACHER_PATROL_SPEED * frameDt)
      moved = movement.moved

      if (movement.reached) {
        this.searchWaypointIndex = (this.searchWaypointIndex + 1) % points.length
      }
    } else if (
      this.teacher.state === 'patrol' &&
      this.nearMissStarted &&
      !this.nearMissResolved
    ) {
      const points = GOLDEN_SLICE_LEVEL.teacherPatrolPoints
      const target = points[this.patrolWaypointIndex]
      const movement = this.moveToward(target, TEACHER_PATROL_SPEED * frameDt)
      moved = movement.moved

      if (movement.reached) {
        if (this.patrolWaypointIndex >= points.length - 1) {
          this.nearMissResolved = true
        } else {
          this.patrolWaypointIndex += 1
        }
      }
    }

    this.animation = animationForState(this.teacher.state, moved)

    const caught =
      !this.caughtEmitted &&
      this.teacher.state === 'chase' &&
      distanceXZ(this.position, perception.playerPosition) <= CATCH_RADIUS
    if (caught) {
      this.caughtEmitted = true
    }

    const complete =
      !this.completionEmitted &&
      this.nearMissResolved &&
      this.teacher.state === 'patrol' &&
      isInsideCompletionTrigger(perception.playerPosition)
    if (complete) {
      this.completionEmitted = true
    }

    const alert = alertForState(this.teacher.state)
    const alertChanged = alert === previousAlert ? null : alert

    return this.buildSnapshot({
      teacherApproaching,
      shout: this.teacher.shout,
      caught,
      alertChanged,
      complete,
    })
  }

  private moveToward(target: WorldPoint, maxDistance: number) {
    const movement = moveToward(this.position, target, maxDistance)
    this.position = movement.position
    if (movement.facing) {
      this.facing = movement.facing
    }
    return movement
  }

  private buildSnapshot(events: TeacherEncounterEvents): SchoolEscapeTeacherSnapshot {
    return {
      position: { ...this.position },
      facing: { ...this.facing },
      teacher: { ...this.teacher },
      alert: alertForState(this.teacher.state),
      animation: this.animation,
      nearMissStarted: this.nearMissStarted,
      nearMissResolved: this.nearMissResolved,
      events: { ...events },
    }
  }
}
