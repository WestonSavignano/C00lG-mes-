import { act, render, screen, waitFor } from '@testing-library/react'
import { useRef, useState, type RefObject } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import usePhaserGame from './usePhaserGame'

type UsePhaserGameForTest = (
  parentRef: RefObject<HTMLDivElement | null>,
  createGame: (
    runtime: typeof import('phaser'),
    parent: HTMLDivElement,
  ) => {
    destroy: (removeCanvas: boolean, noReturn?: boolean) => void
  },
  options: {
    enabled: boolean
    loadRuntime: () => Promise<typeof import('phaser')>
    onError?: () => void
    onReady: () => void
    startupTimeoutMs?: number
  },
) => void

const useTestablePhaserGame = usePhaserGame as unknown as UsePhaserGameForTest

function TestGameMount() {
  const parentRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)

  useTestablePhaserGame(
    parentRef,
    () => ({
      destroy: vi.fn(),
    }),
    {
      enabled: true,
      loadRuntime: async () => ({}) as typeof import('phaser'),
      onReady: () => setIsLoading(false),
    },
  )

  return (
    <div ref={parentRef}>
      {isLoading ? <p>Loading Phaser engine...</p> : <p>Engine ready</p>}
    </div>
  )
}

describe('usePhaserGame', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('notifies React when the Phaser runtime has mounted', async () => {
    render(<TestGameMount />)

    expect(screen.getByText('Loading Phaser engine...')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Engine ready')).toBeInTheDocument()
    })
  })

  it('reports a startup error when the Phaser runtime never resolves', async () => {
    vi.useFakeTimers()

    function PendingRuntimeMount() {
      const parentRef = useRef<HTMLDivElement>(null)
      const [status, setStatus] = useState('loading')

      useTestablePhaserGame(
        parentRef,
        () => ({
          destroy: vi.fn(),
        }),
        {
          enabled: true,
          loadRuntime: () =>
            new Promise<typeof import('phaser')>(() => {
              // Simulates CSP blocking the runtime before the import promise settles.
            }),
          onError: () => setStatus('error'),
          onReady: () => setStatus('ready'),
          startupTimeoutMs: 50,
        },
      )

      return (
        <div ref={parentRef}>
          {status === 'loading' ? <p>Loading Phaser engine...</p> : null}
          {status === 'error' ? <p>Phaser could not start.</p> : null}
        </div>
      )
    }

    render(<PendingRuntimeMount />)

    expect(screen.getByText('Loading Phaser engine...')).toBeInTheDocument()

    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50)
    })

    expect(screen.getByText('Phaser could not start.')).toBeInTheDocument()
  })
})
