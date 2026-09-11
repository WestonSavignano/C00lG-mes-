import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const modulePath = './BodiIslandGame'

async function loadGameModule() {
  try {
    return await import(/* @vite-ignore */ modulePath)
  } catch {
    return null
  }
}

describe('Bodi Island game UI', () => {
  it('shows the Dark Fuzz goal and Bodi health', async () => {
    const game = await loadGameModule()

    expect(game).not.toBeNull()
    if (!game) return

    render(
      <game.BodiIslandHud
        complete={false}
        darkFuzz={6}
        hasShadowBoots={false}
        health={4}
        message="Captain hears the signal."
      />,
    )

    expect(screen.getByText('Dark Fuzz 6/10')).toBeInTheDocument()
    expect(screen.getByText('Health 4/5')).toBeInTheDocument()
    expect(screen.getByText('Collect 10 Dark Fuzz, then return to Blaze.')).toBeInTheDocument()
  })

  it('shows the shadow-ground objective after the boots are crafted', async () => {
    const game = await loadGameModule()

    expect(game).not.toBeNull()
    if (!game) return

    render(
      <game.BodiIslandHud
        complete={false}
        darkFuzz={0}
        hasShadowBoots
        health={5}
        message="Blaze made the Shadow Boots!"
      />,
    )

    expect(screen.getByText('Shadow Boots equipped')).toBeInTheDocument()
    expect(screen.getByText('Cross the shadow ground and follow Captain to the signal.')).toBeInTheDocument()
  })

  it('renders labeled touch actions with large control hooks', async () => {
    const game = await loadGameModule()

    expect(game).not.toBeNull()
    if (!game) return

    render(
      <game.BodiIslandControls
        onAction={vi.fn()}
        onDirectionChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Move forward' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Move left' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Move right' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Move backward' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Attack' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dodge' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Interact' })).toBeInTheDocument()
  })
})
