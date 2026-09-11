import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FartAttack from './FartAttack'
import { createFartAttackGame } from './fartAttackGame'

vi.mock('./fartAttackGame', () => ({
  createFartAttackGame: vi.fn(() => ({
    destroy: vi.fn(),
    fart: vi.fn(),
    restart: vi.fn(),
    setMovement: vi.fn(),
  })),
}))

describe('FartAttack', () => {
  beforeEach(() => {
    vi.mocked(createFartAttackGame).mockClear()
  })

  it('mounts the canvas game and mobile-first controls', () => {
    render(<FartAttack />)

    expect(screen.getByLabelText('Fart Attack game')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Move up' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Move left' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Move down' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Move right' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fart attack' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Restart game' })).toBeInTheDocument()
  })

  it('creates and cleans up exactly one game instance', () => {
    const { unmount } = render(<FartAttack />)

    expect(createFartAttackGame).toHaveBeenCalledTimes(1)
    const game = vi.mocked(createFartAttackGame).mock.results[0]?.value

    unmount()

    expect(game?.destroy).toHaveBeenCalledTimes(1)
  })
})
