import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import GameViewport from './GameViewport'

function setFullscreenElement(element: Element | null) {
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    value: element,
  })
}

function installFullscreenMocks() {
  setFullscreenElement(null)

  const requestFullscreen = vi.fn().mockImplementation(function request(this: Element) {
    setFullscreenElement(this)
    document.dispatchEvent(new Event('fullscreenchange'))
    return Promise.resolve()
  })
  const exitFullscreen = vi.fn().mockImplementation(() => {
    setFullscreenElement(null)
    document.dispatchEvent(new Event('fullscreenchange'))
    return Promise.resolve()
  })

  Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
    configurable: true,
    value: requestFullscreen,
  })
  Object.defineProperty(document, 'exitFullscreen', {
    configurable: true,
    value: exitFullscreen,
  })

  return { exitFullscreen, requestFullscreen }
}

describe('GameViewport', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    setFullscreenElement(null)
    delete (HTMLElement.prototype as Partial<HTMLElement>).requestFullscreen
    delete (document as Partial<Document>).exitFullscreen
  })

  it('lets players enter and exit fullscreen mode', async () => {
    const user = userEvent.setup()
    const { exitFullscreen, requestFullscreen } = installFullscreenMocks()

    render(
      <GameViewport game="bit-planes" label="Bit Planes arcade game">
        <p>Game canvas</p>
      </GameViewport>,
    )

    const viewport = screen.getByTestId('game-viewport')

    await user.click(screen.getByRole('button', { name: 'Enter fullscreen' }))

    expect(requestFullscreen).toHaveBeenCalledTimes(1)
    expect(requestFullscreen.mock.instances[0]).toBe(viewport)
    expect(document.activeElement).toBe(viewport)
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Exit fullscreen' }),
      ).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Exit fullscreen' }))

    expect(exitFullscreen).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(viewport)
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Enter fullscreen' }),
      ).toBeInTheDocument()
    })
  })

  it('exposes a dedicated future input-overlay mount point', () => {
    render(
      <GameViewport
        game="neon-drift"
        inputOverlay={<button type="button">Boost</button>}
        label="Neon Drift game"
      >
        <canvas />
      </GameViewport>,
    )

    expect(screen.getByTestId('game-input-overlay')).toContainElement(
      screen.getByRole('button', { name: 'Boost' }),
    )
  })

  it('focuses the game surface from non-interactive pointer input', () => {
    render(
      <GameViewport game="neon-drift" label="Neon Drift game">
        <canvas data-testid="runtime-canvas" />
      </GameViewport>,
    )

    const viewport = screen.getByTestId('game-viewport')

    fireEvent.pointerDown(screen.getByTestId('runtime-canvas'))

    expect(document.activeElement).toBe(viewport)
  })

  it('keeps the viewport usable when fullscreen is rejected', async () => {
    const user = userEvent.setup()
    setFullscreenElement(null)

    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: vi.fn().mockRejectedValue(new Error('Fullscreen blocked')),
    })

    render(
      <GameViewport game="neon-drift" label="Neon Drift game">
        <p>Runtime</p>
      </GameViewport>,
    )

    const viewport = screen.getByTestId('game-viewport')

    await user.click(screen.getByRole('button', { name: 'Enter fullscreen' }))

    expect(document.activeElement).toBe(viewport)
    expect(screen.getByTestId('game-viewport')).toBeInTheDocument()
  })
})
