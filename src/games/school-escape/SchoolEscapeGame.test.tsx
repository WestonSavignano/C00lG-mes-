import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SchoolEscapeGame from './SchoolEscapeGame'

describe('SchoolEscapeGame', () => {
  it('renders first-class touch movement, look, sprint, and jump controls', () => {
    render(<SchoolEscapeGame />)

    expect(screen.getByRole('group', { name: 'Move' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Look around' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sprint' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Jump' })).toBeInTheDocument()
  })

  it('renders the School Escape scene canvas for the page-owned viewport', () => {
    render(<SchoolEscapeGame />)

    expect(screen.queryByTestId('game-viewport')).not.toBeInTheDocument()
    expect(screen.getByLabelText('School Escape 3D scene')).toBeInTheDocument()
  })
})
