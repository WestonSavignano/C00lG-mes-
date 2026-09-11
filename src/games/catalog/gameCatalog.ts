import type { GameDefinition } from './gameTypes'

export const gameCatalog: readonly GameDefinition[] = [
  {
    id: 'plane-blaster',
    route: '/games/plane-blaster',
    title: 'Plane Blaster',
    shortDescription: 'Fast arcade dogfights above the clouds.',
    category: 'Arcade flight',
    orientation: 'landscape',
    inputs: ['keyboard'],
    artwork: { theme: 'sky', label: 'High-altitude dogfight' },
    loadPage: () => import('../bit-planes/BitPlanesPage'),
  },
  {
    id: 'donut-run',
    route: '/games/donut-run',
    title: 'Donut Run',
    shortDescription: 'A quick platforming sprint with a sugary twist.',
    category: 'Platformer',
    orientation: 'landscape',
    inputs: ['keyboard'],
    artwork: { theme: 'candy', label: 'Candy-colored platform run' },
    loadPage: () => import('../donut-run/DonutRunPage'),
  },
  {
    id: 'neon-drift',
    route: '/games/neon-drift',
    title: 'Neon Drift',
    shortDescription: 'Outrun the swarm, collect energy, and deploy defenses.',
    category: 'Arcade survival',
    featured: true,
    new: true,
    orientation: 'landscape',
    inputs: ['keyboard'],
    artwork: { theme: 'neon', label: 'Neon survival arena' },
    loadPage: () => import('../neon-drift/NeonDriftPage'),
  },
  {
    id: 'fart-attack',
    route: '/games/fart-attack',
    title: 'Fart Attack',
    shortDescription: 'Clear gassy waves, beat bosses, and gear up between rounds.',
    category: 'Arcade survival',
    new: true,
    orientation: 'landscape',
    inputs: ['keyboard', 'touch'],
    artwork: { theme: 'arena', label: 'Gas-cloud survival arena' },
    loadPage: () => import('../fart-attack/FartAttackPage'),
  },
  {
    id: 'worm-battles',
    route: '/games/worm-battles',
    title: 'Worm Battles',
    shortDescription: 'Outmaneuver opponents in a lively tactical arena.',
    category: 'Arena strategy',
    orientation: 'landscape',
    inputs: ['keyboard'],
    artwork: { theme: 'arena', label: 'Worm battle arena' },
    loadPage: () => import('../worm-battles/WormBattlesPage'),
  },
  {
    id: 'warrior',
    route: '/games/warrior',
    title: 'Warrior',
    shortDescription: 'A hand-drawn stick-figure action adventure.',
    category: 'Action adventure',
    orientation: 'landscape',
    inputs: ['keyboard'],
    artwork: { theme: 'forest', label: 'Hand-drawn forest adventure' },
    loadPage: () => import('../warrior/WarriorPage'),
  },
  {
    id: 'warrior2',
    route: '/games/warrior2',
    title: 'Warrior2',
    shortDescription: 'Battle Dark Matter and protect the village.',
    category: 'Action adventure',
    orientation: 'landscape',
    inputs: ['keyboard'],
    artwork: { theme: 'shadow', label: 'Shadowy village battle' },
    loadPage: () => import('../warrior2/WarriorPage'),
  },
]

export const featuredGame =
  gameCatalog.find((game) => game.featured) ?? gameCatalog[0]!

export function getGameByRoute(pathname: string): GameDefinition | undefined {
  return gameCatalog.find((game) => game.route === pathname)
}
