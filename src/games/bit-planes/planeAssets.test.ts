import { describe, expect, it } from 'vitest'
import {
  BIT_PLANES_PLANE_TEXTURES,
  createPlaneSvg,
  svgToDataUri,
} from './planeAssets'

describe('planeAssets', () => {
  it('defines reusable player and enemy plane textures', () => {
    expect(BIT_PLANES_PLANE_TEXTURES.map((texture) => texture.key)).toEqual([
      'player-f15',
      'enemy-fighter',
    ])
  })

  it('creates an F-15-inspired SVG with customizable colors', () => {
    const svg = createPlaneSvg({
      direction: 'right',
      palette: {
        accent: '#38bdf8',
        body: '#94a3b8',
        canopy: '#0f172a',
        stroke: '#f8fafc',
      },
      variant: 'f15',
    })

    expect(svg).toContain('data-plane="f15"')
    expect(svg).toContain('#38bdf8')
    expect(svg).toContain('#94a3b8')
    expect(svg).toContain('<path')
  })

  it('encodes SVG as a loader-friendly image data URI', () => {
    const dataUri = svgToDataUri('<svg viewBox="0 0 10 10"></svg>')

    expect(dataUri).toMatch(/^data:image\/svg\+xml;base64,/)
    expect(atob(dataUri.replace('data:image/svg+xml;base64,', ''))).toBe(
      '<svg viewBox="0 0 10 10"></svg>',
    )
  })
})
