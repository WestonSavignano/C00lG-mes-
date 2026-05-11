import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import Card from './Card'
import CardAction from './CardAction'
import CardLabel from './CardLabel'
import H2 from './H2'
import P from './P'
import Section from './Section'

describe('composable page primitives', () => {
  it('renders Section as a real section element with reusable flex settings', () => {
    render(
      <Section data-testid="section" flexFlow="column" gap="12px" padding="8px">
        <P>Starter content</P>
      </Section>,
    )

    const section = screen.getByTestId('section')

    expect(section.tagName).toBe('SECTION')
    expect(section).toHaveStyle({
      '--section-flex-flow': 'column',
      '--section-gap': '12px',
      '--section-padding': '8px',
    })
  })

  it('lets cards be built from smaller semantic pieces', () => {
    render(
      <MemoryRouter>
        <Card to="/games/bit-planes">
          <CardLabel>Game</CardLabel>
          <H2>Bit Planes</H2>
          <P>A Phaser-powered starter dogfight.</P>
          <CardAction>Open Bit Planes</CardAction>
        </Card>
      </MemoryRouter>,
    )

    const card = screen.getByTestId('card')

    expect(card.tagName).toBe('ARTICLE')
    expect(within(card).getByText('Game').tagName).toBe('P')
    expect(within(card).getByRole('heading', { level: 2, name: 'Bit Planes' }))
      .toBeInTheDocument()
    expect(within(card).getByRole('link', { name: /open bit planes/i }))
      .toHaveAttribute('href', '/games/bit-planes')
  })
})
