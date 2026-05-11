import type { ReactNode } from 'react'

type GameControl = {
  action: string
  input: string
}

type GameShellProps = {
  children: ReactNode
  controls: GameControl[]
  description: string
  engine?: 'phaser'
  title: string
}

function GameShell({
  children,
  controls,
  description,
  engine = 'phaser',
  title,
}: GameShellProps) {
  return (
    <section className="game-shell" data-engine={engine} data-testid="game-shell">
      <header className="game-shell__header">
        <div>
          <p className="eyebrow">Phaser 4 starter</p>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <dl className="game-controls" aria-label="Controls">
          {controls.map((control) => (
            <div key={control.input}>
              <dt>{control.input}</dt>
              <dd>{control.action}</dd>
            </div>
          ))}
        </dl>
      </header>
      {children}
    </section>
  )
}

export default GameShell
