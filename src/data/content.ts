export type ContentKind = 'video' | 'game'

export type ContentItem = {
  kind: ContentKind
  slug: string
  title: string
  description: string
  detail: string
}

export type ContentCollection = {
  basePath: string
  title: string
  singularLabel: string
  description: string
  items: ContentItem[]
}

export type ContentCollections = {
  videos: ContentCollection
  games: ContentCollection
}

export const collections = {
  videos: {
    basePath: '/videos',
    title: 'Videos',
    singularLabel: 'Video',
    description: 'A growing library of video placeholders.',
    items: [
      {
        kind: 'video',
        slug: 'video-placeholder',
        title: 'Video Placeholder',
        description: 'A reusable card slot for the first video.',
        detail:
          'This page is ready for a video embed, transcript, notes, and related links.',
      },
    ],
  },
  games: {
    basePath: '/games',
    title: 'Games',
    singularLabel: 'Game',
    description: 'A growing library of game placeholders.',
    items: [
      {
        kind: 'game',
        slug: 'game-placeholder',
        title: 'Game Placeholder',
        description: 'A reusable card slot for the first game.',
        detail:
          'This page is ready for a playable build, controls, notes, and related links.',
      },
    ],
  },
} satisfies ContentCollections
