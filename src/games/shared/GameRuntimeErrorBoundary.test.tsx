import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { gameCatalog } from '../catalog/gameCatalog'
import GamePageShell from './GamePageShell'
import GameRuntimeErrorBoundary from './GameRuntimeErrorBoundary'

function BrokenRuntime() {
  throw new Error('Runtime failed')
}

describe('GameRuntimeErrorBoundary', () => {
  it('keeps the game shell available when a runtime render fails', async () => {
    const game = gameCatalog.find(({ id }) => id === 'neon-drift')!
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <GamePageShell game={game}>
          <GameRuntimeErrorBoundary game={game}>
            <BrokenRuntime />
          </GameRuntimeErrorBoundary>
        </GamePageShell>
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', { level: 1, name: 'Neon Drift' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Something interrupted Neon Drift.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Choose another game' })).toHaveAttribute(
      'href',
      '/games',
    )

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(screen.getByText('Something interrupted Neon Drift.')).toBeInTheDocument()
  })
})
