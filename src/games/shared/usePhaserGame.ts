import { useEffect, type RefObject } from 'react'

type PhaserModule = typeof import('phaser')
type PhaserGameInstance = {
  destroy: (removeCanvas: boolean, noReturn?: boolean) => void
}

type CreatePhaserGame = (
  PhaserRuntime: PhaserModule,
  parent: HTMLDivElement,
) => PhaserGameInstance

type UsePhaserGameOptions = {
  enabled?: boolean
  loadRuntime?: () => Promise<PhaserModule>
  onError?: (error: unknown) => void
  onReady?: () => void
  startupTimeoutMs?: number
}

const loadDefaultRuntime = () =>
  import('phaser-csp') as unknown as Promise<PhaserModule>

function usePhaserGame(
  parentRef: RefObject<HTMLDivElement | null>,
  createGame: CreatePhaserGame,
  {
    enabled = import.meta.env.MODE !== 'test',
    loadRuntime = loadDefaultRuntime,
    onError,
    onReady,
    startupTimeoutMs = 8000,
  }: UsePhaserGameOptions = {},
) {
  useEffect(() => {
    const parent = parentRef.current

    if (!parent || typeof window === 'undefined' || !enabled) {
      return
    }

    let game: PhaserGameInstance | undefined
    let didCancel = false
    let didFinishStartup = false

    const failStartup = (error: unknown) => {
      if (didCancel || didFinishStartup) {
        return
      }

      didFinishStartup = true
      onError?.(error)
    }

    const startupTimeoutId = window.setTimeout(() => {
      failStartup(new Error('Phaser runtime startup timed out.'))
    }, startupTimeoutMs)

    void loadRuntime()
      .then((PhaserRuntime) => {
        if (didCancel || didFinishStartup || !parent.isConnected) {
          return
        }

        game = createGame(PhaserRuntime, parent)
        didFinishStartup = true
        window.clearTimeout(startupTimeoutId)
        onReady?.()
      })
      .catch((error: unknown) => {
        window.clearTimeout(startupTimeoutId)
        failStartup(error)
      })

    return () => {
      didCancel = true
      window.clearTimeout(startupTimeoutId)
      game?.destroy(true)
    }
  }, [
    createGame,
    enabled,
    loadRuntime,
    onError,
    onReady,
    parentRef,
    startupTimeoutMs,
  ])
}

export default usePhaserGame
