import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from './App'

function renderRoute(route: string) {
  render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  )
}

describe('App routes', () => {
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

  it('links from the home page to Chat and Games', () => {
    renderRoute('/')

    const homeSections = screen.getByRole('navigation', {
      name: 'Home sections',
    })

    expect(within(homeSections).getByRole('link', { name: /chat/i })).toHaveAttribute(
      'href',
      '/chat',
    )
    expect(within(homeSections).getByRole('link', { name: /games/i })).toHaveAttribute(
      'href',
      '/games',
    )
  })

  it('renders the home hero', () => {
    renderRoute('/')

    const hero = screen.getByRole('region', { name: 'C00lG@mes+' })

    expect(within(hero).getByRole('heading', { name: 'C00lG@mes+' }))
      .toBeInTheDocument()
    expect(within(hero).getByText('A site for real gamers.')).toBeInTheDocument()
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

  it('renders the current game cards', () => {
    renderRoute('/games')

    expect(screen.getByRole('heading', { name: 'Games' })).toBeInTheDocument()

    const cards = screen.getAllByTestId('card')
    expect(cards).toHaveLength(6)
    expect(within(cards[0]).getByRole('heading', { name: 'Plane Blaster' }))
      .toBeInTheDocument()
    expect(within(cards[2]).getByRole('heading', { name: 'Neon Drift' }))
      .toBeInTheDocument()
    expect(within(cards[5]).getByRole('heading', { name: 'Warrior2' }))
      .toBeInTheDocument()
  })

  it('shows a lightweight loading boundary for lazy game routes', () => {
    renderRoute('/games/neon-drift')

    expect(screen.getByRole('status')).toHaveTextContent('Loading Neon Drift…')
  })

  it('renders Plane Blaster as the primary page content', async () => {
    renderRoute('/games/plane-blaster')

    expect(await screen.findByRole('heading', { level: 1, name: 'Plane Blaster' }))
      .toBeInTheDocument()
    expect(await screen.findByTestId('game-viewport')).toHaveAttribute(
      'data-game',
      'bit-planes',
    )
  })

  it('renders Neon Drift as a game route', async () => {
    renderRoute('/games/neon-drift')

    expect(await screen.findByRole('heading', { level: 1, name: 'Neon Drift' }))
      .toBeInTheDocument()
    expect(await screen.findByTestId('game-viewport')).toHaveAttribute(
      'data-game',
      'neon-drift',
    )
  })
})
