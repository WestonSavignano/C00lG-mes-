import { useEffect, useRef } from 'react'
import { attachInputResetLifecycle } from './inputLifecycle'
import { attachKeyboardInput, type KeyboardBinding } from './keyboardInput'
import {
  createSemanticInput,
  type SemanticInput,
} from './semanticInput'

export function useSemanticInput<Action extends string>(
  bindings: readonly KeyboardBinding<Action>[],
): SemanticInput<Action> {
  const inputRef = useRef<SemanticInput<Action> | null>(null)

  if (!inputRef.current) {
    inputRef.current = createSemanticInput<Action>()
  }

  const input = inputRef.current

  useEffect(() => {
    const detachKeyboard = attachKeyboardInput(window, input.writer, bindings)
    const detachLifecycle = attachInputResetLifecycle(
      window,
      document,
      input.writer,
    )

    return () => {
      detachKeyboard()
      detachLifecycle()
    }
  }, [bindings, input])

  return input
}
