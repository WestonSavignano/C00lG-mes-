import DirectionalControl from '../shared/input/DirectionalControl'
import type { SemanticInputWriter } from '../shared/input/semanticInput'
import type { MonsterColorRushAction } from './monsterColorRushInput'

type MonsterColorRushControlsProps = {
  writer: SemanticInputWriter<MonsterColorRushAction>
}

function MonsterColorRushControls({ writer }: MonsterColorRushControlsProps) {
  return (
    <div className="monster-color-rush__touch-controls" aria-label="Touch controls">
      <DirectionalControl
        className="monster-color-rush__touch-stick"
        label="Move player"
        sourceId="monster-color-rush-touch"
        writer={writer}
      />
    </div>
  )
}

export default MonsterColorRushControls
