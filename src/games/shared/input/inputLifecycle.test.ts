import { afterEach, describe, expect, it, vi } from 'vitest'
import { attachInputResetLifecycle } from './inputLifecycle'
import { createSemanticInput } from './semanticInput'

const originalHiddenDescriptor = Object.getOwnPropertyDescriptor(
  Document.prototype,
  'hidden',
)

afterEach(() => {
  vi.restoreAllMocks()
  if (originalHiddenDescriptor) {
    Object.defineProperty(Document.prototype, 'hidden', originalHiddenDescriptor)
  }
})

describe('semantic input lifecycle reset', () => {
  it.each([
    ['window blur', () => window.dispatchEvent(new Event('blur'))],
    ['page hide', () => window.dispatchEvent(new Event('pagehide'))],
    [
      'fullscreen transition',
      () => document.dispatchEvent(new Event('fullscreenchange')),
    ],
    [
      'orientation transition',
      () => window.dispatchEvent(new Event('orientationchange')),
    ],
  ])('resets input on %s', (_, interrupt) => {
    const input = createSemanticInput<'boost'>()
    const reset = vi.spyOn(input.writer, 'reset')
    const detach = attachInputResetLifecycle(window, document, input.writer)

    interrupt()

    expect(reset).toHaveBeenCalledTimes(1)
    detach()
  })

  it('resets when the document becomes hidden', () => {
    const input = createSemanticInput<'boost'>()
    const reset = vi.spyOn(input.writer, 'reset')
    const detach = attachInputResetLifecycle(window, document, input.writer)
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: true,
    })

    document.dispatchEvent(new Event('visibilitychange'))

    expect(reset).toHaveBeenCalledTimes(1)
    detach()
  })

  it('does not reset for an ordinary resize', () => {
    const input = createSemanticInput<'boost'>()
    const reset = vi.spyOn(input.writer, 'reset')
    const detach = attachInputResetLifecycle(window, document, input.writer)

    window.dispatchEvent(new Event('resize'))

    expect(reset).not.toHaveBeenCalled()
    detach()
  })

  it('removes listeners and resets once during cleanup', () => {
    const input = createSemanticInput<'boost'>()
    const reset = vi.spyOn(input.writer, 'reset')
    const detach = attachInputResetLifecycle(window, document, input.writer)

    detach()

    expect(reset).toHaveBeenCalledTimes(1)
    reset.mockClear()
    window.dispatchEvent(new Event('blur'))
    document.dispatchEvent(new Event('fullscreenchange'))

    expect(reset).not.toHaveBeenCalled()
  })
})
