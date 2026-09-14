export const COLOR_COUNT = 6
export const REQUIRED_MATCH_COUNT = 6
export const HAZARD_COUNT = 14
export const TOTAL_WAVES = 12
export const WAVE_DURATION_SECONDS = 45
export const REST_DURATION_SECONDS = 7

export type Point = Readonly<{ x: number; y: number }>

export type WaveObject = {
  x: number
  y: number
  radius: number
  colorIndex: number
  required: boolean
  collected: boolean
  type: number
  rotation: number
  pulse: number
}

type CreateWaveObjectsOptions = {
  monsterColorIndex: number
  minX: number
  maxX: number
  minY: number
  maxY: number
  random?: () => number
}

function unitRandom(random: () => number): number {
  const value = random()
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(0.999999999999, value))
}

function randomRange(min: number, max: number, random: () => number): number {
  if (max <= min) return min
  return min + unitRandom(random) * (max - min)
}

export function getMonsterColorIndex(wave: number): number {
  const safeWave = Math.max(1, Math.floor(Number.isFinite(wave) ? wave : 1))
  return safeWave % COLOR_COUNT
}

export function createWaveObjects({
  monsterColorIndex,
  minX,
  maxX,
  minY,
  maxY,
  random = Math.random,
}: CreateWaveObjectsOptions): WaveObject[] {
  const safeMonsterColor =
    ((Math.floor(monsterColorIndex) % COLOR_COUNT) + COLOR_COUNT) % COLOR_COUNT
  const hazards = Array.from(
    { length: COLOR_COUNT - 1 },
    (_, colorIndex) => colorIndex,
  ).map((colorIndex) =>
    colorIndex >= safeMonsterColor ? colorIndex + 1 : colorIndex,
  )

  const createObject = (
    colorIndex: number,
    required: boolean,
    radius: number,
  ): WaveObject => ({
    x: randomRange(minX, maxX, random),
    y: randomRange(minY, maxY, random),
    radius,
    colorIndex,
    required,
    collected: false,
    type: Math.floor(unitRandom(random) * 3),
    rotation: randomRange(0, Math.PI * 2, random),
    pulse: randomRange(0, Math.PI * 2, random),
  })

  const objects: WaveObject[] = []

  for (let index = 0; index < REQUIRED_MATCH_COUNT; index += 1) {
    objects.push(createObject(safeMonsterColor, true, 31))
  }

  for (let index = 0; index < HAZARD_COUNT; index += 1) {
    const hazardColor = hazards[Math.floor(unitRandom(random) * hazards.length)] ?? 0
    objects.push(
      createObject(hazardColor, false, randomRange(22, 36, random)),
    )
  }

  return objects
}

export function selectFarthestSpawn(
  player: Point,
  candidates: readonly Point[],
  random: () => number = Math.random,
): Point {
  if (candidates.length === 0) {
    throw new Error('Monster spawn requires at least one candidate')
  }

  let farthestDistance = -Infinity
  const farthest: Point[] = []

  for (const candidate of candidates) {
    const distance = Math.hypot(candidate.x - player.x, candidate.y - player.y)

    if (distance > farthestDistance + Number.EPSILON) {
      farthestDistance = distance
      farthest.length = 0
      farthest.push(candidate)
    } else if (Math.abs(distance - farthestDistance) <= Number.EPSILON) {
      farthest.push(candidate)
    }
  }

  const index = Math.floor(unitRandom(random) * farthest.length)
  const selected = farthest[index]
  if (!selected) {
    throw new Error('Unable to select monster spawn')
  }

  return { x: selected.x, y: selected.y }
}
