import { afterEach, describe, expect, it } from 'vitest'
import { attachKeyboardInput, type KeyboardBinding } from './keyboardInput'
import { createSemanticInput } from './semanticInput'

afterEach(() => {
  document.body.replaceChildren()
})

describe('semantic keyboard input', () => {
  it('maps directional keydown and keyup to a movement source', () => {
    const input = createSemanticInput<'boost'>()
    const bindings: readonly KeyboardBinding<'boost'>[] = [
      { code: 'KeyD', move: { x: 1, y: 0 } },
    ]
    const detach = attachKeyboardInput(window, input.writer, bindings)

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }))
    expect(input.reader.move).toEqual({ x: 1, y: 0 })

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' }))
    expect(input.reader.move).toEqual({ x: 0, y: 0 })

    detach()
  })

  it('supports held and discrete semantics from the same physical key', () => {
    const input = createSemanticInput<'boost' | 'start'>()
    const bindings: readonly KeyboardBinding<'boost' | 'start'>[] = [
      {
        code: 'Space',
        hold: 'boost',
        press: 'start',
        preventDefault: true,
      },
    ]
    const detach = attachKeyboardInput(window, input.writer, bindings)
    const keydown = new KeyboardEvent('keydown', {
      code: 'Space',
      cancelable: true,
    })

    window.dispatchEvent(keydown)

    expect(keydown.defaultPrevented).toBe(true)
    expect(input.reader.isHeld('boost')).toBe(true)
    expect(input.reader.consumePress('start')).toBe(true)

    window.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'Space', repeat: true }),
    )
    expect(input.reader.consumePress('start')).toBe(false)

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }))
    expect(input.reader.isHeld('boost')).toBe(false)

    detach()
  })

  it('ignores gameplay keydown from interactive controls', () => {
    const input = createSemanticInput<'deploy'>()
    const detach = attachKeyboardInput(window, input.writer, [
      { code: 'KeyR', press: 'deploy' },
    ])
    const button = document.createElement('button')
    document.body.append(button)

    button.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'KeyR', bubbles: true }),
    )

    expect(input.reader.consumePress('deploy')).toBe(false)

    detach()
  })

  it('always lets keyup clear a mapped source even when focus moved to a button', () => {
    const input = createSemanticInput<'boost'>()
    const detach = attachKeyboardInput(window, input.writer, [
      { code: 'Space', hold: 'boost', preventDefault: true },
    ])

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
    expect(input.reader.isHeld('boost')).toBe(true)

    const button = document.createElement('button')
    document.body.append(button)
    button.dispatchEvent(
      new KeyboardEvent('keyup', { code: 'Space', bubbles: true }),
    )

    expect(input.reader.isHeld('boost')).toBe(false)

    detach()
  })

  it('clears mapped sources when the adapter detaches', () => {
    const input = createSemanticInput<'boost'>()
    const detach = attachKeyboardInput(window, input.writer, [
      { code: 'KeyD', move: { x: 1, y: 0 } },
      { code: 'Space', hold: 'boost' },
    ])

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
    detach()

    expect(input.reader.move).toEqual({ x: 0, y: 0 })
    expect(input.reader.isHeld('boost')).toBe(false)
  })
})
