import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ActionButton from './ActionButton'
import { createSemanticInput } from './semanticInput'

const rect = {
  x: 0,
  y: 0,
  top: 0,
  left: 0,
  right: 80,
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

describe('ActionButton', () => {
  it('emits one press for a pointer activation even when a native click follows', () => {
    const input = createSemanticInput<'deploy'>()
    render(
      <ActionButton
        action="deploy"
        mode="press"
        sourceId="button:deploy"
        writer={input.writer}
      >
        Deploy
      </ActionButton>,
    )
    const button = screen.getByRole('button', { name: 'Deploy' })
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(rect)

    fireEvent.pointerDown(button, {
      pointerId: 7,
      clientX: 20,
      clientY: 20,
    })
    fireEvent.pointerUp(button, {
      pointerId: 7,
      clientX: 20,
      clientY: 20,
    })
    fireEvent.click(button, { detail: 1 })

    expect(input.reader.consumePress('deploy')).toBe(true)
    expect(input.reader.consumePress('deploy')).toBe(false)
  })

  it('uses native keyboard or assistive click activation exactly once in press mode', () => {
    const input = createSemanticInput<'deploy'>()
    render(
      <ActionButton
        action="deploy"
        mode="press"
        sourceId="button:deploy"
        writer={input.writer}
      >
        Deploy
      </ActionButton>,
    )
    const button = screen.getByRole('button', { name: 'Deploy' })

    fireEvent.click(button, { detail: 0 })

    expect(input.reader.consumePress('deploy')).toBe(true)
    expect(input.reader.consumePress('deploy')).toBe(false)
  })

  it('holds only while the owning pointer remains inside and clears on cancel', () => {
    const input = createSemanticInput<'boost'>()
    render(
      <ActionButton
        action="boost"
        mode="hold"
        sourceId="button:boost"
        writer={input.writer}
      >
        Boost
      </ActionButton>,
    )
    const button = screen.getByRole('button', { name: 'Boost' })
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(rect)

    fireEvent.pointerDown(button, {
      pointerId: 3,
      clientX: 20,
      clientY: 20,
    })
    expect(input.reader.isHeld('boost')).toBe(true)

    fireEvent.pointerMove(button, {
      pointerId: 3,
      clientX: 100,
      clientY: 100,
    })
    expect(input.reader.isHeld('boost')).toBe(false)

    fireEvent.pointerMove(button, {
      pointerId: 3,
      clientX: 20,
      clientY: 20,
    })
    expect(input.reader.isHeld('boost')).toBe(true)

    fireEvent.pointerCancel(button, { pointerId: 3 })
    expect(input.reader.isHeld('boost')).toBe(false)
  })

  it('supports focused Enter and Space hold semantics without global keyboard handling', () => {
    const input = createSemanticInput<'boost'>()
    render(
      <ActionButton
        action="boost"
        mode="hold"
        sourceId="button:boost"
        writer={input.writer}
      >
        Boost
      </ActionButton>,
    )
    const button = screen.getByRole('button', { name: 'Boost' })

    fireEvent.keyDown(button, { code: 'Space', key: ' ' })
    expect(input.reader.isHeld('boost')).toBe(true)
    fireEvent.keyUp(button, { code: 'Space', key: ' ' })
    expect(input.reader.isHeld('boost')).toBe(false)

    fireEvent.keyDown(button, { code: 'Enter', key: 'Enter' })
    expect(input.reader.isHeld('boost')).toBe(true)
    fireEvent.keyUp(button, { code: 'Enter', key: 'Enter' })
    expect(input.reader.isHeld('boost')).toBe(false)
  })

  it('clears held pointer and keyboard ownership on lost capture and unmount', () => {
    const input = createSemanticInput<'boost'>()
    const { unmount } = render(
      <ActionButton
        action="boost"
        mode="hold"
        sourceId="button:boost"
        writer={input.writer}
      >
        Boost
      </ActionButton>,
    )
    const button = screen.getByRole('button', { name: 'Boost' })
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(rect)

    fireEvent.pointerDown(button, {
      pointerId: 9,
      clientX: 20,
      clientY: 20,
    })
    fireEvent(button, new Event('lostpointercapture', { bubbles: true }))
    expect(input.reader.isHeld('boost')).toBe(false)

    fireEvent.pointerDown(button, {
      pointerId: 10,
      clientX: 20,
      clientY: 20,
    })
    fireEvent.keyDown(button, { code: 'Space', key: ' ' })
    expect(input.reader.isHeld('boost')).toBe(true)

    unmount()
    expect(input.reader.isHeld('boost')).toBe(false)
  })
})
