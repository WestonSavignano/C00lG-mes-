import { describe, expect, it } from 'vitest'
import { monsterColorRushKeyboardBindings } from './monsterColorRushInput'

describe('Monster Color Rush input', () => {
  it('maps WASD and arrow keys to semantic movement', () => {
    const bindings = new Map(
      monsterColorRushKeyboardBindings.map((binding) => [binding.code, binding]),
    )

    expect(bindings.get('KeyW')?.move).toEqual({ x: 0, y: -1 })
    expect(bindings.get('ArrowUp')?.move).toEqual({ x: 0, y: -1 })
    expect(bindings.get('KeyA')?.move).toEqual({ x: -1, y: 0 })
    expect(bindings.get('ArrowLeft')?.move).toEqual({ x: -1, y: 0 })
    expect(bindings.get('KeyS')?.move).toEqual({ x: 0, y: 1 })
    expect(bindings.get('ArrowDown')?.move).toEqual({ x: 0, y: 1 })
    expect(bindings.get('KeyD')?.move).toEqual({ x: 1, y: 0 })
    expect(bindings.get('ArrowRight')?.move).toEqual({ x: 1, y: 0 })
  })

  it('lets keyboard players start and restart without a pointer', () => {
    const bindings = new Map(
      monsterColorRushKeyboardBindings.map((binding) => [binding.code, binding]),
    )

    expect(bindings.get('Space')?.press).toBe('start')
    expect(bindings.get('Enter')?.press).toBe('start')
  })
})
