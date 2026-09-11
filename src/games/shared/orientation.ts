import type { GameOrientation } from '../catalog/gameTypes'

export type ViewportOrientation = 'portrait' | 'landscape'

export function getViewportOrientation(
  width: number,
  height: number,
): ViewportOrientation {
  return height > width ? 'portrait' : 'landscape'
}

export function shouldSuggestOrientation(
  required: GameOrientation,
  width: number,
  height: number,
  coarsePointer: boolean,
): boolean {
  if (required === 'either') {
    return false
  }

  const current = getViewportOrientation(width, height)
  const handheld = coarsePointer || Math.min(width, height) <= 540

  return handheld && current !== required
}
