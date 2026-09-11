import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { gameCatalog } from './gameCatalog'
import { gameRouteEntries } from './gameRoutes'

describe('game route entries', () => {
  it('derives every game route from the catalog', () => {
    expect(gameRouteEntries.map((entry) => entry.path)).toEqual(
      gameCatalog.map((game) => game.route),
    )
  })

  it('owns the shared shell and loading state for catalog routes', () => {
    render(
      <MemoryRouter initialEntries={['/games/neon-drift']}>
        <Routes>
          {gameRouteEntries.map((entry) => (
            <Route key={entry.game.id} path={entry.path} element={entry.element} />
          ))}
        </Routes>
      </MemoryRouter>,
    )

    const shell = screen.getByTestId('game-page-shell')

    expect(shell).toHaveAttribute('data-orientation', 'landscape')
    expect(
      screen.getByRole('heading', { level: 1, name: 'Neon Drift' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Loading Neon Drift…')
  })
})
