import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SchoolEscapeLookSurface from './SchoolEscapeLookSurface'
import { createLookAccumulator } from './schoolEscapeInput'

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
  Reflect.deleteProperty(document, 'visibilityState')
})

describe('SchoolEscapeLookSurface', () => {
  it('accumulates owned pointer movement as camera look delta', () => {
    const look = createLookAccumulator()
    render(<SchoolEscapeLookSurface look={look} />)
    const surface = screen.getByLabelText('Look around')

    fireEvent.pointerDown(surface, {
      pointerId: 4,
      clientX: 100,
      clientY: 100,
    })
    fireEvent.pointerMove(surface, {
      pointerId: 4,
      clientX: 135,
      clientY: 82,
    })

    expect(look.consume()).toEqual({ x: 35, y: -18 })
    expect(surface.setPointerCapture).toHaveBeenCalledWith(4)
  })

  it('ignores a secondary pointer while camera look is owned', () => {
    const look = createLookAccumulator()
    render(<SchoolEscapeLookSurface look={look} />)
    const surface = screen.getByLabelText('Look around')

    fireEvent.pointerDown(surface, {
      pointerId: 4,
      clientX: 100,
      clientY: 100,
    })
    fireEvent.pointerDown(surface, {
      pointerId: 5,
      clientX: 10,
      clientY: 10,
    })
    fireEvent.pointerMove(surface, {
      pointerId: 5,
      clientX: 80,
      clientY: 80,
    })

    expect(look.consume()).toEqual({ x: 0, y: 0 })
  })

  it('clears pending look on cancellation, lost capture, and unmount', () => {
    const look = createLookAccumulator()
    const { unmount } = render(<SchoolEscapeLookSurface look={look} />)
    const surface = screen.getByLabelText('Look around')

    const drag = (pointerId: number) => {
      fireEvent.pointerDown(surface, {
        pointerId,
        clientX: 100,
        clientY: 100,
      })
      fireEvent.pointerMove(surface, {
        pointerId,
        clientX: 130,
        clientY: 110,
      })
    }

    drag(1)
    fireEvent.pointerCancel(surface, { pointerId: 1 })
    expect(look.consume()).toEqual({ x: 0, y: 0 })

    drag(2)
    fireEvent(surface, new Event('lostpointercapture', { bubbles: true }))
    expect(look.consume()).toEqual({ x: 0, y: 0 })

    drag(3)
    unmount()
    expect(look.consume()).toEqual({ x: 0, y: 0 })
  })

  it('clears pending look when the browser window loses focus', () => {
    const look = createLookAccumulator()
    render(<SchoolEscapeLookSurface look={look} />)
    const surface = screen.getByLabelText('Look around')

    fireEvent.pointerDown(surface, {
      pointerId: 9,
      clientX: 100,
      clientY: 100,
    })
    fireEvent.pointerMove(surface, {
      pointerId: 9,
      clientX: 150,
      clientY: 110,
    })
    window.dispatchEvent(new Event('blur'))

    expect(look.consume()).toEqual({ x: 0, y: 0 })
  })

  it('clears pending look when the page becomes hidden', () => {
    const look = createLookAccumulator()
    render(<SchoolEscapeLookSurface look={look} />)
    const surface = screen.getByLabelText('Look around')

    fireEvent.pointerDown(surface, {
      pointerId: 11,
      clientX: 100,
      clientY: 100,
    })
    fireEvent.pointerMove(surface, {
      pointerId: 11,
      clientX: 142,
      clientY: 91,
    })

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(look.consume()).toEqual({ x: 0, y: 0 })
  })
})
