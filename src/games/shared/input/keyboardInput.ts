import type { SemanticInputWriter } from './semanticInput'

export type KeyboardBinding<Action extends string> = {
  code: string
  move?: Readonly<{ x: number; y: number }>
  hold?: Action
  press?: Action
  preventDefault?: boolean
}

const interactiveSelector =
  'button, a, input, select, textarea, [contenteditable="true"]'

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(interactiveSelector))
}

export function attachKeyboardInput<Action extends string>(
  target: Window,
  writer: SemanticInputWriter<Action>,
  bindings: readonly KeyboardBinding<Action>[],
): () => void {
  const bindingsByCode = new Map<string, KeyboardBinding<Action>[]>()

  for (const binding of bindings) {
    const existing = bindingsByCode.get(binding.code)
    if (existing) {
      existing.push(binding)
    } else {
      bindingsByCode.set(binding.code, [binding])
    }
  }

  const sourceIdFor = (code: string) => `keyboard:${code}`

  const handleKeyDown = (event: KeyboardEvent) => {
    const mapped = bindingsByCode.get(event.code)
    if (!mapped || isInteractiveTarget(event.target)) {
      return
    }

    if (mapped.some((binding) => binding.preventDefault)) {
      event.preventDefault()
    }

    const sourceId = sourceIdFor(event.code)

    for (const binding of mapped) {
      if (binding.move) {
        writer.setMoveSource(sourceId, binding.move.x, binding.move.y)
      }

      if (binding.hold) {
        writer.setActionSource(sourceId, binding.hold, true)
      }

      if (binding.press && !event.repeat) {
        writer.pulseAction(binding.press)
      }
    }
  }

  const handleKeyUp = (event: KeyboardEvent) => {
    if (!bindingsByCode.has(event.code)) {
      return
    }

    writer.clearSource(sourceIdFor(event.code))
  }

  target.addEventListener('keydown', handleKeyDown)
  target.addEventListener('keyup', handleKeyUp)

  return () => {
    target.removeEventListener('keydown', handleKeyDown)
    target.removeEventListener('keyup', handleKeyUp)

    for (const code of bindingsByCode.keys()) {
      writer.clearSource(sourceIdFor(code))
    }
  }
}
