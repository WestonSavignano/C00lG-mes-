import { describe, expect, it } from 'vitest'
import { createSemanticInput } from './semanticInput'

describe('semantic input state', () => {
  it('keeps one stable movement vector while sources change', () => {
    const input = createSemanticInput<'boost'>()
    const move = input.reader.move

    expect(move).toEqual({ x: 0, y: 0 })

    input.writer.setMoveSource('keyboard:KeyD', 1, 0)

    expect(input.reader.move).toBe(move)
    expect(move).toEqual({ x: 1, y: 0 })
  })

  it('aggregates, cancels, and radially clamps movement sources', () => {
    const input = createSemanticInput<'boost'>()

    input.writer.setMoveSource('right', 1, 0)
    input.writer.setMoveSource('down', 0, 1)

    expect(input.reader.move.x).toBeCloseTo(Math.SQRT1_2)
    expect(input.reader.move.y).toBeCloseTo(Math.SQRT1_2)

    input.writer.setMoveSource('left', -1, 0)

    expect(input.reader.move).toEqual({ x: 0, y: 1 })
  })

  it('keeps held actions active until every owning source releases', () => {
    const input = createSemanticInput<'boost'>()

    input.writer.setActionSource('keyboard:Space', 'boost', true)
    input.writer.setActionSource('button:boost', 'boost', true)
    input.writer.setActionSource('keyboard:Space', 'boost', false)

    expect(input.reader.isHeld('boost')).toBe(true)

    input.writer.clearSource('button:boost')

    expect(input.reader.isHeld('boost')).toBe(false)
  })

  it('buffers discrete presses until the runtime consumes them', () => {
    const input = createSemanticInput<'deploy'>()

    input.writer.pulseAction('deploy')
    input.writer.pulseAction('deploy')

    expect(input.reader.consumePress('deploy')).toBe(true)
    expect(input.reader.consumePress('deploy')).toBe(true)
    expect(input.reader.consumePress('deploy')).toBe(false)
  })

  it('clears movement, held actions, and press edges on reset', () => {
    const input = createSemanticInput<'boost' | 'deploy'>()

    input.writer.setMoveSource('move', 1, 0)
    input.writer.setActionSource('hold', 'boost', true)
    input.writer.pulseAction('deploy')
    input.writer.reset()

    expect(input.reader.move).toEqual({ x: 0, y: 0 })
    expect(input.reader.isHeld('boost')).toBe(false)
    expect(input.reader.consumePress('deploy')).toBe(false)
  })

  it('clears every contribution owned by one source without touching others', () => {
    const input = createSemanticInput<'boost'>()

    input.writer.setMoveSource('shared-source', 1, 0)
    input.writer.setActionSource('shared-source', 'boost', true)
    input.writer.setMoveSource('other-source', 0, -1)

    input.writer.clearSource('shared-source')

    expect(input.reader.move).toEqual({ x: 0, y: -1 })
    expect(input.reader.isHeld('boost')).toBe(false)
  })
})
