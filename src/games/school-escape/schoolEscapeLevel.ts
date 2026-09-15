import type { SrgbColor } from './schoolEscapeTypes'

export type WorldPoint = Readonly<{ x: number; y: number; z: number }>
export type XzBounds = Readonly<{
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}>
export type CollisionRect = XzBounds & Readonly<{ id: string }>
export type HideSurface = Readonly<{
  id: string
  center: WorldPoint
  normal: Readonly<{ x: number; y: number; z: number }>
  halfWidth: number
  halfHeight: number
  canonicalColor: SrgbColor
}>
export type HideSurfaceHit = HideSurface & Readonly<{ distance: number }>

const PLAYER_RADIUS = 0.35
const MAX_HIDE_DISTANCE = 0.8
const EPSILON = 1e-8

const classroomBounds: XzBounds = {
  minX: -4,
  maxX: 4,
  minZ: -5,
  maxZ: 4,
}

const hallwayBounds: XzBounds = {
  minX: -1.6,
  maxX: 1.6,
  minZ: 4,
  maxZ: 24,
}

const lockerBayBounds: XzBounds = {
  minX: 1.6,
  maxX: 5.6,
  minZ: 11.5,
  maxZ: 18.5,
}

const collisionRects: readonly CollisionRect[] = [
  { id: 'classroom-back', minX: -4.25, maxX: 4.25, minZ: -5.25, maxZ: -4.85 },
  { id: 'classroom-left', minX: -4.25, maxX: -3.85, minZ: -5.25, maxZ: 4.25 },
  { id: 'classroom-right', minX: 3.85, maxX: 4.25, minZ: -5.25, maxZ: 4.25 },
  { id: 'classroom-front-left', minX: -4.25, maxX: -1.2, minZ: 3.85, maxZ: 4.25 },
  { id: 'classroom-front-right', minX: 1.2, maxX: 4.25, minZ: 3.85, maxZ: 4.25 },

  { id: 'hall-left-lower', minX: -1.85, maxX: -1.45, minZ: 3.85, maxZ: 19.1 },
  { id: 'hall-left-upper', minX: -1.85, maxX: -1.45, minZ: 20.9, maxZ: 24.25 },
  { id: 'hall-right-lower', minX: 1.45, maxX: 1.85, minZ: 3.85, maxZ: 11.3 },
  { id: 'hall-right-after-lockers', minX: 1.45, maxX: 1.85, minZ: 18.7, maxZ: 19.1 },
  { id: 'hall-right-upper', minX: 1.45, maxX: 1.85, minZ: 20.9, maxZ: 24.25 },
  { id: 'hall-end', minX: -1.85, maxX: 1.85, minZ: 23.85, maxZ: 24.25 },

  { id: 'locker-right', minX: 5.4, maxX: 5.8, minZ: 11.3, maxZ: 18.7 },
  { id: 'locker-south', minX: 1.45, maxX: 5.8, minZ: 11.3, maxZ: 11.7 },
  { id: 'locker-north', minX: 1.45, maxX: 5.8, minZ: 18.3, maxZ: 18.7 },

  { id: 'cross-south-left', minX: -7.25, maxX: -1.2, minZ: 19.1, maxZ: 19.45 },
  { id: 'cross-south-right', minX: 1.2, maxX: 7.25, minZ: 19.1, maxZ: 19.45 },
  { id: 'cross-north-left', minX: -7.25, maxX: -1.2, minZ: 20.55, maxZ: 20.9 },
  { id: 'cross-north-right', minX: 1.2, maxX: 7.25, minZ: 20.55, maxZ: 20.9 },
  { id: 'cross-left-end', minX: -7.5, maxX: -7.2, minZ: 19.1, maxZ: 20.9 },
  { id: 'cross-right-end', minX: 7.2, maxX: 7.5, minZ: 19.1, maxZ: 20.9 },
]

const hideSurfaces: readonly HideSurface[] = [
  {
    id: 'locker-blue',
    center: { x: 5.45, y: 1, z: 14.7 },
    normal: { x: -1, y: 0, z: 0 },
    halfWidth: 2.2,
    halfHeight: 1.25,
    canonicalColor: { r: 0.12, g: 0.3, b: 0.54 },
  },
  {
    id: 'classroom-green',
    center: { x: -3.85, y: 1, z: 0.8 },
    normal: { x: 1, y: 0, z: 0 },
    halfWidth: 2.1,
    halfHeight: 1.25,
    canonicalColor: { r: 0.22, g: 0.43, b: 0.31 },
  },
]

const teacherPatrolPoints: readonly WorldPoint[] = [
  { x: -7, y: 0, z: 20 },
  { x: -3.5, y: 0, z: 20 },
  { x: 0, y: 0, z: 20 },
  { x: 3.5, y: 0, z: 20 },
  { x: 7, y: 0, z: 20 },
]

const teacherSearchPoints: readonly WorldPoint[] = [
  { x: 0, y: 0, z: 20 },
  { x: 0, y: 0, z: 16 },
  { x: 3.8, y: 0, z: 15 },
  { x: 0, y: 0, z: 13.5 },
]

export const GOLDEN_SLICE_LEVEL = {
  playerRadius: PLAYER_RADIUS,
  playerSpawn: { x: 0, y: 0, z: -2.5 } as WorldPoint,
  classroomBounds,
  hallwayBounds,
  lockerBayBounds,
  teacherStart: teacherPatrolPoints[0],
  teacherPatrolPoints,
  teacherSearchPoints,
  nearMissTriggerZ: 8,
  completionTrigger: {
    minX: 1.8,
    maxX: 5.3,
    minZ: 17.2,
    maxZ: 18.3,
  } as XzBounds,
  collisionRects,
  hideSurfaces,
} as const

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function resolvePointAgainstExpandedRect(
  point: WorldPoint,
  rect: CollisionRect,
  radius: number,
): WorldPoint {
  const minX = rect.minX - radius
  const maxX = rect.maxX + radius
  const minZ = rect.minZ - radius
  const maxZ = rect.maxZ + radius

  if (
    point.x <= minX ||
    point.x >= maxX ||
    point.z <= minZ ||
    point.z >= maxZ
  ) {
    return point
  }

  const distances = [
    { axis: 'x' as const, value: Math.abs(point.x - minX), target: minX },
    { axis: 'x' as const, value: Math.abs(maxX - point.x), target: maxX },
    { axis: 'z' as const, value: Math.abs(point.z - minZ), target: minZ },
    { axis: 'z' as const, value: Math.abs(maxZ - point.z), target: maxZ },
  ]
  const nearest = distances.reduce((best, candidate) =>
    candidate.value < best.value ? candidate : best,
  )

  return nearest.axis === 'x'
    ? { ...point, x: nearest.target }
    : { ...point, z: nearest.target }
}

export function resolvePlayerCollision(
  position: WorldPoint,
  radius = PLAYER_RADIUS,
): WorldPoint {
  const safeRadius = Math.max(0, Number.isFinite(radius) ? radius : PLAYER_RADIUS)
  let resolved = position

  // A few deterministic passes let adjoining wall rectangles settle without
  // requiring a physics engine or frame-rate-dependent iteration count.
  for (let pass = 0; pass < 4; pass += 1) {
    let changed = false

    for (const rect of collisionRects) {
      const next = resolvePointAgainstExpandedRect(resolved, rect, safeRadius)
      if (next.x !== resolved.x || next.z !== resolved.z) {
        resolved = next
        changed = true
      }
    }

    if (!changed) {
      break
    }
  }

  return resolved
}

function segmentIntersectsRect(
  from: WorldPoint,
  to: WorldPoint,
  rect: XzBounds,
) {
  const dx = to.x - from.x
  const dz = to.z - from.z
  let tMin = 0
  let tMax = 1

  const clipAxis = (origin: number, delta: number, min: number, max: number) => {
    if (Math.abs(delta) < EPSILON) {
      return origin >= min && origin <= max
    }

    const first = (min - origin) / delta
    const second = (max - origin) / delta
    const enter = Math.min(first, second)
    const exit = Math.max(first, second)

    tMin = Math.max(tMin, enter)
    tMax = Math.min(tMax, exit)
    return tMin <= tMax
  }

  return (
    clipAxis(from.x, dx, rect.minX, rect.maxX) &&
    clipAxis(from.z, dz, rect.minZ, rect.maxZ) &&
    tMax >= 0 &&
    tMin <= 1
  )
}

export function hasLineOfSight(from: WorldPoint, to: WorldPoint) {
  return !collisionRects.some((rect) => segmentIntersectsRect(from, to, rect))
}

function hideSurfaceHit(surface: HideSurface, position: WorldPoint): HideSurfaceHit | null {
  const dx = position.x - surface.center.x
  const dy = position.y - surface.center.y
  const dz = position.z - surface.center.z
  const normalDistance =
    dx * surface.normal.x + dy * surface.normal.y + dz * surface.normal.z

  if (normalDistance < 0 || normalDistance > MAX_HIDE_DISTANCE) {
    return null
  }

  const tangentX = -surface.normal.z
  const tangentZ = surface.normal.x
  const lateralDistance = Math.abs(dx * tangentX + dz * tangentZ)

  if (
    lateralDistance > surface.halfWidth ||
    Math.abs(dy) > surface.halfHeight
  ) {
    return null
  }

  return { ...surface, distance: normalDistance }
}

export function nearestHideSurface(position: WorldPoint): HideSurfaceHit | null {
  let nearest: HideSurfaceHit | null = null

  for (const surface of hideSurfaces) {
    const hit = hideSurfaceHit(surface, position)
    if (hit && (!nearest || hit.distance < nearest.distance)) {
      nearest = hit
    }
  }

  return nearest
}

export function crossedNearMissTrigger(previousZ: number, currentZ: number) {
  const triggerZ = GOLDEN_SLICE_LEVEL.nearMissTriggerZ
  return previousZ < triggerZ && currentZ >= triggerZ
}

export function isInsideCompletionTrigger(position: WorldPoint) {
  const bounds = GOLDEN_SLICE_LEVEL.completionTrigger
  return (
    position.x >= bounds.minX &&
    position.x <= bounds.maxX &&
    position.z >= bounds.minZ &&
    position.z <= bounds.maxZ
  )
}

export function distanceToBounds(position: WorldPoint, bounds: XzBounds) {
  const nearestX = clamp(position.x, bounds.minX, bounds.maxX)
  const nearestZ = clamp(position.z, bounds.minZ, bounds.maxZ)
  return Math.hypot(position.x - nearestX, position.z - nearestZ)
}
