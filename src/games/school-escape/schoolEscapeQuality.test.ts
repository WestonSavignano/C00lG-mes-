import { describe, expect, it } from 'vitest'
import {
  QUALITY_SETTINGS,
  chooseInitialQuality,
  createQualityPolicyState,
  updateQualityPolicy,
  type QualityPolicyState,
} from './schoolEscapeQuality'

function runFrames(
  initial: QualityPolicyState,
  frameTimeMs: number,
  seconds: number,
) {
  let state = initial
  const dt = 1 / 60
  const frames = Math.ceil(seconds / dt)

  for (let index = 0; index < frames; index += 1) {
    state = updateQualityPolicy(state, { frameTimeMs, dt })
  }

  return state
}

describe('School Escape adaptive quality', () => {
  it('locks the approved settings for each quality tier', () => {
    expect(QUALITY_SETTINGS).toEqual({
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
    })
  })

  it('chooses a conservative initial tier from hardware capabilities', () => {
    expect(
      chooseInitialQuality({
        deviceMemory: 16,
        hardwareConcurrency: 12,
        devicePixelRatio: 2,
      }),
    ).toBe('high')

    expect(
      chooseInitialQuality({
        deviceMemory: 8,
        hardwareConcurrency: 12,
        devicePixelRatio: 2,
      }),
    ).toBe('medium')

    expect(
      chooseInitialQuality({
        deviceMemory: 16,
        hardwareConcurrency: 8,
        devicePixelRatio: 2,
      }),
    ).toBe('medium')

    expect(
      chooseInitialQuality({
        deviceMemory: 16,
        hardwareConcurrency: 12,
        devicePixelRatio: 3,
      }),
    ).toBe('medium')

    expect(
      chooseInitialQuality({
        deviceMemory: 4,
        hardwareConcurrency: 12,
        devicePixelRatio: 2,
      }),
    ).toBe('low')

    expect(
      chooseInitialQuality({
        deviceMemory: 16,
        hardwareConcurrency: 4,
        devicePixelRatio: 2,
      }),
    ).toBe('low')

    expect(chooseInitialQuality({})).toBe('medium')
    expect(
      chooseInitialQuality({ hardwareConcurrency: 12, devicePixelRatio: 2 }),
    ).toBe('medium')
  })

  it('does not downgrade during the three-second warm-up', () => {
    const state = runFrames(createQualityPolicyState('high'), 45, 2.9)
    expect(state.tier).toBe('high')
  })

  it('downgrades high to medium only after sustained overload', () => {
    let state = runFrames(createQualityPolicyState('high'), 16, 3.2)
    state = runFrames(state, 26, 2)
    expect(state.tier).toBe('high')

    state = runFrames(state, 26, 3)
    expect(state.tier).toBe('medium')
    expect(state.overloadSeconds).toBe(0)
  })

  it('downgrades medium to low only after sustained heavier overload', () => {
    let state = runFrames(createQualityPolicyState('medium'), 16, 3.2)
    state = runFrames(state, 34, 5)
    expect(state.tier).toBe('low')
  })

  it('clears overload accumulation after recovery and ignores short spikes', () => {
    let state = runFrames(createQualityPolicyState('high'), 16, 3.2)
    state = runFrames(state, 35, 2.5)
    expect(state.tier).toBe('high')
    expect(state.overloadSeconds).toBeGreaterThan(0)

    state = runFrames(state, 16, 1.5)
    expect(state.overloadSeconds).toBe(0)

    state = runFrames(state, 35, 2.5)
    expect(state.tier).toBe('high')
  })

  it('never upgrades quality during the same play session', () => {
    const low = runFrames(createQualityPolicyState('low'), 8, 20)
    const medium = runFrames(createQualityPolicyState('medium'), 8, 20)

    expect(low.tier).toBe('low')
    expect(medium.tier).toBe('medium')
  })
})
