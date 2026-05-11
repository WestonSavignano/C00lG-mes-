import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  it('renders a responsive header with brand, desktop links, and a mobile menu', async () => {
    const user = userEvent.setup()
    renderRoute('/')

    const header = screen.getByRole('banner')
    expect(
      within(header).getByRole('link', { name: /C00lG-mes home/i }),
    ).toHaveAttribute('href', '/')

    const desktopNav = within(header).getByRole('navigation', {
      name: 'Primary',
    })
    expect(within(desktopNav).getByRole('link', { name: 'Soundboard' }))
      .toHaveAttribute('href', '/soundboard')
    expect(within(desktopNav).getByRole('link', { name: 'Games' }))
      .toHaveAttribute('href', '/games')

    const menuButton = within(header).getByRole('button', {
      name: /open navigation menu/i,
    })
    expect(menuButton).toHaveAttribute('aria-expanded', 'false')

    await user.click(menuButton)

    expect(menuButton).toHaveAttribute('aria-expanded', 'true')
    const mobileNav = within(header).getByRole('navigation', {
      name: 'Mobile',
    })
    const gamesLink = within(mobileNav).getByRole('link', { name: 'Games' })
    expect(gamesLink).toHaveAttribute('href', '/games')

    await user.click(gamesLink)

    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
  })

  it('links from the home page to the soundboard and games sections', () => {
    renderRoute('/')

    const homeSections = screen.getByRole('navigation', {
      name: 'Home sections',
    })

    expect(within(homeSections).getByRole('link', { name: /soundboard/i })).toHaveAttribute(
      'href',
      '/soundboard',
    )
    expect(within(homeSections).getByRole('link', { name: /games/i })).toHaveAttribute(
      'href',
      '/games',
    )
  })

  it('renders a low-power ocean hero on the home page', () => {
    renderRoute('/')

    const hero = screen.getByRole('region', { name: /games and sounds/i })

    expect(within(hero).getByTestId('ocean-animation')).toHaveAttribute(
      'data-ocean-style',
      'css-layered-ocean',
    )
    expect(
      within(hero).getByRole('heading', { name: 'Games and sounds' }),
    ).toBeInTheDocument()
  })

  it('renders soundboard placeholders as composable cards', () => {
    renderRoute('/soundboard')

    expect(screen.getByRole('heading', { name: 'Soundboard' })).toBeInTheDocument()

    const cards = screen.getAllByTestId('card')
    expect(cards).toHaveLength(1)
    expect(within(cards[0]).getByText('Sound')).toBeInTheDocument()
    expect(within(cards[0]).getByRole('heading', { name: 'Sound Placeholder' }))
      .toBeInTheDocument()
    expect(
      within(cards[0]).getByRole('link', { name: /open sound placeholder/i }),
    ).toHaveAttribute('href', '/soundboard/sound')
  })

  it('renders game placeholders as composable cards', () => {
    renderRoute('/games')

    expect(screen.getByRole('heading', { name: 'Games' })).toBeInTheDocument()

    const cards = screen.getAllByTestId('card')
    expect(cards).toHaveLength(1)
    expect(within(cards[0]).getByText('Game')).toBeInTheDocument()
    expect(within(cards[0]).getByRole('heading', { name: 'Bit Planes' }))
      .toBeInTheDocument()
    expect(
      within(cards[0]).getByRole('link', { name: /open bit planes/i }),
    ).toHaveAttribute('href', '/games/bit-planes')
  })

  it('renders a reusable detail page for individual sounds', () => {
    renderRoute('/soundboard/sound')

    const hero = screen.getByRole('region', { name: /sound placeholder/i })

    expect(within(hero).getByTestId('ocean-animation')).toBeInTheDocument()
    expect(within(hero).getByRole('heading', { name: 'Sound Placeholder' }))
      .toBeInTheDocument()
    expect(within(hero).getByText('Sound')).toBeInTheDocument()
    expect(within(hero).getByRole('link', { name: /back to soundboard/i })).toHaveAttribute(
      'href',
      '/soundboard',
    )
  })

  it('renders the Bit Planes game as the primary page content', () => {
    renderRoute('/games/bit-planes')

    expect(screen.getByRole('heading', { level: 1, name: 'Bit Planes' }))
      .toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: /bit planes/i }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Playground' }))
      .not.toBeInTheDocument()
    expect(screen.getByTestId('game-viewport')).toHaveAttribute(
      'data-game',
      'bit-planes',
    )
  })
})
