import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSemanticInput } from '../shared/input/semanticInput'
import NeonDriftControls from './NeonDriftControls'
import type { NeonDriftAction } from './neonDriftInput'

const stickRect = {
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

const actionRect = {
  x: 200,
  y: 0,
  top: 0,
  left: 200,
  right: 280,
  bottom: 80,
  width: 80,
  height: 80,
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

describe('NeonDriftControls', () => {
  it('supports simultaneous movement and held Boost with independent pointers', () => {
    const input = createSemanticInput<NeonDriftAction>()
    render(<NeonDriftControls writer={input.writer} />)

    const stick = screen.getByRole('group', { name: 'Move' })
    const boost = screen.getByRole('button', { name: 'Boost' })
    vi.spyOn(stick, 'getBoundingClientRect').mockReturnValue(stickRect)
    vi.spyOn(boost, 'getBoundingClientRect').mockReturnValue(actionRect)

    fireEvent.pointerDown(stick, {
      pointerId: 11,
      clientX: 120,
      clientY: 60,
    })
    fireEvent.pointerDown(boost, {
      pointerId: 22,
      clientX: 240,
      clientY: 40,
    })

    expect(input.reader.move.x).toBeGreaterThan(0)
    expect(input.reader.isHeld('boost')).toBe(true)

    fireEvent.pointerCancel(boost, { pointerId: 22 })
    expect(input.reader.isHeld('boost')).toBe(false)
    expect(input.reader.move.x).toBeGreaterThan(0)

    fireEvent.pointerUp(stick, { pointerId: 11 })
    expect(input.reader.move).toEqual({ x: 0, y: 0 })
  })

  it('supports simultaneous movement and Deploy without clearing movement', () => {
    const input = createSemanticInput<NeonDriftAction>()
    render(<NeonDriftControls writer={input.writer} />)

    const stick = screen.getByRole('group', { name: 'Move' })
    const deploy = screen.getByRole('button', { name: 'Deploy' })
    vi.spyOn(stick, 'getBoundingClientRect').mockReturnValue(stickRect)
    vi.spyOn(deploy, 'getBoundingClientRect').mockReturnValue(actionRect)

    fireEvent.pointerDown(stick, {
      pointerId: 31,
      clientX: 120,
      clientY: 60,
    })
    fireEvent.pointerDown(deploy, {
      pointerId: 42,
      clientX: 240,
      clientY: 40,
    })
    fireEvent.pointerUp(deploy, {
      pointerId: 42,
      clientX: 240,
      clientY: 40,
    })

    expect(input.reader.consumePress('deploy')).toBe(true)
    expect(input.reader.move.x).toBeGreaterThan(0)

    fireEvent.pointerCancel(stick, { pointerId: 31 })
    expect(input.reader.move).toEqual({ x: 0, y: 0 })
    expect(input.reader.consumePress('deploy')).toBe(false)
  })
})
