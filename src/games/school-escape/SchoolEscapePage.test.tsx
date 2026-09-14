import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SchoolEscapePage from './SchoolEscapePage'

vi.mock('./SchoolEscapeGame', () => ({
  default: () => <div data-testid="school-escape-game">Game content</div>,
}))

describe('SchoolEscapePage', () => {
  it('owns exactly one shared viewport around the School Escape game content', () => {
    render(<SchoolEscapePage />)

    const viewport = screen.getByTestId('game-viewport')
    expect(screen.getAllByTestId('game-viewport')).toHaveLength(1)
    expect(viewport).toHaveAttribute('data-game', 'school-escape')
    expect(viewport).toHaveAccessibleName('School Escape')
    expect(viewport).toContainElement(screen.getByTestId('school-escape-game'))
  })
})
