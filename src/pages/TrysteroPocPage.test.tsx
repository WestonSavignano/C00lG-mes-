import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { TrysteroPocPage } from './TrysteroPocPage'

describe('TrysteroPocPage', () => {
  it('clearly presents the isolated feasibility harness before a party exists', () => {
    render(
      <MemoryRouter initialEntries={['/networking-poc/trystero']}>
        <TrysteroPocPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { level: 1, name: /Trystero networking POC/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Create test party/i })).toBeInTheDocument()
    expect(screen.getByText(/does not replace production Chat/i)).toBeInTheDocument()
  })
})
