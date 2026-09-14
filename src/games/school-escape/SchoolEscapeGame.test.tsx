import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SchoolEscapeGame from './SchoolEscapeGame'

describe('SchoolEscapeGame', () => {
  it('renders first-class touch movement, sprint, and jump controls', () => {
    render(<SchoolEscapeGame />)

    expect(screen.getByRole('group', { name: 'Move' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sprint' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Jump' })).toBeInTheDocument()
  })

  it('keeps the School Escape canvas inside the shared viewport', () => {
    render(<SchoolEscapeGame />)

    expect(screen.getByTestId('game-viewport')).toHaveAttribute(
      'data-game',
      'school-escape',
    )
    expect(screen.getByLabelText('School Escape 3D scene')).toBeInTheDocument()
  })
})
