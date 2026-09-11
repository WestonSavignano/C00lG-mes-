import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { gameCatalog } from '../catalog/gameCatalog'
import GameTile from './GameTile'

describe('GameTile', () => {
  it('makes the game a single scannable link without redundant action copy', () => {
    const game = gameCatalog[0]!
    const { container } = render(
      <MemoryRouter>
        <GameTile game={game} />
      </MemoryRouter>,
    )

    const tile = screen.getByTestId('game-tile')
    const link = screen.getByRole('link', { name: 'Play Plane Blaster' })

    expect(tile).toContainElement(link)
    expect(link).toHaveAttribute('href', '/games/plane-blaster')
    expect(screen.getByText('Plane Blaster')).toBeInTheDocument()
    expect(screen.getByText('Arcade flight')).toBeInTheDocument()
    expect(screen.queryByText(/Open Plane Blaster/i)).not.toBeInTheDocument()
    expect(container.querySelector('.game-artwork')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
  })
})
