import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { GameDefinition } from '../catalog/gameTypes'
import './GameRuntimeErrorBoundary.css'

type GameRuntimeErrorBoundaryProps = {
  children: ReactNode
  game: GameDefinition
}

type GameRuntimeErrorBoundaryState = {
  hasError: boolean
}

class GameRuntimeErrorBoundary extends Component<
  GameRuntimeErrorBoundaryProps,
  GameRuntimeErrorBoundaryState
> {
  state: GameRuntimeErrorBoundaryState = {
    hasError: false,
  }

  static getDerivedStateFromError(): GameRuntimeErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // The boundary intentionally keeps recovery local to the game route.
    // Centralized reporting can be added here when product telemetry exists.
  }

  private retry = () => {
    this.setState({ hasError: false })
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="game-runtime-error" role="alert">
        <div className="game-runtime-error__panel">
          <p className="game-runtime-error__eyebrow">Game interrupted</p>
          <h2>Something interrupted {this.props.game.title}.</h2>
          <p>
            Your browser can retry the game without leaving the arcade, or you can
            choose another game.
          </p>
          <div className="game-runtime-error__actions">
            <button onClick={this.retry} type="button">
              Try again
            </button>
            <Link to="/games">Choose another game</Link>
          </div>
        </div>
      </div>
    )
  }
}

export default GameRuntimeErrorBoundary
