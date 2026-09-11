import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from '../../App'
import GamesPage from '../../pages/GamesPage'

describe('Bodi Island arcade integration', () => {
  it('exposes Bodi Island from the Games page', () => {
    render(
      <MemoryRouter>
        <GamesPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Bodi Island' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open Bodi Island/i })).toHaveAttribute(
      'href',
      '/games/bodi-island',
    )
  })

  it('renders the Bodi Island game route', () => {
    render(
      <MemoryRouter initialEntries={['/games/bodi-island']}>
        <App />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Bodi Island' })).toBeInTheDocument()
    expect(screen.getByTestId('game-viewport')).toHaveAttribute('data-game', 'bodi-island')
  })
})
