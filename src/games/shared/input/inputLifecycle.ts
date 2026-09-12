import type { SemanticInputWriter } from './semanticInput'

export function attachInputResetLifecycle<Action extends string>(
  windowTarget: Window,
  documentTarget: Document,
  writer: SemanticInputWriter<Action>,
): () => void {
  const reset = () => writer.reset()
  const handleVisibilityChange = () => {
    if (documentTarget.hidden) {
      reset()
    }
  }

  windowTarget.addEventListener('blur', reset)
  windowTarget.addEventListener('pagehide', reset)
  windowTarget.addEventListener('orientationchange', reset)
  documentTarget.addEventListener('visibilitychange', handleVisibilityChange)
  documentTarget.addEventListener('fullscreenchange', reset)

  return () => {
    windowTarget.removeEventListener('blur', reset)
    windowTarget.removeEventListener('pagehide', reset)
    windowTarget.removeEventListener('orientationchange', reset)
    documentTarget.removeEventListener('visibilitychange', handleVisibilityChange)
    documentTarget.removeEventListener('fullscreenchange', reset)
    reset()
  }
}
