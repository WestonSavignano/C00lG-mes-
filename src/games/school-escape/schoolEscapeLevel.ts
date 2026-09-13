import type { RGBColor } from './schoolEscapeLogic'

export type Point2 = Readonly<{ x: number; z: number }>
export type Wall = Readonly<{
  id: string
  x: number
  z: number
  width: number
  depth: number
  height: number
  color: RGBColor
  camouflage: boolean
}>

export type NavNode = Readonly<{ id: string; x: number; z: number }>
export type Trigger = Readonly<{ x: number; z: number; radius: number }>

const CREAM = { r: 174, g: 166, b: 142 } as const
const BLUE = { r: 80, g: 112, b: 138 } as const
const GREEN = { r: 82, g: 112, b: 92 } as const
const RED = { r: 135, g: 72, b: 66 } as const
const LOCKER = { r: 64, g: 82, b: 96 } as const

export const SCHOOL_START = { x: -8.4, z: -12.6 } as const
export const SCHOOL_EXIT = { x: 8.4, z: 15.4, radius: 1.2 } as const
export const EXTERIOR_BOUNDS = { minX: 4.5, maxX: 11.5, minZ: 15, maxZ: 47 } as const
export const HOUSE_TRIGGER = { x: 8, z: 44.5, radius: 1.7 } as const

export const WALLS: readonly Wall[] = [
  { id: 'south', x: 0, z: -16, width: 25, depth: 0.6, height: 3.4, color: CREAM, camouflage: true },
  { id: 'north-left', x: -7, z: 18, width: 11, depth: 0.6, height: 3.4, color: CREAM, camouflage: true },
  { id: 'north-right', x: 7, z: 18, width: 11, depth: 0.6, height: 3.4, color: CREAM, camouflage: true },
  { id: 'west', x: -12, z: 1, width: 0.6, depth: 34, height: 3.4, color: BLUE, camouflage: true },
  { id: 'east', x: 12, z: 1, width: 0.6, depth: 34, height: 3.4, color: GREEN, camouflage: true },
  { id: 'start-room-east', x: -4, z: -12, width: 0.5, depth: 7.2, height: 3.2, color: BLUE, camouflage: true },
  { id: 'start-room-north-left', x: -8.2, z: -8.5, width: 7.5, depth: 0.5, height: 3.2, color: CREAM, camouflage: true },
  { id: 'start-room-north-right', x: -3, z: -8.5, width: 1.4, depth: 0.5, height: 3.2, color: CREAM, camouflage: true },
  { id: 'center-spine-lower', x: 1.3, z: -10.8, width: 0.5, depth: 10.4, height: 3.2, color: GREEN, camouflage: true },
  { id: 'center-spine-upper', x: 1.3, z: 7.8, width: 0.5, depth: 13.7, height: 3.2, color: RED, camouflage: true },
  { id: 'locker-bank', x: 6.8, z: -4.2, width: 7.8, depth: 0.8, height: 2.4, color: LOCKER, camouflage: true },
  { id: 'west-wing-divider-a', x: -6.6, z: 0, width: 10.2, depth: 0.5, height: 3.2, color: CREAM, camouflage: true },
  { id: 'west-wing-divider-b', x: -1.1, z: 0, width: 1.8, depth: 0.5, height: 3.2, color: CREAM, camouflage: true },
  { id: 'quiet-wing-a', x: -6.8, z: 8.4, width: 10, depth: 0.5, height: 3.2, color: BLUE, camouflage: true },
  { id: 'quiet-wing-b', x: -1.2, z: 8.4, width: 1.6, depth: 0.5, height: 3.2, color: BLUE, camouflage: true },
  { id: 'exit-lobby-west', x: 4.2, z: 12.5, width: 0.5, depth: 10, height: 3.2, color: RED, camouflage: true },
  { id: 'exit-lobby-north', x: 7.9, z: 17.1, width: 7, depth: 0.5, height: 3.2, color: CREAM, camouflage: true },
] as const

export const PATROL_NODES: readonly NavNode[] = [
  { id: 'p0', x: 7.8, z: -11.8 },
  { id: 'p1', x: 8.2, z: -6.8 },
  { id: 'p2', x: 3.3, z: -1.8 },
  { id: 'p3', x: -7.7, z: 3.1 },
  { id: 'p4', x: -7.2, z: 12.4 },
  { id: 'p5', x: 2.9, z: 14.1 },
  { id: 'p6', x: 8.1, z: 11.8 },
] as const

export const DOOR_MARKERS = [
  { x: -5.6, z: -8.5, yaw: 0 },
  { x: -4.1, z: 0, yaw: 0 },
  { x: -4.2, z: 8.4, yaw: 0 },
  { x: 4.2, z: 8.6, yaw: Math.PI / 2 },
] as const

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function expandedBounds(wall: Wall, radius = 0) {
  return {
    minX: wall.x - wall.width / 2 - radius,
    maxX: wall.x + wall.width / 2 + radius,
    minZ: wall.z - wall.depth / 2 - radius,
    maxZ: wall.z + wall.depth / 2 + radius,
  }
}

export function resolveCircleAgainstWalls(
  position: Point2,
  radius: number,
  walls: readonly Wall[] = WALLS,
): Point2 {
  let x = position.x
  let z = position.z

  for (const wall of walls) {
    const bounds = expandedBounds(wall, radius)
    if (x <= bounds.minX || x >= bounds.maxX || z <= bounds.minZ || z >= bounds.maxZ) {
      continue
    }

    const distances = [
      { axis: 'x' as const, value: Math.abs(x - bounds.minX), target: bounds.minX },
      { axis: 'x' as const, value: Math.abs(bounds.maxX - x), target: bounds.maxX },
      { axis: 'z' as const, value: Math.abs(z - bounds.minZ), target: bounds.minZ },
      { axis: 'z' as const, value: Math.abs(bounds.maxZ - z), target: bounds.maxZ },
    ]
    distances.sort((a, b) => a.value - b.value)
    const nearest = distances[0]!
    if (nearest.axis === 'x') x = nearest.target
    else z = nearest.target
  }

  return { x, z }
}

function segmentIntersectsRect(a: Point2, b: Point2, wall: Wall) {
  const bounds = expandedBounds(wall)
  const dx = b.x - a.x
  const dz = b.z - a.z
  let tMin = 0
  let tMax = 1

  const clips = [
    [-dx, a.x - bounds.minX],
    [dx, bounds.maxX - a.x],
    [-dz, a.z - bounds.minZ],
    [dz, bounds.maxZ - a.z],
  ] as const

  for (const [p, q] of clips) {
    if (Math.abs(p) < 1e-8) {
      if (q < 0) return false
      continue
    }
    const t = q / p
    if (p < 0) tMin = Math.max(tMin, t)
    else tMax = Math.min(tMax, t)
    if (tMin > tMax) return false
  }

  return tMax >= 0 && tMin <= 1
}

export function hasLineOfSight(
  from: Point2,
  to: Point2,
  walls: readonly Wall[] = WALLS,
) {
  return !walls.some((wall) => segmentIntersectsRect(from, to, wall))
}

function distanceToWall(point: Point2, wall: Wall) {
  const bounds = expandedBounds(wall)
  const closestX = clamp(point.x, bounds.minX, bounds.maxX)
  const closestZ = clamp(point.z, bounds.minZ, bounds.maxZ)
  return Math.hypot(point.x - closestX, point.z - closestZ)
}

export function nearestCamouflageWall(
  point: Point2,
  walls: readonly Wall[] = WALLS,
): { wall: Wall; distance: number } | null {
  let best: { wall: Wall; distance: number } | null = null

  for (const wall of walls) {
    if (!wall.camouflage) continue
    const distance = distanceToWall(point, wall)
    if (!best || distance < best.distance) best = { wall, distance }
  }

  return best
}

export function isInsideTrigger(point: Point2, trigger: Trigger) {
  return Math.hypot(point.x - trigger.x, point.z - trigger.z) <= trigger.radius
}
