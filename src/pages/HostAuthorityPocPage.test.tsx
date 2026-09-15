import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { HostAuthorityPocPage } from './HostAuthorityPocPage'

describe('HostAuthorityPocPage', () => {
  it('presents the isolated durable-authority proof before a party exists', () => {
    window.history.replaceState(null, '', '/networking-poc/host-authority')
    render(
      <MemoryRouter initialEntries={['/networking-poc/host-authority']}>
        <HostAuthorityPocPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { level: 1, name: /Host-authoritative state POC/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Create durable test party/i })).toBeInTheDocument()
    expect(screen.getByText(/does not migrate production Chat/i)).toBeInTheDocument()
  })
})
