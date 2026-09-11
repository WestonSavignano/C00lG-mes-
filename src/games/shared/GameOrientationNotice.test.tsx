import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import GameOrientationNotice from './GameOrientationNotice'

const originalInnerWidth = window.innerWidth
const originalInnerHeight = window.innerHeight
const originalMatchMedia = window.matchMedia

function installViewport({
  coarsePointer,
  height,
  width,
}: {
  coarsePointer: boolean
  height: number
  width: number
}) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  })
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: height,
  })

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      matches: query === '(pointer: coarse)' ? coarsePointer : false,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
    })),
  })
}

describe('GameOrientationNotice', () => {
  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: originalInnerWidth,
    })
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: originalInnerHeight,
    })
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: originalMatchMedia,
    })
    vi.restoreAllMocks()
  })

  it('lets a portrait handheld player continue without rotating', async () => {
    installViewport({ width: 390, height: 844, coarsePointer: true })
    const user = userEvent.setup()

    render(<GameOrientationNotice orientation="landscape" title="Neon Drift" />)

    expect(screen.getByRole('status')).toHaveTextContent(
      'Rotate your device to play Neon Drift in landscape',
    )

    await user.click(screen.getByRole('button', { name: 'Play anyway' }))

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('does not interrupt a player already using the preferred orientation', () => {
    installViewport({ width: 844, height: 390, coarsePointer: true })

    render(<GameOrientationNotice orientation="landscape" title="Neon Drift" />)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
