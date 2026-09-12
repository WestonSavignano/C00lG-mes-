export type MovementVector = Readonly<{ x: number; y: number }>

export type MovementInputWriter = {
  setMoveSource(sourceId: string, x: number, y: number): void
  clearMoveSource(sourceId: string): void
}

export type SemanticInputReader<Action extends string> = {
  readonly move: MovementVector
  isHeld(action: Action): boolean
  consumePress(action: Action): boolean
}

export type SemanticInputWriter<Action extends string> = MovementInputWriter & {
  setActionSource(sourceId: string, action: Action, held: boolean): void
  pulseAction(action: Action): void
  clearSource(sourceId: string): void
  reset(): void
}

export type SemanticInput<Action extends string> = {
  reader: SemanticInputReader<Action>
  writer: SemanticInputWriter<Action>
}

type MutableMovementVector = { x: number; y: number }

export function createSemanticInput<Action extends string>(): SemanticInput<Action> {
  const move: MutableMovementVector = { x: 0, y: 0 }
  const moveSources = new Map<string, MutableMovementVector>()
  const heldSources = new Map<Action, Set<string>>()
  const pendingPresses = new Map<Action, number>()

  const recomputeMove = () => {
    let x = 0
    let y = 0

    for (const source of moveSources.values()) {
      x += source.x
      y += source.y
    }

    const magnitude = Math.hypot(x, y)
    if (magnitude > 1) {
      x /= magnitude
      y /= magnitude
    }

    move.x = Math.abs(x) < Number.EPSILON ? 0 : x
    move.y = Math.abs(y) < Number.EPSILON ? 0 : y
  }

  const clearMoveSource = (sourceId: string) => {
    if (!moveSources.delete(sourceId)) {
      return
    }

    recomputeMove()
  }

  const writer: SemanticInputWriter<Action> = {
    setMoveSource(sourceId, x, y) {
      const safeX = Number.isFinite(x) ? x : 0
      const safeY = Number.isFinite(y) ? y : 0

      if (safeX === 0 && safeY === 0) {
        clearMoveSource(sourceId)
        return
      }

      const existing = moveSources.get(sourceId)
      if (existing) {
        existing.x = safeX
        existing.y = safeY
      } else {
        moveSources.set(sourceId, { x: safeX, y: safeY })
      }

      recomputeMove()
    },
    clearMoveSource,
    setActionSource(sourceId, action, held) {
      const sources = heldSources.get(action)

      if (held) {
        if (sources) {
          sources.add(sourceId)
        } else {
          heldSources.set(action, new Set([sourceId]))
        }
        return
      }

      if (!sources) {
        return
      }

      sources.delete(sourceId)
      if (sources.size === 0) {
        heldSources.delete(action)
      }
    },
    pulseAction(action) {
      pendingPresses.set(action, (pendingPresses.get(action) ?? 0) + 1)
    },
    clearSource(sourceId) {
      clearMoveSource(sourceId)

      for (const [action, sources] of heldSources) {
        sources.delete(sourceId)
        if (sources.size === 0) {
          heldSources.delete(action)
        }
      }
    },
    reset() {
      moveSources.clear()
      heldSources.clear()
      pendingPresses.clear()
      move.x = 0
      move.y = 0
    },
  }

  const reader: SemanticInputReader<Action> = {
    move,
    isHeld(action) {
      return (heldSources.get(action)?.size ?? 0) > 0
    },
    consumePress(action) {
      const pending = pendingPresses.get(action) ?? 0
      if (pending <= 0) {
        return false
      }

      if (pending === 1) {
        pendingPresses.delete(action)
      } else {
        pendingPresses.set(action, pending - 1)
      }

      return true
    },
  }

  return { reader, writer }
}
