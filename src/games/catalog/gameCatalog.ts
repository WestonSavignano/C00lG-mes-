import type { GameDefinition } from './gameTypes'

const INITIAL_CATALOG_ADDED_AT = '2026-09-11T01:08:57Z'

export const gameCatalog: readonly GameDefinition[] = [
  {
    id: 'plane-blaster',
    route: '/games/plane-blaster',
    title: 'Plane Blaster',
    shortDescription: 'Fast arcade dogfights above the clouds.',
    category: 'Arcade flight',
    addedAt: INITIAL_CATALOG_ADDED_AT,
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
    addedAt: INITIAL_CATALOG_ADDED_AT,
    orientation: 'landscape',
    inputs: ['touch', 'keyboard'],
    artwork: { theme: 'candy', label: 'Candy-colored platform run' },
    loadPage: () => import('../donut-run/DonutRunPage'),
  },
  {
    id: 'neon-drift',
    route: '/games/neon-drift',
    title: 'Neon Drift',
    shortDescription: 'Outrun the swarm, collect energy, and deploy defenses.',
    category: 'Arcade survival',
    addedAt: INITIAL_CATALOG_ADDED_AT,
    new: true,
    orientation: 'landscape',
    inputs: ['touch', 'keyboard'],
    artwork: { theme: 'neon', label: 'Neon survival arena' },
    loadPage: () => import('../neon-drift/NeonDriftPage'),
  },
  {
    id: 'monster-color-rush',
    route: '/games/monster-color-rush',
    title: 'Monster Color Rush',
    shortDescription: 'Match the monster, dodge wrong colors, and beat the clock.',
    category: 'Arcade chase',
    addedAt: '2026-09-13T21:10:24Z',
    new: true,
    orientation: 'landscape',
    inputs: ['touch', 'keyboard'],
    artwork: { theme: 'color-rush', label: 'Color-matching monster chase' },
    loadPage: () => import('../monster-color-rush/MonsterColorRushPage'),
  },
  {
    id: 'worm-battles',
    route: '/games/worm-battles',
    title: 'Worm Battles',
    shortDescription: 'Outmaneuver opponents in a lively tactical arena.',
    category: 'Arena strategy',
    addedAt: INITIAL_CATALOG_ADDED_AT,
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
    addedAt: INITIAL_CATALOG_ADDED_AT,
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
    addedAt: INITIAL_CATALOG_ADDED_AT,
    orientation: 'landscape',
    inputs: ['keyboard'],
    artwork: { theme: 'shadow', label: 'Shadowy village battle' },
    loadPage: () => import('../warrior2/WarriorPage'),
  },
]

export const featuredGame = gameCatalog.reduce((newest, game) =>
  Date.parse(game.addedAt) > Date.parse(newest.addedAt) ? game : newest,
)

export function getGameByRoute(pathname: string): GameDefinition | undefined {
  return gameCatalog.find((game) => game.route === pathname)
}
