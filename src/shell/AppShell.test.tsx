import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import AppShell from './AppShell'

function renderShell(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AppShell>
        <main>Route content</main>
      </AppShell>
    </MemoryRouter>,
  )
}

describe('AppShell', () => {
  it('renders the same Home, Games, and Party destinations in desktop and mobile navigation', () => {
    renderShell('/')

    const desktop = screen.getByRole('navigation', { name: 'Primary' })
    const mobile = screen.getByRole('navigation', { name: 'Mobile primary' })

    for (const name of ['Home', 'Games', 'Party']) {
      expect(within(desktop).getByRole('link', { name })).toBeInTheDocument()
      expect(within(mobile).getByRole('link', { name })).toBeInTheDocument()
    }

    expect(within(desktop).getByRole('link', { name: 'Party' })).toHaveAttribute(
      'href',
      '/chat',
    )
    expect(within(mobile).getByRole('link', { name: 'Party' })).toHaveAttribute(
      'href',
      '/chat',
    )
  })

  it('marks exact game routes so the shell can yield space to gameplay', () => {
    const { container } = renderShell('/games/neon-drift')

    expect(container.querySelector('.app-shell')).toHaveAttribute(
      'data-game-route',
      'true',
    )
  })

  it('does not mark the games catalog route as gameplay', () => {
    const { container } = renderShell('/games')

    expect(container.querySelector('.app-shell')).toHaveAttribute(
      'data-game-route',
      'false',
    )
  })
})
