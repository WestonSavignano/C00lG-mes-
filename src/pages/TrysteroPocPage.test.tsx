import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as pocPageModule from './TrysteroPocPage'
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
    expect(screen.getByRole('button', { name: /Nostr event-driven wake/i })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /BitTorrent historical/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('switches the diagnostic harness to the event-driven Nostr wake candidate before creating a party', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/networking-poc/trystero']}>
        <TrysteroPocPage />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: /Nostr event-driven wake/i }))

    expect(screen.getByRole('button', { name: /Nostr event-driven wake/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/Selected strategy: Nostr \+ guest wake/i)).toBeInTheDocument()
    expect(window.location.search).toBe('?strategy=nostr-wake')
  })

  it('still exposes BitTorrent as historical comparison evidence', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/networking-poc/trystero']}>
        <TrysteroPocPage />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: /BitTorrent historical/i }))

    expect(screen.getByRole('button', { name: /BitTorrent historical/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/Selected strategy: BitTorrent/i)).toBeInTheDocument()
    expect(window.location.search).toBe('?strategy=torrent')
  })

  it('mirrors page evidence events to the browser console as they occur', () => {
    const reportEvent = Reflect.get(pocPageModule, 'reportPocEvidenceEvent')
    expect(reportEvent).toBeTypeOf('function')

    const consoleInfo = vi.fn()
    const entry = reportEvent('WebRTC peer connected after 896 ms', consoleInfo) as {
      at: string
      message: string
    }

    expect(entry.message).toBe('WebRTC peer connected after 896 ms')
    expect(consoleInfo).toHaveBeenCalledWith('[Trystero POC]', entry)
  })
})
