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
    expect(within(desktopNav).getByRole('link', { name: 'Videos' }))
      .toHaveAttribute('href', '/videos')
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

  it('links from the home page to the videos and games sections', () => {
    renderRoute('/')

    const homeSections = screen.getByRole('navigation', {
      name: 'Home sections',
    })

    expect(within(homeSections).getByRole('link', { name: /videos/i })).toHaveAttribute(
      'href',
      '/videos',
    )
    expect(within(homeSections).getByRole('link', { name: /games/i })).toHaveAttribute(
      'href',
      '/games',
    )
  })

  it('renders video placeholders as reusable list cards', () => {
    renderRoute('/videos')

    expect(screen.getByRole('heading', { name: 'Videos' })).toBeInTheDocument()

    const cards = screen.getAllByTestId('content-card')
    expect(cards).toHaveLength(1)
    expect(within(cards[0]).getByRole('heading', { name: 'Video Placeholder' }))
      .toBeInTheDocument()
    expect(
      within(cards[0]).getByRole('link', { name: /open video placeholder/i }),
    ).toHaveAttribute('href', '/videos/video-placeholder')
  })

  it('renders game placeholders as reusable list cards', () => {
    renderRoute('/games')

    expect(screen.getByRole('heading', { name: 'Games' })).toBeInTheDocument()

    const cards = screen.getAllByTestId('content-card')
    expect(cards).toHaveLength(1)
    expect(within(cards[0]).getByRole('heading', { name: 'Game Placeholder' }))
      .toBeInTheDocument()
    expect(
      within(cards[0]).getByRole('link', { name: /open game placeholder/i }),
    ).toHaveAttribute('href', '/games/game-placeholder')
  })

  it('renders a reusable detail page for individual videos', () => {
    renderRoute('/videos/video-placeholder')

    expect(
      screen.getByRole('heading', { name: 'Video Placeholder' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Video')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to videos/i })).toHaveAttribute(
      'href',
      '/videos',
    )
  })

  it('renders a reusable detail page for individual games', () => {
    renderRoute('/games/game-placeholder')

    expect(
      screen.getByRole('heading', { name: 'Game Placeholder' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Game')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to games/i })).toHaveAttribute(
      'href',
      '/games',
    )
  })
})
