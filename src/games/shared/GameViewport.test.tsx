import { render, screen, waitFor } from '@testing-library/react'
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
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Exit fullscreen' }),
      ).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Exit fullscreen' }))

    expect(exitFullscreen).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Enter fullscreen' }),
      ).toBeInTheDocument()
    })
  })
})
