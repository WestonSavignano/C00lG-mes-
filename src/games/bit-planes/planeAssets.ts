export type PlaneDirection = 'left' | 'right'
export type PlaneVariant = 'enemy-fighter' | 'f15'

export type PlanePalette = {
  accent: string
  body: string
  canopy: string
  stroke: string
}

export type PlaneTextureDefinition = {
  direction: PlaneDirection
  height: number
  key: string
  palette: PlanePalette
  variant: PlaneVariant
  width: number
}

const PLAYER_F15_PALETTE: PlanePalette = {
  accent: '#38bdf8',
  body: '#8bd3ff',
  canopy: '#0f172a',
  stroke: '#f8fafc',
}

const ENEMY_FIGHTER_PALETTE: PlanePalette = {
  accent: '#fb923c',
  body: '#fb7185',
  canopy: '#450a0a',
  stroke: '#ffedd5',
}

export const BIT_PLANES_PLANE_TEXTURES: PlaneTextureDefinition[] = [
  {
    direction: 'right',
    height: 64,
    key: 'player-f15',
    palette: PLAYER_F15_PALETTE,
    variant: 'f15',
    width: 104,
  },
  {
    direction: 'left',
    height: 56,
    key: 'enemy-fighter',
    palette: ENEMY_FIGHTER_PALETTE,
    variant: 'enemy-fighter',
    width: 92,
  },
]

type CreatePlaneSvgOptions = {
  direction: PlaneDirection
  palette: PlanePalette
  variant: PlaneVariant
}

export function createPlaneSvg({
  direction,
  palette,
  variant,
}: CreatePlaneSvgOptions) {
  const transform =
    direction === 'left'
      ? 'transform="translate(104 0) scale(-1 1)"'
      : ''
  const intakeFill = variant === 'f15' ? palette.accent : palette.stroke
  const wingFill = variant === 'f15' ? palette.body : palette.accent

  return `<svg xmlns="http://www.w3.org/2000/svg" data-plane="${variant}" viewBox="0 0 104 64" width="104" height="64">
  <g ${transform}>
    <path d="M7 32 L46 18 L64 5 L75 7 L66 24 L99 32 L66 40 L75 57 L64 59 L46 46 Z" fill="${palette.body}" stroke="${palette.stroke}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M40 25 L58 19 L51 29 L40 31 Z" fill="${palette.canopy}" stroke="${palette.stroke}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M40 39 L58 45 L51 35 L40 33 Z" fill="${palette.canopy}" opacity="0.68"/>
    <path d="M11 32 L40 25 L44 32 L40 39 Z" fill="${intakeFill}" opacity="0.9"/>
    <path d="M63 24 L93 32 L63 40 L70 32 Z" fill="${wingFill}" opacity="0.88"/>
    <path d="M47 18 L60 9 L55 24 Z" fill="${palette.accent}" opacity="0.78"/>
    <path d="M47 46 L60 55 L55 40 Z" fill="${palette.accent}" opacity="0.78"/>
    <path d="M7 32 L22 27 L22 37 Z" fill="${palette.stroke}" opacity="0.9"/>
  </g>
</svg>`
}

export function svgToDataUri(svg: string) {
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

export function createPlaneTextureDataUri(texture: PlaneTextureDefinition) {
  return svgToDataUri(
    createPlaneSvg({
      direction: texture.direction,
      palette: texture.palette,
      variant: texture.variant,
    }),
  )
}
