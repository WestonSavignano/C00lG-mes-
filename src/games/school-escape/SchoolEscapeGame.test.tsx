import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SchoolEscapeGame from './SchoolEscapeGame'
import type {
  SchoolEscapeSceneCallbacks,
  SchoolEscapeSceneController,
} from './schoolEscapeScene'

function createHarness() {
  let callbacks: SchoolEscapeSceneCallbacks | undefined
  const controller: SchoolEscapeSceneController = {
    setCameraDrag: vi.fn(),
    setCamouflageColor: vi.fn(),
    resize: vi.fn(),
    restart: vi.fn(),
    dispose: vi.fn(),
  }
  const sceneFactory = vi.fn((
    _canvas: HTMLCanvasElement,
    _input: never,
    nextCallbacks: SchoolEscapeSceneCallbacks,
  ) => {
    callbacks = nextCallbacks
    return controller
  })

  return {
    controller,
    sceneFactory,
    getCallbacks: () => callbacks,
  }
}

describe('SchoolEscapeGame', () => {
  it('renders touch controls, an accessible RGB mixer, and blend guidance', () => {
    const harness = createHarness()
    render(<SchoolEscapeGame sceneFactory={harness.sceneFactory} />)

    expect(screen.getByRole('group', { name: 'Move' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sprint' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Jump' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Red camouflage' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Green camouflage' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Blue camouflage' })).toBeInTheDocument()
    expect(screen.getByText(/Blend:/i)).toHaveTextContent('POOR')
  })

  it('updates the scene when a camouflage channel changes', () => {
    const harness = createHarness()
    render(<SchoolEscapeGame sceneFactory={harness.sceneFactory} />)

    fireEvent.change(screen.getByRole('slider', { name: 'Red camouflage' }), {
      target: { value: '120' },
    })

    expect(harness.controller.setCamouflageColor).toHaveBeenLastCalledWith({
      r: 120,
      g: 30,
      b: 34,
    })
  })

  it('shows Retry after capture and starts a clean run through the scene controller', () => {
    const harness = createHarness()
    render(<SchoolEscapeGame sceneFactory={harness.sceneFactory} />)

    act(() => harness.getCallbacks()?.onPhaseChange?.('failed'))
    expect(screen.getByRole('heading', { name: 'Caught!' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(harness.controller.restart).toHaveBeenCalledTimes(1)
  })

  it('shows the escape result and Play Again after reaching home', () => {
    const harness = createHarness()
    render(<SchoolEscapeGame sceneFactory={harness.sceneFactory} />)

    act(() => harness.getCallbacks()?.onPhaseChange?.('won'))
    expect(screen.getByRole('heading', { name: 'YOU ESCAPED' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Play Again' }))
    expect(harness.controller.restart).toHaveBeenCalledTimes(1)
  })
})
