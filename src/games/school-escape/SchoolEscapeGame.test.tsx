import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SchoolEscapeGame from './SchoolEscapeGame'

const runtimeMock = vi.hoisted(() => ({
  create: vi.fn(),
}))

vi.mock('./schoolEscapeRuntime', () => ({
  createSchoolEscapeRuntime: runtimeMock.create,
}))

function createRuntimeController() {
  return {
    setPaintMix: vi.fn(),
    resize: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    restart: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn(),
  }
}

describe('SchoolEscapeGame', () => {
  beforeEach(() => {
    runtimeMock.create.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders first-class touch movement, look, sprint, and jump controls', () => {
    render(<SchoolEscapeGame />)

    expect(screen.getByRole('group', { name: 'Move' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Look around' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sprint' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Jump' })).toBeInTheDocument()
  })

  it('renders the School Escape scene canvas for the page-owned viewport', () => {
    render(<SchoolEscapeGame />)

    expect(screen.queryByTestId('game-viewport')).not.toBeInTheDocument()
    expect(screen.getByLabelText('School Escape 3D scene')).toBeInTheDocument()
  })

  it('offers Retry and Return to Games after startup failure, then retries cleanly', async () => {
    const runtime = createRuntimeController()
    runtimeMock.create
      .mockRejectedValueOnce(new Error('WebGL unavailable'))
      .mockResolvedValueOnce(runtime)

    render(<SchoolEscapeGame runtimeEnabled />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'School Escape could not start.',
    )
    expect(screen.getByRole('link', { name: 'Return to Games' })).toHaveAttribute(
      'href',
      '/games',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => {
      expect(runtimeMock.create).toHaveBeenCalledTimes(2)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  it('restarts an existing runtime after a caught fatal error', async () => {
    const runtime = createRuntimeController()
    let reportFatalError: ((error: Error) => void) | null = null

    runtimeMock.create.mockImplementation(async (options) => {
      reportFatalError = options.onFatalError
      return runtime
    })

    render(<SchoolEscapeGame runtimeEnabled />)

    await waitFor(() => expect(runtimeMock.create).toHaveBeenCalledTimes(1))

    act(() => {
      reportFatalError?.(new Error('Render failed'))
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'School Escape could not start.',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => {
      expect(runtime.restart).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
    expect(runtimeMock.create).toHaveBeenCalledTimes(1)
  })

  it('shows camouflage controls only near cover with nonnumeric world-first feedback', async () => {
    const runtime = createRuntimeController()
    let publishUiSnapshot: ((snapshot: unknown) => void) | null = null

    runtimeMock.create.mockImplementation(async (options) => {
      publishUiSnapshot = options.onUiSnapshot
      return runtime
    })

    render(<SchoolEscapeGame runtimeEnabled />)
    await waitFor(() => expect(runtimeMock.create).toHaveBeenCalledTimes(1))

    expect(screen.queryByRole('group', { name: 'Mix paint' })).not.toBeInTheDocument()

    act(() => {
      publishUiSnapshot?.({
        nearbySurfaceId: 'locker-blue',
        matchScore: 0.86,
        teacherAlert: 'suspicious',
        subtitle: 'Come back here!',
        phase: 'playing',
      })
    })

    expect(screen.getByRole('group', { name: 'Mix paint' })).toBeInTheDocument()
    for (const label of ['Red', 'Yellow', 'Blue', 'White', 'Black', 'Clean paint']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
    const matchRing = screen.getByLabelText('Paint match strong')
    expect(matchRing).toBeInTheDocument()
    expect(matchRing.getAttribute('style')).toContain('--match-progress: 86%')
    expect(screen.getByLabelText('Current paint color')).toBeInTheDocument()
    expect(screen.getByLabelText('Teacher noticed something')).toBeInTheDocument()
    expect(screen.getByText('Come back here!')).toBeInTheDocument()

    expect(document.body.textContent).not.toMatch(/POOR|CLOSE|BLENDED|PATROL|SEARCH|CHASE/)
    expect(document.body.textContent).not.toMatch(/minimap|waypoint/i)
    expect(document.body.textContent).not.toContain('86%')

    fireEvent.click(screen.getByRole('button', { name: 'Clean paint' }))
    await waitFor(() => {
      expect(runtime.setPaintMix).toHaveBeenLastCalledWith({
        red: 0,
        yellow: 0,
        blue: 0,
        white: 0,
        black: 0,
      })
    })

    act(() => {
      publishUiSnapshot?.({
        nearbySurfaceId: null,
        matchScore: null,
        teacherAlert: 'none',
        subtitle: null,
        phase: 'playing',
      })
    })

    expect(screen.queryByRole('group', { name: 'Mix paint' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Teacher noticed something')).not.toBeInTheDocument()
  })

  it('adds pigment at 0.35 units per second while held and clamps channels to one', async () => {
    const runtime = createRuntimeController()
    let publishUiSnapshot: ((snapshot: unknown) => void) | null = null

    runtimeMock.create.mockImplementation(async (options) => {
      publishUiSnapshot = options.onUiSnapshot
      return runtime
    })

    render(<SchoolEscapeGame runtimeEnabled />)
    await waitFor(() => expect(runtimeMock.create).toHaveBeenCalledTimes(1))

    act(() => {
      publishUiSnapshot?.({
        nearbySurfaceId: 'locker-blue',
        matchScore: 0.4,
        teacherAlert: 'none',
        subtitle: null,
        phase: 'playing',
      })
    })

    const red = screen.getByRole('button', { name: 'Red' })
    vi.useFakeTimers()

    act(() => {
      fireEvent.pointerDown(red, { pointerId: 1 })
      vi.advanceTimersByTime(1000)
    })

    const afterOneSecond = runtime.setPaintMix.mock.calls.at(-1)?.[0]
    expect(afterOneSecond?.red).toBeCloseTo(0.35, 5)

    act(() => {
      vi.advanceTimersByTime(3000)
      fireEvent.pointerUp(red, { pointerId: 1 })
    })

    const afterFourSeconds = runtime.setPaintMix.mock.calls.at(-1)?.[0]
    expect(afterFourSeconds?.red).toBe(1)
  })

  it('supports keyboard paint hold without turning Space into Jump', async () => {
    const runtime = createRuntimeController()
    let publishUiSnapshot: ((snapshot: unknown) => void) | null = null
    let runtimeInput: { consumePress(action: string): boolean } | null = null

    runtimeMock.create.mockImplementation(async (options) => {
      publishUiSnapshot = options.onUiSnapshot
      runtimeInput = options.input
      return runtime
    })

    render(<SchoolEscapeGame runtimeEnabled />)
    await waitFor(() => expect(runtimeMock.create).toHaveBeenCalledTimes(1))

    act(() => {
      publishUiSnapshot?.({
        nearbySurfaceId: 'locker-blue',
        matchScore: 0.4,
        teacherAlert: 'none',
        subtitle: null,
        phase: 'playing',
      })
    })

    const blue = screen.getByRole('button', { name: 'Blue' })
    blue.focus()
    vi.useFakeTimers()

    act(() => {
      fireEvent.keyDown(blue, { code: 'Space', key: ' ' })
      vi.advanceTimersByTime(1000)
    })

    const afterOneSecond = runtime.setPaintMix.mock.calls.at(-1)?.[0]
    expect(afterOneSecond?.blue).toBeCloseTo(0.35, 5)
    expect(runtimeInput?.consumePress('jump')).toBe(false)

    fireEvent.keyUp(blue, { code: 'Space', key: ' ' })
  })

  it('shows concise caught and completion actions without exposing debug HUD', async () => {
    const runtime = createRuntimeController()
    let publishUiSnapshot: ((snapshot: unknown) => void) | null = null

    runtimeMock.create.mockImplementation(async (options) => {
      publishUiSnapshot = options.onUiSnapshot
      return runtime
    })

    render(<SchoolEscapeGame runtimeEnabled />)
    await waitFor(() => expect(runtimeMock.create).toHaveBeenCalledTimes(1))

    act(() => {
      publishUiSnapshot?.({
        nearbySurfaceId: null,
        matchScore: null,
        teacherAlert: 'alert',
        subtitle: null,
        phase: 'caught',
      })
    })

    expect(screen.getByRole('heading', { name: 'Caught' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Return to Games' })).toHaveAttribute(
      'href',
      '/games',
    )

    act(() => {
      publishUiSnapshot?.({
        nearbySurfaceId: null,
        matchScore: null,
        teacherAlert: 'none',
        subtitle: null,
        phase: 'complete',
      })
    })

    expect(
      screen.getByRole('heading', { name: 'Golden slice complete' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Play again' })).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/PATROL|SEARCH|CHASE/)
  })
})
