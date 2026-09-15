import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TrysteroPocPage } from './TrysteroPocPage'

describe('TrysteroPocPage', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/networking-poc/trystero')
  })

  afterEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('clearly presents the isolated feasibility harness before a party exists', () => {
    render(
      <MemoryRouter initialEntries={['/networking-poc/trystero']}>
        <TrysteroPocPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { level: 1, name: /Trystero networking POC/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Create test party/i })).toBeInTheDocument()
    expect(screen.getByText(/does not replace production Chat/i)).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /rendezvous strategy/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Nostr control/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /BitTorrent candidate/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('switches the diagnostic harness to the BitTorrent candidate before creating a party', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/networking-poc/trystero']}>
        <TrysteroPocPage />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: /BitTorrent candidate/i }))

    expect(screen.getByRole('button', { name: /BitTorrent candidate/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/Selected strategy: BitTorrent/i)).toBeInTheDocument()
    expect(window.location.search).toBe('?strategy=torrent')
  })
})
