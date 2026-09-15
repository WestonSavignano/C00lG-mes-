export type QualityTier = 'high' | 'medium' | 'low'

export type QualityCapabilities = Readonly<{
  deviceMemory?: number
  hardwareConcurrency?: number
  devicePixelRatio?: number
}>

export type QualityPolicyState = Readonly<{
  tier: QualityTier
  elapsedSeconds: number
  emaFrameTimeMs: number
  overloadSeconds: number
}>

export type QualityFrameSample = Readonly<{
  frameTimeMs: number
  dt: number
}>

export const QUALITY_SETTINGS = {
  high: {
    dprCap: 1.75,
    shadowMapSize: 1024,
    softShadows: true,
    effectDensity: 1,
  },
  medium: {
    dprCap: 1.35,
    shadowMapSize: 512,
    softShadows: false,
    effectDensity: 0.6,
  },
  low: {
    dprCap: 1,
    shadowMapSize: 256,
    softShadows: false,
    effectDensity: 0.25,
  },
} as const

const WARM_UP_SECONDS = 3
const OVERLOAD_SECONDS_TO_DOWNGRADE = 4
const EMA_TIME_CONSTANT_SECONDS = 0.5
const DEFAULT_FRAME_TIME_MS = 1000 / 60

const OVERLOAD_FRAME_TIME_MS: Readonly<Record<Exclude<QualityTier, 'low'>, number>> = {
  high: 22,
  medium: 30,
}

function positiveFinite(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined
}

export function chooseInitialQuality(capabilities: QualityCapabilities): QualityTier {
  const deviceMemory = positiveFinite(capabilities.deviceMemory)
  const hardwareConcurrency = positiveFinite(capabilities.hardwareConcurrency)
  const devicePixelRatio = positiveFinite(capabilities.devicePixelRatio)

  if (
    (deviceMemory !== undefined && deviceMemory <= 4) ||
    (hardwareConcurrency !== undefined && hardwareConcurrency <= 4)
  ) {
    return 'low'
  }

  if (
    deviceMemory === undefined ||
    hardwareConcurrency === undefined ||
    devicePixelRatio === undefined
  ) {
    return 'medium'
  }

  if (
    deviceMemory <= 8 ||
    hardwareConcurrency <= 8 ||
    devicePixelRatio > 2.5
  ) {
    return 'medium'
  }

  return 'high'
}

export function createQualityPolicyState(tier: QualityTier): QualityPolicyState {
  return {
    tier,
    elapsedSeconds: 0,
    emaFrameTimeMs: DEFAULT_FRAME_TIME_MS,
    overloadSeconds: 0,
  }
}

function downgrade(tier: Exclude<QualityTier, 'low'>): QualityTier {
  return tier === 'high' ? 'medium' : 'low'
}

export function updateQualityPolicy(
  state: QualityPolicyState,
  sample: QualityFrameSample,
): QualityPolicyState {
  const dt = Number.isFinite(sample.dt) ? Math.max(0, sample.dt) : 0
  const frameTimeMs = Number.isFinite(sample.frameTimeMs) && sample.frameTimeMs >= 0
    ? sample.frameTimeMs
    : state.emaFrameTimeMs
  const alpha = dt > 0
    ? 1 - Math.exp(-dt / EMA_TIME_CONSTANT_SECONDS)
    : 0
  const emaFrameTimeMs =
    state.emaFrameTimeMs + alpha * (frameTimeMs - state.emaFrameTimeMs)
  const elapsedSeconds = state.elapsedSeconds + dt

  if (state.tier === 'low' || elapsedSeconds < WARM_UP_SECONDS) {
    return {
      tier: state.tier,
      elapsedSeconds,
      emaFrameTimeMs,
      overloadSeconds: 0,
    }
  }

  const overloaded = emaFrameTimeMs > OVERLOAD_FRAME_TIME_MS[state.tier]
  const overloadSeconds = overloaded ? state.overloadSeconds + dt : 0

  if (overloadSeconds >= OVERLOAD_SECONDS_TO_DOWNGRADE) {
    return {
      tier: downgrade(state.tier),
      elapsedSeconds,
      emaFrameTimeMs,
      overloadSeconds: 0,
    }
  }

  return {
    tier: state.tier,
    elapsedSeconds,
    emaFrameTimeMs,
    overloadSeconds,
  }
}
