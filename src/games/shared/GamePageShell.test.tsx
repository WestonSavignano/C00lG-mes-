import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { gameCatalog } from '../catalog/gameCatalog'
import GamePageShell from './GamePageShell'

describe('GamePageShell', () => {
  it('renders one compact route shell around the game runtime', () => {
    const game = gameCatalog.find(({ id }) => id === 'neon-drift')!

    render(
      <MemoryRouter>
        <GamePageShell game={game}>
          <div data-testid="runtime">Runtime</div>
        </GamePageShell>
      </MemoryRouter>,
    )

    const shell = screen.getByTestId('game-page-shell')

    expect(shell).toHaveAttribute('data-orientation', 'landscape')
    expect(screen.getByRole('link', { name: 'Back to Games' })).toHaveAttribute(
      'href',
      '/games',
    )
    expect(
      screen.getByRole('heading', { level: 1, name: 'Neon Drift' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Arcade survival')).toBeInTheDocument()
    expect(screen.getByTestId('game-runtime-stage')).toContainElement(
      screen.getByTestId('runtime'),
    )
  })
})
