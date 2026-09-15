import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SchoolEscapeGame from './SchoolEscapeGame'
import { createSchoolEscapeRuntime } from './schoolEscapeRuntime'

vi.mock('./schoolEscapeRuntime', () => ({
  createSchoolEscapeRuntime: vi.fn(),
}))

const controller = {
  resize: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  restart: vi.fn().mockResolvedValue(undefined),
  dispose: vi.fn(),
}

function setVisibilityState(value: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value,
  })
}

describe('School Escape runtime lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createSchoolEscapeRuntime).mockResolvedValue(controller)
    setVisibilityState('visible')
  })

  afterEach(() => {
    Reflect.deleteProperty(document, 'visibilityState')
  })

  it('creates one runtime with canvas/input/look and disposes it on unmount', async () => {
    const { unmount } = render(<SchoolEscapeGame runtimeEnabled />)
    const canvas = screen.getByLabelText('School Escape 3D scene')

    await waitFor(() => {
      expect(createSchoolEscapeRuntime).toHaveBeenCalledTimes(1)
    })

    expect(createSchoolEscapeRuntime).toHaveBeenCalledWith(
      expect.objectContaining({
        canvas,
        input: expect.any(Object),
        look: expect.any(Object),
        onFatalError: expect.any(Function),
      }),
    )

    unmount()

    await waitFor(() => {
      expect(controller.dispose).toHaveBeenCalledTimes(1)
    })
  })

  it('shows a player-facing failure state when the runtime cannot start', async () => {
    vi.mocked(createSchoolEscapeRuntime).mockRejectedValueOnce(
      new Error('WebGL not supported'),
    )

    render(<SchoolEscapeGame runtimeEnabled />)

    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent(/School Escape could not start/i)
  })

  it('pauses, resumes, and resizes around browser lifecycle interruptions', async () => {
    const { unmount } = render(<SchoolEscapeGame runtimeEnabled />)

    await waitFor(() => {
      expect(createSchoolEscapeRuntime).toHaveBeenCalledTimes(1)
    })

    window.dispatchEvent(new Event('resize'))
    expect(controller.resize).toHaveBeenCalledTimes(1)

    setVisibilityState('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(controller.pause).toHaveBeenCalledTimes(1)

    window.dispatchEvent(new Event('focus'))
    expect(controller.resume).not.toHaveBeenCalled()

    setVisibilityState('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(controller.resume).toHaveBeenCalledTimes(1)

    window.dispatchEvent(new Event('blur'))
    expect(controller.pause).toHaveBeenCalledTimes(2)

    window.dispatchEvent(new Event('focus'))
    expect(controller.resume).toHaveBeenCalledTimes(2)

    window.dispatchEvent(new Event('orientationchange'))
    document.dispatchEvent(new Event('fullscreenchange'))
    expect(controller.resize).toHaveBeenCalledTimes(3)

    unmount()
    window.dispatchEvent(new Event('resize'))
    document.dispatchEvent(new Event('visibilitychange'))

    expect(controller.resize).toHaveBeenCalledTimes(3)
    expect(controller.dispose).toHaveBeenCalledTimes(1)
  })
})
