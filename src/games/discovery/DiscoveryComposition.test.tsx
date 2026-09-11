import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, waitFor } from 'vitest'
import { featuredGame, gameCatalog } from '../catalog/gameCatalog'
import FeaturedGame from './FeaturedGame'
import GameGrid from './GameGrid'
import GameRail from './GameRail'
import PartyCallout from './PartyCallout'
import RecentGameTracker from './RecentGameTracker'
import { readRecentGameIds } from './recentGames'

describe('discovery composition', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders a featured game with one direct play action', () => {
    render(
      <MemoryRouter>
        <FeaturedGame game={featuredGame} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Neon Drift' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Play Neon Drift' })).toHaveAttribute(
      'href',
      '/games/neon-drift',
    )
  })

  it('composes catalog data into grids and rails without selecting games internally', () => {
    const games = gameCatalog.slice(0, 3)
    const { rerender } = render(
      <MemoryRouter>
        <GameGrid games={games} />
      </MemoryRouter>,
    )

    expect(screen.getAllByTestId('game-tile')).toHaveLength(3)

    rerender(
      <MemoryRouter>
        <GameRail games={games.slice(0, 2)} title="Continue Playing" />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Continue Playing' })).toBeInTheDocument()
    expect(screen.getAllByTestId('game-tile')).toHaveLength(2)
  })

  it('routes the party callout into the current Chat room experience', () => {
    render(
      <MemoryRouter>
        <PartyCallout />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Start a party' })).toHaveAttribute(
      'href',
      '/chat',
    )
  })

  it('records direct visits to catalog game routes', async () => {
    render(
      <MemoryRouter initialEntries={['/games/warrior']}>
        <RecentGameTracker />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(readRecentGameIds()).toEqual(['warrior'])
    })
  })
})
