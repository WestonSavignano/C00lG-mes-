import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('School Escape preview route', () => {
  it('lazy-loads the unlisted School Escape preview route', async () => {
    render(
      <MemoryRouter initialEntries={['/game-preview/school-escape']}>
        <App />
      </MemoryRouter>,
    )

    expect(await screen.findByTestId('game-viewport')).toHaveAttribute(
      'data-game',
      'school-escape',
    )
  })
})
