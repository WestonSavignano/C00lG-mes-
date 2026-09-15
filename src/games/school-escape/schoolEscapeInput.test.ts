import { describe, expect, it } from 'vitest'
import {
  createLookAccumulator,
  schoolEscapeKeyboardBindings,
} from './schoolEscapeInput'

describe('School Escape input mapping', () => {
  it('maps desktop controls to semantic movement, sprint, and jump', () => {
    expect(schoolEscapeKeyboardBindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'KeyW', move: { x: 0, y: -1 } }),
        expect.objectContaining({ code: 'KeyS', move: { x: 0, y: 1 } }),
        expect.objectContaining({ code: 'KeyA', move: { x: -1, y: 0 } }),
        expect.objectContaining({ code: 'KeyD', move: { x: 1, y: 0 } }),
        expect.objectContaining({ code: 'ShiftLeft', hold: 'sprint' }),
        expect.objectContaining({ code: 'ShiftRight', hold: 'sprint' }),
        expect.objectContaining({ code: 'Space', press: 'jump' }),
      ]),
    )
  })

  it('buffers camera look deltas, clamps one frame, and consumes them once', () => {
    const look = createLookAccumulator()

    look.add(200, -180)
    look.add(10, 5)

    expect(look.consume()).toEqual({ x: 120, y: -120 })
    expect(look.consume()).toEqual({ x: 0, y: 0 })
  })

  it('clears pending camera movement on reset', () => {
    const look = createLookAccumulator()

    look.add(40, 25)
    look.reset()

    expect(look.consume()).toEqual({ x: 0, y: 0 })
  })
})
