import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

describe('School Escape runtime lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createSchoolEscapeRuntime).mockResolvedValue(controller)
  })

  it('creates one runtime with canvas/input/look and disposes it on unmount', async () => {
    const { unmount } = render(<SchoolEscapeGame />)
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
})
