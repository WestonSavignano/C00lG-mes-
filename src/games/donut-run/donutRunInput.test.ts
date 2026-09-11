import { describe, expect, it } from 'vitest'
import { donutRunKeyboardBindings } from './donutRunInput'

describe('Donut Run semantic input mapping', () => {
  it('maps Space and ArrowUp to the same jump press intent', () => {
    expect(donutRunKeyboardBindings).toEqual([
      { code: 'Space', press: 'jump', preventDefault: true },
      { code: 'ArrowUp', press: 'jump', preventDefault: true },
    ])
  })
})
