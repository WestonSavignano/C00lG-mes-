import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DirectionalControl from './DirectionalControl'
import { createSemanticInput } from './semanticInput'

const rect = {
  x: 0,
  y: 0,
  top: 0,
  left: 0,
  right: 120,
  bottom: 120,
  width: 120,
  height: 120,
  toJSON: () => ({}),
} as DOMRect

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: vi.fn(),
  })
  Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
    configurable: true,
    value: vi.fn(),
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  delete (HTMLElement.prototype as Partial<HTMLElement>).setPointerCapture
  delete (HTMLElement.prototype as Partial<HTMLElement>).releasePointerCapture
})

describe('DirectionalControl', () => {
  it('claims one pointer and maps movement through dead-zone rescaling and clamping', () => {
    const input = createSemanticInput<'boost'>()
    render(
      <DirectionalControl
        label="Move"
        sourceId="stick:test"
        writer={input.writer}
      />,
    )
    const control = screen.getByRole('group', { name: 'Move' })
    vi.spyOn(control, 'getBoundingClientRect').mockReturnValue(rect)

    fireEvent.pointerDown(control, {
      pointerId: 7,
      clientX: 60,
      clientY: 60,
    })
    expect(control.setPointerCapture).toHaveBeenCalledWith(7)
    expect(input.reader.move).toEqual({ x: 0, y: 0 })

    fireEvent.pointerMove(control, {
      pointerId: 7,
      clientX: 65,
      clientY: 60,
    })
    expect(input.reader.move).toEqual({ x: 0, y: 0 })

    fireEvent.pointerMove(control, {
      pointerId: 7,
      clientX: 120,
      clientY: 60,
    })
    expect(input.reader.move.x).toBeCloseTo(1)
    expect(input.reader.move.y).toBeCloseTo(0)

    fireEvent.pointerMove(control, {
      pointerId: 7,
      clientX: 120,
      clientY: 120,
    })
    expect(Math.hypot(input.reader.move.x, input.reader.move.y)).toBeCloseTo(1)
  })

  it('ignores secondary pointers while the stick is owned', () => {
    const input = createSemanticInput<'boost'>()
    render(
      <DirectionalControl
        label="Move"
        sourceId="stick:test"
        writer={input.writer}
      />,
    )
    const control = screen.getByRole('group', { name: 'Move' })
    vi.spyOn(control, 'getBoundingClientRect').mockReturnValue(rect)

    fireEvent.pointerDown(control, {
      pointerId: 7,
      clientX: 120,
      clientY: 60,
    })
    const ownedX = input.reader.move.x

    fireEvent.pointerDown(control, {
      pointerId: 8,
      clientX: 0,
      clientY: 60,
    })
    fireEvent.pointerMove(control, {
      pointerId: 8,
      clientX: 0,
      clientY: 60,
    })

    expect(input.reader.move.x).toBe(ownedX)
  })

  it('returns to zero on pointer release, cancellation, lost capture, and unmount', () => {
    const input = createSemanticInput<'boost'>()
    const { unmount } = render(
      <DirectionalControl
        label="Move"
        sourceId="stick:test"
        writer={input.writer}
      />,
    )
    const control = screen.getByRole('group', { name: 'Move' })
    vi.spyOn(control, 'getBoundingClientRect').mockReturnValue(rect)

    const moveRight = (pointerId: number) => {
      fireEvent.pointerDown(control, {
        pointerId,
        clientX: 120,
        clientY: 60,
      })
      expect(input.reader.move.x).toBeGreaterThan(0)
    }

    moveRight(1)
    fireEvent.pointerUp(control, { pointerId: 1 })
    expect(input.reader.move).toEqual({ x: 0, y: 0 })

    moveRight(2)
    fireEvent.pointerCancel(control, { pointerId: 2 })
    expect(input.reader.move).toEqual({ x: 0, y: 0 })

    moveRight(3)
    fireEvent(control, new Event('lostpointercapture', { bubbles: true }))
    expect(input.reader.move).toEqual({ x: 0, y: 0 })

    moveRight(4)
    unmount()
    expect(input.reader.move).toEqual({ x: 0, y: 0 })
  })
})
