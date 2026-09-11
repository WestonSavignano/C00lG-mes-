import type { ComponentType } from 'react'

export type GameInput = 'touch' | 'keyboard' | 'mouse' | 'gamepad'

export type GameOrientation = 'portrait' | 'landscape' | 'either'

export type GameArtworkTheme =
  | 'sky'
  | 'candy'
  | 'neon'
  | 'arena'
  | 'forest'
  | 'shadow'

export type GameArtwork = {
  label: string
  theme: GameArtworkTheme
}

export type GameDefinition = {
  id: string
  route: `/games/${string}`
  title: string
  shortDescription: string
  category: string
  featured?: boolean
  new?: boolean
  multiplayer?: boolean
  orientation: GameOrientation
  inputs: GameInput[]
  artwork: GameArtwork
  loadPage: () => Promise<{ default: ComponentType }>
}
