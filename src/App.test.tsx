import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'

function renderRoute(route: string) {
  render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  )
}

describe('App routes', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders the arcade shell with shared desktop and mobile destinations', () => {
    renderRoute('/')

    const header = screen.getByRole('banner')
    expect(
      within(header).getByRole('link', { name: /C00lG@mes\+ home/i }),
    ).toHaveAttribute('href', '/')

    const desktopNav = within(header).getByRole('navigation', {
      name: 'Primary',
    })
    const mobileNav = screen.getByRole('navigation', {
      name: 'Mobile primary',
    })

    for (const navigation of [desktopNav, mobileNav]) {
      expect(within(navigation).getByRole('link', { name: 'Home' }))
        .toHaveAttribute('href', '/')
      expect(within(navigation).getByRole('link', { name: 'Games' }))
        .toHaveAttribute('href', '/games')
      expect(within(navigation).getByRole('link', { name: 'Party' }))
        .toHaveAttribute('href', '/chat')
    }
  })

  it('makes the home page an immediate game discovery surface', () => {
    renderRoute('/')

    expect(
      screen.getByRole('heading', { level: 1, name: /Pick a game/i }),
    ).toBeInTheDocument()

    const featured = screen.getByRole('region', { name: 'Neon Drift' })
    expect(within(featured).getByRole('link', { name: 'Play Neon Drift' }))
      .toHaveAttribute('href', '/games/neon-drift')

    expect(screen.getByRole('link', { name: 'Start a party' }))
      .toHaveAttribute('href', '/chat')
    expect(screen.getAllByTestId('game-tile')).toHaveLength(7)
    expect(screen.getByRole('link', { name: 'Play Fart Attack' }))
      .toHaveAttribute('href', '/games/fart-attack')
  })

  it('surfaces recently played games when history exists', () => {
    localStorage.setItem(
      'coolgames.recent-games.v1',
      JSON.stringify(['warrior', 'neon-drift']),
    )

    renderRoute('/')

    const recent = screen.getByRole('region', { name: 'Continue Playing' })
    expect(within(recent).getAllByTestId('game-tile')).toHaveLength(2)
    expect(within(recent).getByRole('link', { name: 'Play Warrior' }))
      .toHaveAttribute('href', '/games/warrior')
    expect(within(recent).getByRole('link', { name: 'Play Neon Drift' }))
      .toHaveAttribute('href', '/games/neon-drift')
  })

  it('renders the canonical Chat route', () => {
    renderRoute('/chat')

    expect(screen.getByRole('heading', { level: 1, name: 'Chat' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start Chat' })).toBeInTheDocument()
  })

  it('redirects legacy Soundboard routes to Chat', () => {
    renderRoute('/soundboard')

    expect(screen.getByRole('heading', { level: 1, name: 'Chat' })).toBeInTheDocument()
  })

  it('renders the complete catalog as visual game tiles', () => {
    renderRoute('/games')

    expect(screen.getByRole('heading', { level: 1, name: 'Games' })).toBeInTheDocument()
    expect(screen.queryByTestId('game-page-shell')).not.toBeInTheDocument()

    const tiles = screen.getAllByTestId('game-tile')
    expect(tiles).toHaveLength(7)
    expect(screen.getByRole('link', { name: 'Play Plane Blaster' }))
      .toHaveAttribute('href', '/games/plane-blaster')
    expect(screen.getByRole('link', { name: 'Play Neon Drift' }))
      .toHaveAttribute('href', '/games/neon-drift')
    expect(screen.getByRole('link', { name: 'Play Fart Attack' }))
      .toHaveAttribute('href', '/games/fart-attack')
    expect(screen.getByRole('link', { name: 'Play Warrior2' }))
      .toHaveAttribute('href', '/games/warrior2')
  })

  it('shows the immersive shell while a lazy game route loads', () => {
    renderRoute('/games/neon-drift')

    const shell = screen.getByTestId('game-page-shell')

    expect(shell).toHaveAttribute('data-orientation', 'landscape')
    expect(within(shell).getByRole('heading', { level: 1, name: 'Neon Drift' }))
      .toBeInTheDocument()
    expect(within(shell).getByRole('link', { name: 'Back to Games' }))
      .toHaveAttribute('href', '/games')
    expect(screen.getByRole('status')).toHaveTextContent('Loading Neon Drift…')
  })

  it('renders Plane Blaster inside exactly one shared game shell', async () => {
    renderRoute('/games/plane-blaster')

    const shell = screen.getByTestId('game-page-shell')

    expect(screen.getAllByTestId('game-page-shell')).toHaveLength(1)
    expect(within(shell).getByRole('heading', { level: 1, name: 'Plane Blaster' }))
      .toBeInTheDocument()
    expect(within(shell).getByRole('link', { name: 'Back to Games' }))
      .toHaveAttribute('href', '/games')
    expect(await screen.findByTestId('game-viewport')).toHaveAttribute(
      'data-game',
      'bit-planes',
    )
  })

  it('renders Neon Drift inside exactly one shared game shell', async () => {
    renderRoute('/games/neon-drift')

    const shell = screen.getByTestId('game-page-shell')

    expect(screen.getAllByTestId('game-page-shell')).toHaveLength(1)
    expect(within(shell).getByRole('heading', { level: 1, name: 'Neon Drift' }))
      .toBeInTheDocument()
    expect(within(shell).getByRole('link', { name: 'Back to Games' }))
      .toHaveAttribute('href', '/games')
    expect(await screen.findByTestId('game-viewport')).toHaveAttribute(
      'data-game',
      'neon-drift',
    )
  })
})
